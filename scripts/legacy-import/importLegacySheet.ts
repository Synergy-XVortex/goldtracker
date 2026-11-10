/**
 * One-off import of the legacy Google Sheet (exported as .xlsx) into Supabase.
 *
 * Usage:
 *   npm run import -- <export.xlsx> <output.sql>
 *
 * The script never talks to the database. It reads the workbook, rebuilds
 * purchases and price history, checks the result against the Sheet's own
 * summary (Gain!H3:L13) and writes a single SQL transaction to <output.sql>.
 * Review the summary, then apply the SQL to the project.
 *
 * The workbook and the SQL contain personal financial data: keep them in
 * data/ (ignored by Git) and never commit them.
 */

import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { computeHoldings, type Purchase } from '../../src/domain/holdings.ts'

const PORTFOLIO_NAME = 'Famille'
const PRODUCT_CODES: Record<string, { code: string; grams: number }> = {
  '10,00 g': { code: 'bar-10g', grams: 10 },
  '20,00 g': { code: 'bar-20g', grams: 20 },
}
const PRICE_SHEETS = [
  { sheet: 'CoursDeLOr10g', code: 'bar-10g' },
  { sheet: 'CoursDeLOr20g', code: 'bar-20g' },
]
const SPLIT_MARKER = 'Scindée'
/**
 * The Apps Script ran around midnight and recorded the dealer quote of the day
 * before. Rows written before noon are therefore dated one day earlier, which
 * matches how the new price job stores the dealer's own quote date.
 */
const PREVIOUS_DAY_BEFORE_HOUR = 12

interface LegacyRow {
  date: string
  person: string
  type: string
  priceCents: number
  paidCents: number
}

interface ImportedPurchase {
  id: string
  productCode: string
  quantity: number
  purchasedOn: string
  totalPriceCents: number
  shares: Map<string, number>
}

async function main(): Promise<void> {
  const [inputPath, outputPath] = process.argv.slice(2)
  if (!inputPath || !outputPath) {
    throw new Error('Usage: npm run import -- <export.xlsx> <output.sql>')
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(inputPath)

  const gainSheet = requireSheet(workbook, 'Gain')
  const rows = readPurchaseRows(gainSheet)
  const purchases = groupPurchases(rows)
  const participants = [...new Set(rows.map((row) => row.person))]
  const prices = PRICE_SHEETS.flatMap(({ sheet, code }) =>
    readPriceHistory(requireSheet(workbook, sheet)).map((price) => ({ ...price, code })),
  )

  verifyAgainstSheetSummary(gainSheet, purchases, participants, prices)
  writeFileSync(outputPath, buildSql(purchases, participants, prices))

  console.error(
    `\nSQL written to ${outputPath}: ${participants.length} participants, ${purchases.length} purchases, ${prices.length} daily prices.`,
  )
}

function readPurchaseRows(sheet: ExcelJS.Worksheet): LegacyRow[] {
  const rows: LegacyRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const date = row.getCell(1).value
    const person = cellText(row.getCell(2).value)
    if (!(date instanceof Date) || !person) return
    rows.push({
      date: isoDate(date),
      person,
      type: cellText(row.getCell(3).value),
      priceCents: euroCents(row.getCell(4).value),
      paidCents: euroCents(row.getCell(6).value),
    })
  })
  return rows
}

/**
 * A "Scindée" bar appears as one row per participant: those rows become one
 * purchase with several shares. Identical single-owner rows on the same day
 * are several bars bought together: they become one purchase with a quantity.
 */
function groupPurchases(rows: LegacyRow[]): ImportedPurchase[] {
  const byKey = new Map<string, ImportedPurchase>()
  for (const row of rows) {
    const isSplit = row.type.includes(SPLIT_MARKER)
    const product = PRODUCT_CODES[row.type.replace(SPLIT_MARKER, '').trim()]
    if (!product) throw new Error(`Unknown product type "${row.type}" on ${row.date}`)

    const key = isSplit
      ? `split|${row.date}|${row.type}|${row.priceCents}`
      : `single|${row.date}|${row.person}|${row.type}|${row.priceCents}`
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, {
        id: randomUUID(),
        productCode: product.code,
        quantity: 1,
        purchasedOn: row.date,
        totalPriceCents: row.priceCents,
        shares: new Map([[row.person, row.paidCents]]),
      })
    } else if (isSplit) {
      existing.shares.set(row.person, (existing.shares.get(row.person) ?? 0) + row.paidCents)
    } else {
      existing.quantity += 1
      existing.totalPriceCents += row.priceCents
      existing.shares.set(row.person, (existing.shares.get(row.person) ?? 0) + row.paidCents)
    }
  }

  const purchases = [...byKey.values()]
  for (const purchase of purchases) {
    const sharesTotal = [...purchase.shares.values()].reduce((sum, paid) => sum + paid, 0)
    if (sharesTotal !== purchase.totalPriceCents) {
      throw new Error(
        `Purchase of ${purchase.purchasedOn}: shares total ${sharesTotal} instead of ${purchase.totalPriceCents} cents`,
      )
    }
  }
  return purchases
}

function readPriceHistory(sheet: ExcelJS.Worksheet): { date: string; quoteCents: number }[] {
  // Several rows can map to the same quote date; the latest recorded one wins.
  const byDate = new Map<string, { recordedAt: number; quoteCents: number }>()
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const recordedAt = row.getCell(1).value
    const price = row.getCell(2).value
    if (!(recordedAt instanceof Date) || typeof price !== 'number' || price <= 0) return
    const date = quoteDate(recordedAt)
    const previous = byDate.get(date)
    if (!previous || previous.recordedAt < recordedAt.getTime()) {
      byDate.set(date, { recordedAt: recordedAt.getTime(), quoteCents: euroCents(price) })
    }
  })
  return [...byDate.entries()]
    .map(([date, { quoteCents }]) => ({ date, quoteCents }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

/**
 * Recomputes every participant with the app's own valuation code and compares
 * it with the summary block of the Sheet. Any difference aborts the import.
 */
function verifyAgainstSheetSummary(
  sheet: ExcelJS.Worksheet,
  purchases: ImportedPurchase[],
  participants: string[],
  prices: { code: string; date: string; quoteCents: number }[],
): void {
  const latestQuote = (code: string) => prices.filter((price) => price.code === code).at(-1)
  const productIds = new Map(PRICE_SHEETS.map(({ code }, index) => [code, index + 1]))
  const valuations = new Map(
    Object.values(PRODUCT_CODES).map(({ code, grams }) => {
      const quote = latestQuote(code)
      if (!quote) throw new Error(`No price history for ${code}`)
      return [productIds.get(code) ?? 0, { fineWeightGrams: grams, quoteCents: quote.quoteCents }]
    }),
  )
  const holdings = computeHoldings(
    purchases.map((purchase): Purchase => ({
      productId: productIds.get(purchase.productCode) ?? 0,
      quantity: purchase.quantity,
      totalPriceCents: purchase.totalPriceCents,
      shares: [...purchase.shares].map(([participantId, paidCents]) => ({
        participantId,
        paidCents,
      })),
    })),
    valuations,
  )

  const summary = readSheetSummary(sheet)
  const mismatches: string[] = []
  console.error('Participant   Paid (EUR)   Value (EUR)   Gain (EUR)   Weight (g)   Sheet')
  for (const name of participants) {
    const holding = holdings.byParticipant.get(name)
    const expected = summary.get(name)
    if (!holding || !expected) {
      mismatches.push(`${name}: missing from ${holding ? 'the Sheet summary' : 'the import'}`)
      continue
    }
    const actual = {
      paidCents: holding.investedCents,
      valueCents: holding.valueCents,
      gainCents: holding.gainCents,
      centigrams: Math.round(holding.grams * 100),
    }
    const matches = (Object.keys(actual) as (keyof typeof actual)[]).every(
      (field) => actual[field] === expected[field],
    )
    if (!matches)
      mismatches.push(
        `${name}: import ${JSON.stringify(actual)} vs Sheet ${JSON.stringify(expected)}`,
      )
    console.error(
      [
        name.padEnd(12),
        (actual.paidCents / 100).toFixed(2).padStart(11),
        (actual.valueCents / 100).toFixed(2).padStart(13),
        (actual.gainCents / 100).toFixed(2).padStart(12),
        (actual.centigrams / 100).toFixed(2).padStart(12),
        matches ? '   identical' : '   DIFFERENT',
      ].join(' '),
    )
  }
  if (mismatches.length > 0) {
    throw new Error(`The import does not match the Sheet summary:\n${mismatches.join('\n')}`)
  }
}

function readSheetSummary(sheet: ExcelJS.Worksheet) {
  // Labels in column H, one participant per column from I onwards.
  const labelRows = new Map<string, number[]>()
  sheet.eachRow((row, rowNumber) => {
    const label = cellText(row.getCell(8).value)
    if (label) labelRows.set(label, [...(labelRows.get(label) ?? []), rowNumber])
  })
  const rowOf = (label: string, occurrence = 0) => {
    const rowNumber = labelRows.get(label)?.at(occurrence)
    if (!rowNumber) throw new Error(`Summary row "${label}" not found in Gain!H`)
    return sheet.getRow(rowNumber)
  }
  const namesRow = rowOf('Personne')
  const summary = new Map<
    string,
    { paidCents: number; valueCents: number; gainCents: number; centigrams: number }
  >()
  for (let column = 9; column <= namesRow.cellCount; column++) {
    const name = cellText(namesRow.getCell(column).value)
    if (!name) continue
    summary.set(name, {
      gainCents: euroCents(rowOf('Gain').getCell(column).value),
      paidCents: euroCents(rowOf('Payé').getCell(column).value),
      valueCents: euroCents(rowOf('Total').getCell(column).value),
      // The second "Total" row holds the weight in grams.
      centigrams: euroCents(rowOf('Total', 1).getCell(column).value),
    })
  }
  return summary
}

function buildSql(
  purchases: ImportedPurchase[],
  participants: string[],
  prices: { code: string; date: string; quoteCents: number }[],
): string {
  const portfolioId = randomUUID()
  const participantIds = new Map(participants.map((name) => [name, randomUUID()]))
  const productId = (code: string) =>
    `(select id from public.products where code = ${literal(code)})`

  const lines = [
    '-- Generated by scripts/legacy-import. Contains personal data: do not commit.',
    'begin;',
    "do $$ begin if exists (select 1 from public.portfolios) then raise exception 'A portfolio already exists: import aborted'; end if; end $$;",
    `insert into public.portfolios (id, name) values (${literal(portfolioId)}, ${literal(PORTFOLIO_NAME)});`,
    ...participants.map(
      (name) =>
        `insert into public.participants (id, portfolio_id, display_name) values (${literal(participantIds.get(name) ?? '')}, ${literal(portfolioId)}, ${literal(name)});`,
    ),
  ]

  for (const purchase of purchases) {
    lines.push(
      `insert into public.purchases (id, portfolio_id, product_id, quantity, purchased_on, total_price_cents, note) values (${literal(purchase.id)}, ${literal(portfolioId)}, ${productId(purchase.productCode)}, ${purchase.quantity}, ${literal(purchase.purchasedOn)}, ${purchase.totalPriceCents}, 'Imported from the legacy Google Sheet');`,
    )
    for (const [name, paidCents] of purchase.shares) {
      lines.push(
        `insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents) values (${literal(purchase.id)}, ${literal(portfolioId)}, ${literal(participantIds.get(name) ?? '')}, ${paidCents});`,
      )
    }
  }

  // Prices already fetched by the new job (dealer source) are kept as they are.
  for (const price of prices) {
    lines.push(
      `insert into public.gold_prices (product_id, price_date, quote_cents, source, status) values (${productId(price.code)}, ${literal(price.date)}, ${price.quoteCents}, 'sheet-import', 'ok') on conflict (product_id, price_date) do nothing;`,
    )
  }

  lines.push('commit;', '')
  return lines.join('\n')
}

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name)
  if (!sheet) throw new Error(`Sheet "${name}" not found`)
  return sheet
}

/** Accepts numbers and French-formatted text ("1 470,00 €", "120,00 g", "-45,81"). */
function euroCents(value: ExcelJS.CellValue): number {
  const resolved =
    value !== null && typeof value === 'object' && 'result' in value ? value.result : value
  if (typeof resolved === 'number') return Math.round(resolved * 100)
  const text = cellText(resolved as ExcelJS.CellValue)
    .replace(/[\s  €g]/g, '')
    .replace(',', '.')
  const parsed = Number(text)
  if (text === '' || Number.isNaN(parsed)) throw new Error(`Not an amount: "${String(value)}"`)
  return Math.round(parsed * 100)
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '').trim()
  if (typeof value === 'object' && 'richText' in value)
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim()
  return String(value).trim()
}

/** Excel stores wall-clock time; ExcelJS exposes it through the UTC fields. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function quoteDate(recordedAt: Date): string {
  const shifted = new Date(recordedAt)
  if (recordedAt.getUTCHours() < PREVIOUS_DAY_BEFORE_HOUR)
    shifted.setUTCDate(shifted.getUTCDate() - 1)
  return isoDate(shifted)
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

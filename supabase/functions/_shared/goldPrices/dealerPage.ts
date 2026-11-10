/**
 * Reads the prices of one product from an achat-or-et-argent.fr product page.
 *
 * Kept free of Deno and DOM APIs so it runs unchanged in the Edge Function and
 * in the Vitest suite. The fixtures next to this file are real page excerpts:
 * when the dealer changes its markup, the tests fail before production does.
 */

export interface DealerPrices {
  /** Date printed next to the quote ("cotation ... au 09/11/2026"), ISO format. */
  quoteDate: string
  /** Dealer quote ("cotation"), the reference value of the legacy Sheet. */
  quoteCents: number
  /** Selling price for 1 to 9 units. */
  buyCents: number
  /** Price the dealer pays to buy one unit back. */
  buybackCents: number
  /** Value of the fine gold content at the dealer's spot price. */
  intrinsicValueCents: number
}

export class DealerPageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DealerPageError'
  }
}

const QUOTE_PATTERN =
  /cotation du [^<]*? au (\d{2})\/(\d{2})\/(\d{4}) en temps r[ée]el\s*:\s*<span[^>]*>([^<]+)<\/span>/i
const BUY_PATTERN = /id="pxAE"\s+value="([^"]+)"/
const BUYBACK_PATTERN = /id="pxVU"\s+value="([^"]+)"/
const INTRINSIC_VALUE_PATTERN =
  /Valeur intrins[èe]que(?:&nbsp;|\s)*<i[^>]*><\/i>\s*:\s*<span[^>]*>([^<]+)<\/span>/i

export function parseDealerPage(html: string): DealerPrices {
  const quoteMatch = QUOTE_PATTERN.exec(html)
  if (!quoteMatch) {
    throw new DealerPageError('Quote sentence not found ("cotation ... en temps réel")')
  }
  const [, day, month, year, quoteText] = quoteMatch

  return {
    quoteDate: toIsoDate(day, month, year),
    quoteCents: parseEuroAmount(quoteText, 'quote'),
    buyCents: parseEuroAmount(matchOrThrow(BUY_PATTERN, html, 'buy price (pxAE)'), 'buy price'),
    buybackCents: parseEuroAmount(
      matchOrThrow(BUYBACK_PATTERN, html, 'buyback price (pxVU)'),
      'buyback price',
    ),
    intrinsicValueCents: parseEuroAmount(
      matchOrThrow(INTRINSIC_VALUE_PATTERN, html, 'intrinsic value'),
      'intrinsic value',
    ),
  }
}

/**
 * Converts the dealer's notation ("1&nbsp;295.00 €", "1 244.50", "1121.5")
 * into integer cents. The dealer uses a dot as decimal separator.
 */
export function parseEuroAmount(text: string, label: string): number {
  const normalised = text
    .replace(/&nbsp;|&#160;| | /g, '')
    .replace(/€/g, '')
    .replace(/\s+/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) {
    throw new DealerPageError(`Unreadable ${label}: "${text}"`)
  }
  const [euros, decimals = ''] = normalised.split('.')
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
  if (cents <= 0) {
    throw new DealerPageError(`Non-positive ${label}: "${text}"`)
  }
  return cents
}

function matchOrThrow(pattern: RegExp, html: string, label: string): string {
  const match = pattern.exec(html)
  if (!match) {
    throw new DealerPageError(`${label} not found`)
  }
  return match[1]
}

function toIsoDate(day: string, month: string, year: string): string {
  const iso = `${year}-${month}-${day}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new DealerPageError(`Invalid quote date: ${day}/${month}/${year}`)
  }
  return iso
}

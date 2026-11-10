import type { DailyQuote } from './priceHistory'

export interface DatedPurchase {
  productId: number
  quantity: number
  purchasedOn: string
  /** Share of the purchase being followed, 1 for the whole portfolio. */
  ownedFraction: number
  paidCents: number
}

export interface PortfolioPoint {
  date: string
  valueCents: number
  investedCents: number
}

/**
 * Value of the portfolio on each quote date: the bars bought on or before that
 * day, valued at that day's quote (or the last known quote of their product).
 * Starts at the first purchase.
 */
export function portfolioHistory(
  purchases: readonly DatedPurchase[],
  quotesByProduct: ReadonlyMap<number, readonly DailyQuote[]>,
): PortfolioPoint[] {
  if (purchases.length === 0) return []
  const firstPurchase = purchases.reduce(
    (earliest, purchase) => (purchase.purchasedOn < earliest ? purchase.purchasedOn : earliest),
    purchases[0].purchasedOn,
  )

  const dates = new Set<string>()
  for (const quotes of quotesByProduct.values()) {
    for (const quote of quotes) if (quote.date >= firstPurchase) dates.add(quote.date)
  }
  const sortedDates = [...dates].sort()

  const cursors = new Map<number, { index: number; lastQuoteCents: number | null }>()
  for (const productId of quotesByProduct.keys())
    cursors.set(productId, { index: 0, lastQuoteCents: null })

  return sortedDates.map((date) => {
    // Advance each product's cursor to its last quote on or before `date`.
    for (const [productId, cursor] of cursors) {
      const quotes = quotesByProduct.get(productId) ?? []
      while (cursor.index < quotes.length && quotes[cursor.index].date <= date) {
        cursor.lastQuoteCents = quotes[cursor.index].quoteCents
        cursor.index++
      }
    }

    let exactValueCents = 0
    let investedCents = 0
    for (const purchase of purchases) {
      if (purchase.purchasedOn > date) continue
      investedCents += purchase.paidCents
      const quoteCents = cursors.get(purchase.productId)?.lastQuoteCents
      if (quoteCents != null) {
        exactValueCents += purchase.ownedFraction * purchase.quantity * quoteCents
      }
    }
    return { date, valueCents: Math.round(exactValueCents), investedCents }
  })
}

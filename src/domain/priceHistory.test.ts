import { describe, expect, it } from 'vitest'
import { portfolioHistory } from './portfolioHistory'
import { extremes, filterByPeriod, latestChange } from './priceHistory'

const quotes = [
  { date: '2025-11-01', quoteCents: 100_000 },
  { date: '2026-05-15', quoteCents: 120_000 },
  { date: '2026-10-15', quoteCents: 130_000 },
  { date: '2026-11-08', quoteCents: 128_000 },
  { date: '2026-11-09', quoteCents: 129_500 },
]

describe('filterByPeriod', () => {
  it('counts the period back from the latest quote', () => {
    expect(filterByPeriod(quotes, '1M').map((quote) => quote.date)).toEqual([
      '2026-10-15',
      '2026-11-08',
      '2026-11-09',
    ])
    expect(filterByPeriod(quotes, '6M')).toHaveLength(4)
    expect(filterByPeriod(quotes, '1A')).toHaveLength(4)
    expect(filterByPeriod(quotes, 'TOUT')).toHaveLength(5)
    expect(filterByPeriod([], '1M')).toEqual([])
  })
})

describe('latestChange', () => {
  it('compares the last two quotes', () => {
    expect(latestChange(quotes)).toEqual({ cents: 1_500, ratio: 1_500 / 128_000 })
    expect(latestChange(quotes.slice(0, 1))).toBeNull()
  })
})

describe('extremes', () => {
  it('finds the highest and lowest quotes with their dates', () => {
    expect(extremes(quotes)).toEqual({ highest: quotes[2], lowest: quotes[0] })
    expect(extremes([])).toBeNull()
  })
})

describe('portfolioHistory', () => {
  it('values only the bars already bought, at the quote of each day', () => {
    const history = portfolioHistory(
      [
        {
          productId: 1,
          quantity: 1,
          purchasedOn: '2026-05-15',
          ownedFraction: 1,
          paidCents: 110_000,
        },
        {
          productId: 1,
          quantity: 1,
          purchasedOn: '2026-11-08',
          ownedFraction: 0.5,
          paidCents: 60_000,
        },
      ],
      new Map([[1, quotes]]),
    )
    expect(history).toEqual([
      { date: '2026-05-15', valueCents: 120_000, investedCents: 110_000 },
      { date: '2026-10-15', valueCents: 130_000, investedCents: 110_000 },
      { date: '2026-11-08', valueCents: 192_000, investedCents: 170_000 },
      { date: '2026-11-09', valueCents: 194_250, investedCents: 170_000 },
    ])
  })

  it('carries the last known quote of a product over days without one', () => {
    const history = portfolioHistory(
      [
        { productId: 1, quantity: 1, purchasedOn: '2026-01-01', ownedFraction: 1, paidCents: 1 },
        { productId: 2, quantity: 1, purchasedOn: '2026-01-01', ownedFraction: 1, paidCents: 1 },
      ],
      new Map([
        [
          1,
          [
            { date: '2026-01-01', quoteCents: 100 },
            { date: '2026-01-02', quoteCents: 110 },
          ],
        ],
        [2, [{ date: '2026-01-01', quoteCents: 200 }]],
      ]),
    )
    expect(history.map((point) => point.valueCents)).toEqual([300, 310])
  })

  it('is empty without purchases', () => {
    expect(portfolioHistory([], new Map([[1, quotes]]))).toEqual([])
  })
})

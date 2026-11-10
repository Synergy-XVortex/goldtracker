import { describe, expect, it } from 'vitest'
import { displayedHistory, resolveDisplayedPortfolio } from './displayedPortfolio'

describe('resolveDisplayedPortfolio', () => {
  const ids = ['a', 'b']

  it('keeps a stored participant or the family', () => {
    expect(resolveDisplayedPortfolio('b', ids, 'a')).toEqual({
      kind: 'participant',
      participantId: 'b',
    })
    expect(resolveDisplayedPortfolio('family', ids, 'a')).toEqual({ kind: 'family' })
  })

  it("defaults to the account's own participant, then to the family", () => {
    expect(resolveDisplayedPortfolio(null, ids, 'a')).toEqual({
      kind: 'participant',
      participantId: 'a',
    })
    expect(resolveDisplayedPortfolio(null, ids, null)).toEqual({ kind: 'family' })
  })

  it('ignores a stored participant that no longer exists', () => {
    expect(resolveDisplayedPortfolio('archived', ids, 'a')).toEqual({
      kind: 'participant',
      participantId: 'a',
    })
  })
})

describe('displayedHistory', () => {
  const quotes = new Map([[1, [{ date: '2026-01-01', quoteCents: 120_000 }]]])
  const purchases = [
    {
      id: 'p1',
      productId: 1,
      quantity: 1,
      purchasedOn: '2026-01-01',
      totalPriceCents: 100_000,
      shares: [
        { participantId: 'a', paidCents: 25_000 },
        { participantId: 'b', paidCents: 75_000 },
      ],
    },
    {
      id: 'p2',
      productId: 1,
      quantity: 1,
      purchasedOn: '2026-01-01',
      totalPriceCents: 100_000,
      shares: [{ participantId: 'b', paidCents: 100_000 }],
    },
  ]

  it("follows only the participant's shares", () => {
    expect(
      displayedHistory({ kind: 'participant', participantId: 'a' }, purchases, quotes),
    ).toEqual([{ date: '2026-01-01', valueCents: 30_000, investedCents: 25_000 }])
  })

  it('follows every purchase for the family', () => {
    expect(displayedHistory({ kind: 'family' }, purchases, quotes)).toEqual([
      { date: '2026-01-01', valueCents: 240_000, investedCents: 200_000 },
    ])
  })
})

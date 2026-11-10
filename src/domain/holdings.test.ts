import { describe, expect, it } from 'vitest'
import { computeHoldings, type ProductValuation, type Purchase } from './holdings'

const BAR_10G = 1
const BAR_20G = 2

const valuations = new Map<number, ProductValuation>([
  [BAR_10G, { fineWeightGrams: 10, quoteCents: 120_000 }],
  [BAR_20G, { fineWeightGrams: 20, quoteCents: 238_000 }],
])

describe('computeHoldings', () => {
  it('values a single-owner purchase at the current quote', () => {
    const purchases: Purchase[] = [
      {
        productId: BAR_10G,
        quantity: 1,
        totalPriceCents: 80_000,
        shares: [{ participantId: 'a', paidCents: 80_000 }],
      },
    ]
    const { byParticipant, total } = computeHoldings(purchases, valuations)
    expect(byParticipant.get('a')).toEqual({
      investedCents: 80_000,
      grams: 10,
      valueCents: 120_000,
      gainCents: 40_000,
      gainRatio: 0.5,
    })
    expect(total).toEqual(byParticipant.get('a'))
  })

  it('splits weight, value and gain in proportion to what each participant paid', () => {
    const purchases: Purchase[] = [
      {
        productId: BAR_10G,
        quantity: 1,
        totalPriceCents: 150_000,
        shares: [
          { participantId: 'a', paidCents: 100_000 },
          { participantId: 'b', paidCents: 50_000 },
        ],
      },
    ]
    const { byParticipant } = computeHoldings(purchases, valuations)
    const shareA = byParticipant.get('a')
    const shareB = byParticipant.get('b')
    expect(shareA?.grams).toBeCloseTo(6.6667, 4)
    expect(shareB?.grams).toBeCloseTo(3.3333, 4)
    // Quote 1 200 € below the 1 500 € paid: each loses in proportion to their share.
    expect(shareA?.gainCents).toBe(-20_000)
    expect(shareB?.gainCents).toBe(-10_000)
  })

  it('rounds each participant once, after summing all their purchases', () => {
    // 1/3 of a bar three times: rounding per purchase would lose a cent.
    const roundQuote = new Map<number, ProductValuation>([
      [BAR_10G, { fineWeightGrams: 10, quoteCents: 100_000 }],
    ])
    const thirdOfABar = (participantId: string): Purchase => ({
      productId: BAR_10G,
      quantity: 1,
      totalPriceCents: 3,
      shares: [
        { participantId, paidCents: 1 },
        { participantId: 'other', paidCents: 2 },
      ],
    })
    const { byParticipant } = computeHoldings(
      [thirdOfABar('a'), thirdOfABar('a'), thirdOfABar('a')],
      roundQuote,
    )
    // 3 × 33 333.33… = 100 000; rounding each third first would give 99 999.
    expect(byParticipant.get('a')?.valueCents).toBe(100_000)
  })

  it('counts every unit of a multi-unit purchase', () => {
    const purchases: Purchase[] = [
      {
        productId: BAR_20G,
        quantity: 2,
        totalPriceCents: 400_000,
        shares: [{ participantId: 'a', paidCents: 400_000 }],
      },
    ]
    const holding = computeHoldings(purchases, valuations).byParticipant.get('a')
    expect(holding?.grams).toBe(40)
    expect(holding?.valueCents).toBe(476_000)
  })

  it('adds up participants into the portfolio total', () => {
    const purchases: Purchase[] = [
      {
        productId: BAR_10G,
        quantity: 1,
        totalPriceCents: 100_000,
        shares: [{ participantId: 'a', paidCents: 100_000 }],
      },
      {
        productId: BAR_20G,
        quantity: 1,
        totalPriceCents: 200_000,
        shares: [
          { participantId: 'a', paidCents: 50_000 },
          { participantId: 'b', paidCents: 150_000 },
        ],
      },
    ]
    const { total } = computeHoldings(purchases, valuations)
    expect(total.investedCents).toBe(300_000)
    expect(total.grams).toBe(30)
    expect(total.valueCents).toBe(358_000)
    expect(total.gainCents).toBe(58_000)
  })

  it('returns an empty portfolio when there are no purchases', () => {
    const { byParticipant, total } = computeHoldings([], valuations)
    expect(byParticipant.size).toBe(0)
    expect(total).toEqual({
      investedCents: 0,
      grams: 0,
      valueCents: 0,
      gainCents: 0,
      gainRatio: null,
    })
  })

  it('rejects purchases whose shares do not add up to the total', () => {
    const purchases: Purchase[] = [
      {
        productId: BAR_10G,
        quantity: 1,
        totalPriceCents: 100_000,
        shares: [{ participantId: 'a', paidCents: 99_999 }],
      },
    ]
    expect(() => computeHoldings(purchases, valuations)).toThrow(/add up/)
  })

  it('rejects a product that has no valuation', () => {
    const purchases: Purchase[] = [
      {
        productId: 99,
        quantity: 1,
        totalPriceCents: 1,
        shares: [{ participantId: 'a', paidCents: 1 }],
      },
    ]
    expect(() => computeHoldings(purchases, valuations)).toThrow(/product 99/)
  })
})

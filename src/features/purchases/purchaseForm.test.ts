import { describe, expect, it } from 'vitest'
import {
  buildShares,
  centsToInput,
  parseEuroInput,
  splitTotalCents,
  todayInParis,
} from './purchaseForm'

describe('parseEuroInput', () => {
  it('accepts the usual ways of typing an amount', () => {
    expect(parseEuroInput('1 253,50')).toBe(125_350)
    expect(parseEuroInput('1253.5')).toBe(125_350)
    expect(parseEuroInput('1 253 €')).toBe(125_300)
    expect(parseEuroInput('640')).toBe(64_000)
  })

  it('rejects anything else', () => {
    expect(parseEuroInput('')).toBeNull()
    expect(parseEuroInput('0')).toBeNull()
    expect(parseEuroInput('-5')).toBeNull()
    expect(parseEuroInput('12,345')).toBeNull()
    expect(parseEuroInput('douze')).toBeNull()
  })
})

describe('centsToInput', () => {
  it('formats cents for an editable field', () => {
    expect(centsToInput(125_350)).toBe('1253,50')
  })
})

describe('buildShares', () => {
  it('gives the whole total to a single owner', () => {
    expect(
      buildShares({ totalCents: 149_000, split: false, singleParticipantId: 'a', splitShares: [] }),
    ).toEqual({ ok: true, shares: [{ participant_id: 'a', paid_cents: 149_000 }] })
  })

  it('accepts a split that adds up to the total and skips empty amounts', () => {
    const result = buildShares({
      totalCents: 149_000,
      split: true,
      singleParticipantId: null,
      splitShares: [
        { participantId: 'a', amount: '640' },
        { participantId: 'b', amount: '500,00' },
        { participantId: 'c', amount: '350' },
        { participantId: 'd', amount: '' },
      ],
    })
    expect(result).toEqual({
      ok: true,
      shares: [
        { participant_id: 'a', paid_cents: 64_000 },
        { participant_id: 'b', paid_cents: 50_000 },
        { participant_id: 'c', paid_cents: 35_000 },
      ],
    })
  })

  it('explains what is wrong', () => {
    expect(
      buildShares({ totalCents: null, split: false, singleParticipantId: 'a', splitShares: [] }),
    ).toEqual({
      ok: false,
      error: 'Saisissez le prix total payé.',
    })
    expect(
      buildShares({
        totalCents: 100_000,
        split: true,
        singleParticipantId: null,
        splitShares: [{ participantId: 'a', amount: '900' }],
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/égale au prix total/) })
    expect(
      buildShares({
        totalCents: 100_000,
        split: true,
        singleParticipantId: null,
        splitShares: [{ participantId: 'a', amount: 'abc' }],
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/invalide/) })
  })
})

describe('helpers', () => {
  it('adds up readable split amounts', () => {
    expect(
      splitTotalCents([
        { participantId: 'a', amount: '10' },
        { participantId: 'b', amount: 'x' },
      ]),
    ).toBe(1_000)
  })

  it("uses Paris time for today's date", () => {
    expect(todayInParis(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11')
  })
})

/**
 * Plausibility rules applied before a dealer price is published.
 * A price that fails them is stored as "quarantined" for review instead of
 * silently feeding the charts and the portfolio value.
 */

export const GRAMS_PER_TROY_OUNCE = 31.1034768

/** Largest accepted change of the quote from one published day to the next. */
export const MAX_DAILY_CHANGE_RATIO = 0.08

/**
 * Accepted range for quote ÷ value of the gold content at spot price.
 * Bars sell above spot (premium); the free spot feed is delayed by 24 hours,
 * so the range also absorbs one day of market movement.
 */
export const QUOTE_TO_SPOT_RANGE = { min: 0.95, max: 1.35 } as const

export interface PreviousQuote {
  quoteCents: number
  /** Spot price recorded with that quote, used to estimate the premium. */
  spotEurPerTroyOunce: number | null
}

export type CheckOutcome = { status: 'ok' } | { status: 'quarantined'; reason: string }

export function spotValueCents(spotEurPerTroyOunce: number, fineWeightGrams: number): number {
  return Math.round(((spotEurPerTroyOunce * fineWeightGrams) / GRAMS_PER_TROY_OUNCE) * 100)
}

export function checkQuote(input: {
  quoteCents: number
  fineWeightGrams: number
  spotEurPerTroyOunce: number | null
  previous: PreviousQuote | null
}): CheckOutcome {
  const { quoteCents, fineWeightGrams, spotEurPerTroyOunce, previous } = input

  if (previous) {
    const change = Math.abs(quoteCents - previous.quoteCents) / previous.quoteCents
    if (change > MAX_DAILY_CHANGE_RATIO) {
      return {
        status: 'quarantined',
        reason: `Quote moved ${(change * 100).toFixed(1)} % since the last published value (limit ${MAX_DAILY_CHANGE_RATIO * 100} %)`,
      }
    }
  }

  if (spotEurPerTroyOunce !== null) {
    const ratio = quoteCents / spotValueCents(spotEurPerTroyOunce, fineWeightGrams)
    if (ratio < QUOTE_TO_SPOT_RANGE.min || ratio > QUOTE_TO_SPOT_RANGE.max) {
      return {
        status: 'quarantined',
        reason: `Quote is ${ratio.toFixed(3)} × the spot value (accepted ${QUOTE_TO_SPOT_RANGE.min} to ${QUOTE_TO_SPOT_RANGE.max})`,
      }
    }
  }

  return { status: 'ok' }
}

/**
 * Fallback when the dealer page cannot be read: today's spot value times the
 * premium observed on the last published quote. Returns null when that
 * premium is unknown, in which case nothing is published for the day.
 */
export function estimateQuoteCents(input: {
  fineWeightGrams: number
  spotEurPerTroyOunce: number
  previous: PreviousQuote | null
}): number | null {
  const { fineWeightGrams, spotEurPerTroyOunce, previous } = input
  if (!previous || previous.spotEurPerTroyOunce === null) {
    return null
  }
  const premiumRatio =
    previous.quoteCents / spotValueCents(previous.spotEurPerTroyOunce, fineWeightGrams)
  return Math.round(spotValueCents(spotEurPerTroyOunce, fineWeightGrams) * premiumRatio)
}

/** Helpers over a product's daily quotes, sorted by date ascending. */

export interface DailyQuote {
  date: string
  quoteCents: number
}

export type Period = '1M' | '6M' | '1A' | 'TOUT'

export const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: '1M', label: '1M' },
  { value: '6M', label: '6M' },
  { value: '1A', label: '1A' },
  { value: 'TOUT', label: 'Tout' },
]

const PERIOD_MONTHS: Record<Exclude<Period, 'TOUT'>, number> = { '1M': 1, '6M': 6, '1A': 12 }

/** Keeps the quotes within the period, counted back from the most recent quote. */
export function filterByPeriod<T extends { date: string }>(
  series: readonly T[],
  period: Period,
): T[] {
  const last = series.at(-1)
  if (period === 'TOUT' || !last) return [...series]
  const start = new Date(`${last.date}T00:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - PERIOD_MONTHS[period])
  const startIso = start.toISOString().slice(0, 10)
  return series.filter((point) => point.date >= startIso)
}

/** Change between the last quote and the previous different day; null with fewer than two quotes. */
export function latestChange(
  series: readonly DailyQuote[],
): { cents: number; ratio: number } | null {
  const last = series.at(-1)
  const previous = series.at(-2)
  if (!last || !previous) return null
  const cents = last.quoteCents - previous.quoteCents
  return { cents, ratio: cents / previous.quoteCents }
}

export function extremes(
  series: readonly DailyQuote[],
): { highest: DailyQuote; lowest: DailyQuote } | null {
  if (series.length === 0) return null
  let highest = series[0]
  let lowest = series[0]
  for (const point of series) {
    if (point.quoteCents > highest.quoteCents) highest = point
    if (point.quoteCents < lowest.quoteCents) lowest = point
  }
  return { highest, lowest }
}

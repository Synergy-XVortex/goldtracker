/** French formatting shared by every screen. Amounts are integer euro cents. */

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const signedEuroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

const gramsFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const longDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100)
}

export function formatSignedEuros(cents: number): string {
  return signedEuroFormatter.format(cents / 100)
}

/** `ratio` is a fraction: 0.131 is shown as "+13,1 %". */
export function formatSignedPercent(ratio: number): string {
  return percentFormatter.format(ratio)
}

export function formatGrams(grams: number): string {
  return `${gramsFormatter.format(grams)} g`
}

/** `isoDate` is a calendar date ("2026-11-09"), never shifted by time zones. */
export function formatDate(isoDate: string): string {
  return longDateFormatter.format(new Date(`${isoDate}T00:00:00Z`))
}

export function formatMonth(isoDate: string): string {
  return monthFormatter.format(new Date(`${isoDate}T00:00:00Z`))
}

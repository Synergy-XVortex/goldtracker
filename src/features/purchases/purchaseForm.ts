/** Pure rules behind the purchase form, kept out of the component so they can be tested. */

export interface ShareInput {
  participantId: string
  amount: string
}

export type ShareResult =
  | { ok: true; shares: { participant_id: string; paid_cents: number }[] }
  | { ok: false; error: string }

/**
 * Reads an amount typed the French way ("1 253,50", "1253.5", "1 253 €") into cents.
 * Returns null when the text is not a positive amount with at most two decimals.
 */
export function parseEuroInput(text: string): number | null {
  const normalised = text.replace(/[\s  €]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null
  const [euros, decimals = ''] = normalised.split('.')
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
  return cents > 0 ? cents : null
}

/** Shows cents in the editable French notation used by the inputs ("1253,50"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Turns the form into the shares sent to save_purchase. A single owner pays the
 * whole total; a split purchase needs amounts that add up exactly to the total.
 */
export function buildShares(input: {
  totalCents: number | null
  split: boolean
  singleParticipantId: string | null
  splitShares: readonly ShareInput[]
}): ShareResult {
  const { totalCents, split, singleParticipantId, splitShares } = input
  if (totalCents === null) return { ok: false, error: 'Saisissez le prix total payé.' }

  if (!split) {
    if (!singleParticipantId) return { ok: false, error: 'Choisissez qui a payé.' }
    return { ok: true, shares: [{ participant_id: singleParticipantId, paid_cents: totalCents }] }
  }

  const shares: { participant_id: string; paid_cents: number }[] = []
  for (const share of splitShares) {
    if (share.amount.trim() === '') continue
    const cents = parseEuroInput(share.amount)
    if (cents === null)
      return { ok: false, error: 'Un des montants de la répartition est invalide.' }
    shares.push({ participant_id: share.participantId, paid_cents: cents })
  }
  if (shares.length === 0) return { ok: false, error: 'Indiquez au moins un montant payé.' }

  const sharesTotal = shares.reduce((sum, share) => sum + share.paid_cents, 0)
  if (sharesTotal !== totalCents) {
    return { ok: false, error: 'La répartition doit être égale au prix total.' }
  }
  return { ok: true, shares }
}

/** Sum of the split amounts that can be read, for the live "réparti" indicator. */
export function splitTotalCents(splitShares: readonly ShareInput[]): number {
  return splitShares.reduce((sum, share) => sum + (parseEuroInput(share.amount) ?? 0), 0)
}

/** Today's date in Paris, as the default purchase date. */
export function todayInParis(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now)
}

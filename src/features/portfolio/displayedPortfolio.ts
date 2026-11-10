import { useCallback, useState } from 'react'
import { portfolioHistory, type PortfolioPoint } from '../../domain/portfolioHistory'
import type { DailyQuote } from '../../domain/priceHistory'
import type { PortfolioPurchase } from './portfolioApi'

/** What the home screen shows: one participant's share, or the whole family. */
export type DisplayedPortfolio = { kind: 'family' } | { kind: 'participant'; participantId: string }

const FAMILY_VALUE = 'family'
const storageKey = (userId: string) => `goldtracker.home-portfolio.${userId}`

/**
 * Keeps the stored choice only if that participant still exists; otherwise falls
 * back to the account's own participant, then to the whole family.
 */
export function resolveDisplayedPortfolio(
  storedValue: string | null,
  participantIds: readonly string[],
  ownParticipantId: string | null,
): DisplayedPortfolio {
  if (storedValue === FAMILY_VALUE) return { kind: 'family' }
  if (storedValue && participantIds.includes(storedValue)) {
    return { kind: 'participant', participantId: storedValue }
  }
  if (ownParticipantId && participantIds.includes(ownParticipantId)) {
    return { kind: 'participant', participantId: ownParticipantId }
  }
  return { kind: 'family' }
}

export function toStoredValue(choice: DisplayedPortfolio): string {
  return choice.kind === 'family' ? FAMILY_VALUE : choice.participantId
}

/** Remembered per account and per device, like the theme. */
export function useDisplayedPortfolio(
  userId: string | undefined,
  participantIds: readonly string[],
  ownParticipantId: string | null,
) {
  const [storedValue, setStoredValue] = useState<string | null>(() => readStored(userId))
  const choice = resolveDisplayedPortfolio(storedValue, participantIds, ownParticipantId)

  const setChoice = useCallback(
    (next: DisplayedPortfolio) => {
      const value = toStoredValue(next)
      setStoredValue(value)
      if (!userId) return
      try {
        window.localStorage.setItem(storageKey(userId), value)
      } catch {
        // Blocked storage: the choice applies until the page is reloaded.
      }
    },
    [userId],
  )

  return { choice, setChoice }
}

function readStored(userId: string | undefined): string | null {
  if (!userId) return null
  try {
    return window.localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

/** Value history of a participant's shares, or of every purchase for the family. */
export function displayedHistory(
  choice: DisplayedPortfolio,
  purchases: readonly Pick<
    PortfolioPurchase,
    'productId' | 'quantity' | 'purchasedOn' | 'totalPriceCents' | 'shares'
  >[],
  quotesByProduct: ReadonlyMap<number, readonly DailyQuote[]>,
): PortfolioPoint[] {
  const followed = purchases.flatMap((purchase) => {
    if (choice.kind === 'family') {
      return [{ ...purchase, ownedFraction: 1, paidCents: purchase.totalPriceCents }]
    }
    const paidCents = purchase.shares
      .filter((share) => share.participantId === choice.participantId)
      .reduce((sum, share) => sum + share.paidCents, 0)
    if (paidCents === 0) return []
    return [{ ...purchase, ownedFraction: paidCents / purchase.totalPriceCents, paidCents }]
  })
  return portfolioHistory(followed, quotesByProduct)
}

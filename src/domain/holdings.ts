/**
 * Portfolio valuation rules, shared by every screen that shows holdings.
 *
 * A participant who paid part of a purchase owns the same part of what was bought:
 *   owned fraction = paid by the participant / total price of the purchase
 *   grams          = owned fraction × quantity × fine weight of the product
 *   value          = owned fraction × quantity × today's quote of the product
 *   gain           = value − paid
 * This reproduces the legacy Google Sheet ("Gain" tab) exactly.
 *
 * Amounts are integer euro cents. Values are rounded to the cent once per
 * participant, after summing, so rounding errors do not accumulate.
 */

export interface PurchaseShare {
  participantId: string
  paidCents: number
}

export interface Purchase {
  productId: number
  quantity: number
  totalPriceCents: number
  shares: readonly PurchaseShare[]
}

export interface ProductValuation {
  fineWeightGrams: number
  /** Today's quote for one unit of the product, in cents. */
  quoteCents: number
}

export interface Holding {
  investedCents: number
  grams: number
  valueCents: number
  gainCents: number
  /** Gain divided by the amount invested; null when nothing was invested. */
  gainRatio: number | null
}

export interface PortfolioHoldings {
  byParticipant: ReadonlyMap<string, Holding>
  total: Holding
}

interface RunningTotals {
  investedCents: number
  grams: number
  exactValueCents: number
}

export function computeHoldings(
  purchases: readonly Purchase[],
  valuations: ReadonlyMap<number, ProductValuation>,
): PortfolioHoldings {
  const runningByParticipant = new Map<string, RunningTotals>()

  for (const purchase of purchases) {
    assertValidPurchase(purchase)
    const valuation = valuations.get(purchase.productId)
    if (!valuation) {
      throw new Error(`No valuation available for product ${purchase.productId}`)
    }

    for (const share of purchase.shares) {
      const ownedFraction = share.paidCents / purchase.totalPriceCents
      const running = runningByParticipant.get(share.participantId) ?? {
        investedCents: 0,
        grams: 0,
        exactValueCents: 0,
      }
      running.investedCents += share.paidCents
      running.grams += ownedFraction * purchase.quantity * valuation.fineWeightGrams
      running.exactValueCents += ownedFraction * purchase.quantity * valuation.quoteCents
      runningByParticipant.set(share.participantId, running)
    }
  }

  const byParticipant = new Map<string, Holding>()
  const totalRunning: RunningTotals = { investedCents: 0, grams: 0, exactValueCents: 0 }

  for (const [participantId, running] of runningByParticipant) {
    byParticipant.set(participantId, toHolding(running))
    totalRunning.investedCents += running.investedCents
    totalRunning.grams += running.grams
    totalRunning.exactValueCents += running.exactValueCents
  }

  return { byParticipant, total: toHolding(totalRunning) }
}

function toHolding(running: RunningTotals): Holding {
  const valueCents = Math.round(running.exactValueCents)
  const gainCents = valueCents - running.investedCents
  return {
    investedCents: running.investedCents,
    grams: running.grams,
    valueCents,
    gainCents,
    gainRatio: running.investedCents === 0 ? null : gainCents / running.investedCents,
  }
}

/** Mirrors the database constraints so bad data fails loudly instead of skewing totals. */
function assertValidPurchase(purchase: Purchase): void {
  if (!Number.isInteger(purchase.quantity) || purchase.quantity <= 0) {
    throw new Error(`Invalid quantity: ${purchase.quantity}`)
  }
  if (!Number.isInteger(purchase.totalPriceCents) || purchase.totalPriceCents <= 0) {
    throw new Error(`Invalid total price: ${purchase.totalPriceCents}`)
  }
  const sharesTotal = purchase.shares.reduce((sum, share) => sum + share.paidCents, 0)
  if (sharesTotal !== purchase.totalPriceCents) {
    throw new Error(
      `Shares add up to ${sharesTotal} cents instead of ${purchase.totalPriceCents} cents`,
    )
  }
}

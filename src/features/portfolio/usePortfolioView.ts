import { useMemo } from 'react'
import { computeHoldings, type Holding, type ProductValuation } from '../../domain/holdings'
import { portfolioHistory, type PortfolioPoint } from '../../domain/portfolioHistory'
import type { DailyQuote } from '../../domain/priceHistory'
import { usePrices, type ProductPrices } from '../prices/pricesApi'
import { usePortfolio, type PortfolioData } from './portfolioApi'

export interface ParticipantView {
  id: string
  displayName: string
  holding: Holding
}

export interface PortfolioView {
  data: PortfolioData
  prices: ProductPrices[]
  /** Date of the oldest "latest quote" used for the valuation. */
  valuationDate: string | null
  total: Holding
  participants: ParticipantView[]
  history: PortfolioPoint[]
}

/** Loads the portfolio and the prices, then values everything with the domain rules. */
export function usePortfolioView() {
  const portfolio = usePortfolio()
  const prices = usePrices()

  const view = useMemo((): PortfolioView | null => {
    if (!portfolio.data || !prices.data) return null
    return buildView(portfolio.data, prices.data)
  }, [portfolio.data, prices.data])

  return {
    view,
    isPending: portfolio.isPending || prices.isPending,
    isError: portfolio.isError || prices.isError,
    hasNoPortfolio: portfolio.isSuccess && portfolio.data === null,
  }
}

function buildView(data: PortfolioData, prices: ProductPrices[]): PortfolioView {
  const valuations = new Map<number, ProductValuation>()
  const quotesByProduct = new Map<number, DailyQuote[]>()
  const latestDates: string[] = []
  for (const { product, quotes } of prices) {
    quotesByProduct.set(product.id, quotes)
    const latest = quotes.at(-1)
    if (latest) {
      valuations.set(product.id, {
        fineWeightGrams: product.fineWeightGrams,
        quoteCents: latest.quoteCents,
      })
      latestDates.push(latest.date)
    }
  }

  const { byParticipant, total } = computeHoldings(data.purchases, valuations)
  const participants = data.participants
    .map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      holding: byParticipant.get(participant.id),
    }))
    .filter((entry): entry is ParticipantView => entry.holding !== undefined)
    .sort((left, right) => right.holding.valueCents - left.holding.valueCents)

  const history = portfolioHistory(
    data.purchases.map((purchase) => ({
      productId: purchase.productId,
      quantity: purchase.quantity,
      purchasedOn: purchase.purchasedOn,
      ownedFraction: 1,
      paidCents: purchase.totalPriceCents,
    })),
    quotesByProduct,
  )

  return {
    data,
    prices,
    valuationDate: latestDates.sort()[0] ?? null,
    total,
    participants,
    history,
  }
}

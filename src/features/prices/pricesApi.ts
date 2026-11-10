import { useQuery } from '@tanstack/react-query'
import type { DailyQuote } from '../../domain/priceHistory'
import { fetchAllPages, supabase } from '../../lib/supabaseClient'

export interface Product {
  id: number
  code: string
  label: string
  fineWeightGrams: number
}

export interface ProductPrice extends DailyQuote {
  buyCents: number | null
  buybackCents: number | null
  status: 'ok' | 'estimated'
  source: string
}

export interface ProductPrices {
  product: Product
  /** Published quotes, oldest first. */
  quotes: ProductPrice[]
}

/** Products and their full published price history (public data, no session needed). */
export function usePrices() {
  return useQuery({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    // Prices change once a day: no need to refetch on every screen change.
    staleTime: 15 * 60 * 1000,
  })
}

async function fetchPrices(): Promise<ProductPrices[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, code, label, fine_weight_grams')
    .order('fine_weight_grams')
  if (error) throw error

  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('gold_prices')
      .select('product_id, price_date, quote_cents, buy_cents, buyback_cents, status, source')
      .order('price_date')
      .order('product_id')
      .range(from, to),
  )

  return products.map((product) => ({
    product: {
      id: product.id,
      code: product.code,
      label: product.label,
      fineWeightGrams: Number(product.fine_weight_grams),
    },
    quotes: rows
      .filter((row) => row.product_id === product.id)
      .map((row) => ({
        date: row.price_date,
        quoteCents: row.quote_cents,
        buyCents: row.buy_cents,
        buybackCents: row.buyback_cents,
        // Readers only receive published rows (Row Level Security).
        status: row.status === 'estimated' ? 'estimated' : 'ok',
        source: row.source,
      })),
  }))
}

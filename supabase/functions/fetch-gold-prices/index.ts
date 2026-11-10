// Daily job: reads each product's dealer page, checks the quote against the
// spot price and the previous day, and stores the result in gold_prices.
// Triggered by pg_cron (see the schedule migration) with a shared secret header.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { parseDealerPage, type DealerPrices } from '../_shared/goldPrices/dealerPage.ts'
import {
  checkQuote,
  estimateQuoteCents,
  type PreviousQuote,
} from '../_shared/goldPrices/priceChecks.ts'
import { buildSpotRequestUrl, parseSpotResponse } from '../_shared/goldPrices/spotPrice.ts'

const FETCH_ATTEMPTS = 3
const FETCH_TIMEOUT_MS = 10_000
const RETRY_BASE_DELAY_MS = 2_000
const USER_AGENT = 'GoldTracker/1.0 (family portfolio tracker; 2 requests per day)'

interface Product {
  id: number
  code: string
  fine_weight_grams: number
  dealer_url: string
}

type RunOutcome = 'ok' | 'estimated' | 'quarantined' | 'failed'

interface ProductResult {
  product: string
  outcome: RunOutcome
  detail: string
}

Deno.serve(async (request) => {
  if (!isAuthorised(request)) {
    return json({ error: 'Unauthorised' }, 401)
  }

  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const { data: products, error } = await client
    .from('products')
    .select('id, code, fine_weight_grams, dealer_url')
    .not('dealer_url', 'is', null)
  if (error) {
    return json({ error: `Could not load products: ${error.message}` }, 500)
  }

  const spot = await fetchSpotPrice()
  const results: ProductResult[] = []
  for (const product of products as Product[]) {
    results.push(await processProduct(client, product, spot.value, spot.error))
  }

  const failed = results.some((result) => result.outcome === 'failed')
  return json(
    { spotEurPerTroyOunce: spot.value, spotError: spot.error, results },
    failed ? 502 : 200,
  )
})

async function processProduct(
  client: SupabaseClient,
  product: Product,
  spotEurPerTroyOunce: number | null,
  spotError: string | null,
): Promise<ProductResult> {
  const startedAt = new Date().toISOString()
  const fineWeightGrams = Number(product.fine_weight_grams)

  let prices: DealerPrices | null = null
  let readError = ''
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS && !prices; attempt++) {
    try {
      prices = parseDealerPage(await fetchText(product.dealer_url))
    } catch (error) {
      readError = `attempt ${attempt}: ${errorMessage(error)}`
      if (attempt < FETCH_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * attempt)
    }
  }

  let result: ProductResult
  if (prices) {
    result = await storeDealerPrices(client, product, fineWeightGrams, prices, spotEurPerTroyOunce)
  } else if (spotEurPerTroyOunce !== null) {
    result = await storeEstimate(client, product, fineWeightGrams, spotEurPerTroyOunce, readError)
  } else {
    result = {
      product: product.code,
      outcome: 'failed',
      detail: `Dealer page unreadable (${readError}) and no spot price (${spotError ?? 'unknown'})`,
    }
  }

  await client.from('price_fetch_runs').insert({
    product_id: product.id,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    outcome: result.outcome,
    detail: result.detail,
  })
  return result
}

async function storeDealerPrices(
  client: SupabaseClient,
  product: Product,
  fineWeightGrams: number,
  prices: DealerPrices,
  spotEurPerTroyOunce: number | null,
): Promise<ProductResult> {
  const previous = await latestPublishedQuote(client, product.id, { before: prices.quoteDate })
  const check = checkQuote({
    quoteCents: prices.quoteCents,
    fineWeightGrams,
    spotEurPerTroyOunce,
    previous,
  })

  if (check.status === 'quarantined') {
    // Never replace an already published value of the same day with a suspicious one.
    const { data: existing } = await client
      .from('gold_prices')
      .select('status')
      .eq('product_id', product.id)
      .eq('price_date', prices.quoteDate)
      .maybeSingle()
    if (existing?.status === 'ok') {
      return {
        product: product.code,
        outcome: 'quarantined',
        detail: `${check.reason}; kept the published value`,
      }
    }
  }

  const { error } = await client.from('gold_prices').upsert({
    product_id: product.id,
    price_date: prices.quoteDate,
    quote_cents: prices.quoteCents,
    buy_cents: prices.buyCents,
    buyback_cents: prices.buybackCents,
    spot_eur_per_troy_ounce: spotEurPerTroyOunce,
    source: 'dealer',
    status: check.status,
    fetched_at: new Date().toISOString(),
  })
  if (error) {
    return {
      product: product.code,
      outcome: 'failed',
      detail: `Database write failed: ${error.message}`,
    }
  }
  return {
    product: product.code,
    outcome: check.status,
    detail:
      check.status === 'ok'
        ? `Quote ${prices.quoteCents / 100} € dated ${prices.quoteDate}`
        : check.reason,
  }
}

async function storeEstimate(
  client: SupabaseClient,
  product: Product,
  fineWeightGrams: number,
  spotEurPerTroyOunce: number,
  readError: string,
): Promise<ProductResult> {
  const previous = await latestPublishedQuote(client, product.id, { withSpot: true })
  const estimate = estimateQuoteCents({ fineWeightGrams, spotEurPerTroyOunce, previous })
  if (estimate === null) {
    return {
      product: product.code,
      outcome: 'failed',
      detail: `Dealer page unreadable (${readError}); no previous premium to estimate from`,
    }
  }

  // An estimate never overwrites a dealer price already stored for today.
  const { error } = await client.from('gold_prices').upsert(
    {
      product_id: product.id,
      price_date: todayInParis(),
      quote_cents: estimate,
      spot_eur_per_troy_ounce: spotEurPerTroyOunce,
      source: 'spot-estimate',
      status: 'estimated',
    },
    { onConflict: 'product_id,price_date', ignoreDuplicates: true },
  )
  if (error) {
    return {
      product: product.code,
      outcome: 'failed',
      detail: `Database write failed: ${error.message}`,
    }
  }
  return {
    product: product.code,
    outcome: 'estimated',
    detail: `Dealer page unreadable (${readError}); estimated ${estimate / 100} € from spot`,
  }
}

async function latestPublishedQuote(
  client: SupabaseClient,
  productId: number,
  options: { before?: string; withSpot?: boolean },
): Promise<PreviousQuote | null> {
  let query = client
    .from('gold_prices')
    .select('quote_cents, spot_eur_per_troy_ounce')
    .eq('product_id', productId)
    .eq('status', 'ok')
  if (options.before) query = query.lt('price_date', options.before)
  if (options.withSpot) query = query.not('spot_eur_per_troy_ounce', 'is', null)
  const { data } = await query.order('price_date', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  return {
    quoteCents: Number(data.quote_cents),
    spotEurPerTroyOunce:
      data.spot_eur_per_troy_ounce === null ? null : Number(data.spot_eur_per_troy_ounce),
  }
}

async function fetchSpotPrice(): Promise<{ value: number | null; error: string | null }> {
  const apiKey = Deno.env.get('METALPRICE_API_KEY')
  if (!apiKey) return { value: null, error: 'METALPRICE_API_KEY is not set' }
  try {
    const response = await fetch(buildSpotRequestUrl(apiKey), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return { value: parseSpotResponse(await response.json()), error: null }
  } catch (error) {
    return { value: null, error: errorMessage(error) }
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return await response.text()
}

function isAuthorised(request: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')
  const provided = request.headers.get('x-cron-secret')
  if (!expected || !provided || expected.length !== provided.length) return false
  // Constant-time comparison so the secret cannot be guessed from response times.
  let difference = 0
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index)
  }
  return difference === 0
}

function todayInParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

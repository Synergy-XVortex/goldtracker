/**
 * Spot gold price in euros per troy ounce, from MetalpriceAPI.
 * The request asks for EUR and XAU against USD, which the free plan allows;
 * EUR per ounce = (EUR per USD) ÷ (ounces per USD).
 */

export const METALPRICE_LATEST_URL = 'https://api.metalpriceapi.com/v1/latest'

export function buildSpotRequestUrl(apiKey: string): string {
  const url = new URL(METALPRICE_LATEST_URL)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('base', 'USD')
  url.searchParams.set('currencies', 'EUR,XAU')
  return url.toString()
}

export function parseSpotResponse(body: unknown): number {
  if (typeof body !== 'object' || body === null) {
    throw new Error('MetalpriceAPI returned a non-object body')
  }
  const { success, rates, error } = body as {
    success?: boolean
    rates?: Record<string, unknown>
    error?: { info?: string; message?: string }
  }
  if (success === false) {
    throw new Error(`MetalpriceAPI error: ${error?.info ?? error?.message ?? 'unknown'}`)
  }
  const eurPerUsd = rates?.EUR
  const ouncesPerUsd = rates?.XAU
  if (
    typeof eurPerUsd !== 'number' ||
    typeof ouncesPerUsd !== 'number' ||
    eurPerUsd <= 0 ||
    ouncesPerUsd <= 0
  ) {
    throw new Error('MetalpriceAPI response is missing positive EUR and XAU rates')
  }
  return eurPerUsd / ouncesPerUsd
}

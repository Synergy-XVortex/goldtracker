import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DealerPageError, parseDealerPage, parseEuroAmount } from './dealerPage.ts'
import { checkQuote, estimateQuoteCents, spotValueCents } from './priceChecks.ts'
import { buildSpotRequestUrl, parseSpotResponse } from './spotPrice.ts'

const readFixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

describe('parseDealerPage', () => {
  it('reads every price of the 10 g bar page', () => {
    expect(parseDealerPage(readFixture('lingot-10g-or.html'))).toEqual({
      quoteDate: '2026-11-09',
      quoteCents: 129_500,
      buyCents: 124_450,
      buybackCents: 112_150,
      intrinsicValueCents: 116_840,
    })
  })

  it('reads every price of the 20 g bar page', () => {
    expect(parseDealerPage(readFixture('lingot-20g-or.html'))).toEqual({
      quoteDate: '2026-11-09',
      quoteCents: 256_800,
      buyCents: 245_400,
      buybackCents: 224_300,
      intrinsicValueCents: 233_680,
    })
  })

  it('fails loudly when the page layout changes', () => {
    expect(() => parseDealerPage('<html><body>Maintenance</body></html>')).toThrow(DealerPageError)
    const withoutBuyback = readFixture('lingot-10g-or.html').replace('id="pxVU"', 'id="other"')
    expect(() => parseDealerPage(withoutBuyback)).toThrow(/buyback/)
  })

  it('rejects an impossible quote date', () => {
    const badDate = readFixture('lingot-10g-or.html').replace('09/11/2026', '31/02/2026')
    expect(() => parseDealerPage(badDate)).toThrow(/Invalid quote date/)
  })
})

describe('parseEuroAmount', () => {
  it('handles the separators used by the dealer', () => {
    expect(parseEuroAmount('1&nbsp;295.00 €', 'x')).toBe(129_500)
    expect(parseEuroAmount('1 244.50', 'x')).toBe(124_450)
    expect(parseEuroAmount('1121.5', 'x')).toBe(112_150)
    expect(parseEuroAmount('2454', 'x')).toBe(245_400)
  })

  it('rejects anything that is not a positive amount', () => {
    expect(() => parseEuroAmount('N/A', 'quote')).toThrow(/Unreadable quote/)
    expect(() => parseEuroAmount('1,295.00', 'quote')).toThrow(DealerPageError)
    expect(() => parseEuroAmount('0.00', 'quote')).toThrow(/Non-positive/)
  })
})

describe('checkQuote', () => {
  // About 3 634 € per ounce: the spot implied by the dealer's intrinsic value of 1 168.40 € for 10 g.
  const spot = 3_634

  it('accepts a quote consistent with the spot price and the previous day', () => {
    expect(
      checkQuote({
        quoteCents: 129_500,
        fineWeightGrams: 10,
        spotEurPerTroyOunce: spot,
        previous: { quoteCents: 128_700, spotEurPerTroyOunce: spot },
      }),
    ).toEqual({ status: 'ok' })
  })

  it('quarantines a jump larger than 8 % from the previous published quote', () => {
    const outcome = checkQuote({
      quoteCents: 140_000,
      fineWeightGrams: 10,
      spotEurPerTroyOunce: null,
      previous: { quoteCents: 129_500, spotEurPerTroyOunce: null },
    })
    expect(outcome.status).toBe('quarantined')
  })

  it('quarantines a quote far from the spot value, such as a misread digit', () => {
    const outcome = checkQuote({
      quoteCents: 12_950,
      fineWeightGrams: 10,
      spotEurPerTroyOunce: spot,
      previous: null,
    })
    expect(outcome).toMatchObject({ status: 'quarantined', reason: expect.stringMatching(/spot/) })
  })

  it('still checks the daily change when the spot feed is unavailable', () => {
    expect(
      checkQuote({
        quoteCents: 129_500,
        fineWeightGrams: 10,
        spotEurPerTroyOunce: null,
        previous: null,
      }),
    ).toEqual({ status: 'ok' })
  })
})

describe('estimateQuoteCents', () => {
  it('applies the last observed premium to the current spot value', () => {
    const previous = { quoteCents: 129_500, spotEurPerTroyOunce: 3_634 }
    const premium = 129_500 / spotValueCents(3_634, 10)
    const estimate = estimateQuoteCents({
      fineWeightGrams: 10,
      spotEurPerTroyOunce: 3_700,
      previous,
    })
    expect(estimate).toBe(Math.round(spotValueCents(3_700, 10) * premium))
  })

  it('gives up when no premium is known', () => {
    expect(
      estimateQuoteCents({ fineWeightGrams: 10, spotEurPerTroyOunce: 3_700, previous: null }),
    ).toBeNull()
    expect(
      estimateQuoteCents({
        fineWeightGrams: 10,
        spotEurPerTroyOunce: 3_700,
        previous: { quoteCents: 129_500, spotEurPerTroyOunce: null },
      }),
    ).toBeNull()
  })
})

describe('spot price', () => {
  it('builds a request that keeps the key in the query string only', () => {
    const url = new URL(buildSpotRequestUrl('test-key'))
    expect(url.origin + url.pathname).toBe('https://api.metalpriceapi.com/v1/latest')
    expect(url.searchParams.get('currencies')).toBe('EUR,XAU')
  })

  it('converts USD-based rates into euros per ounce', () => {
    const eurPerOunce = parseSpotResponse({
      success: true,
      base: 'USD',
      rates: { EUR: 0.88, XAU: 0.000242 },
    })
    expect(eurPerOunce).toBeCloseTo(3_636.36, 2)
  })

  it('surfaces API errors and malformed responses', () => {
    expect(() => parseSpotResponse({ success: false, error: { info: 'Invalid API key' } })).toThrow(
      /Invalid API key/,
    )
    expect(() => parseSpotResponse({ success: true, rates: { EUR: 0.88 } })).toThrow(/XAU/)
  })
})

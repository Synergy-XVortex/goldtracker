import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabaseConfig'

describe('readSupabaseConfig', () => {
  it('returns the normalised URL and key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ' https://example.supabase.co/ ',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toEqual({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' })
  })

  it('accepts plain http for the local Supabase stack', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'local-key',
      }).url,
    ).toBe('http://127.0.0.1:54321')
  })

  it('rejects missing values with a message that explains the fix', () => {
    expect(() => readSupabaseConfig({})).toThrow(/\.env\.local/)
  })

  it('rejects an invalid or non-https remote URL', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toThrow(/not a valid URL/)
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'k',
      }),
    ).toThrow(/https/)
  })
})

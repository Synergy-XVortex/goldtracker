import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readSupabaseConfig } from './supabaseConfig'

const { url, publishableKey } = readSupabaseConfig(import.meta.env)

/** Single shared client; import it only from modules that talk to Supabase. */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    // PKCE: the link in the sign-in e-mail only works in the browser that asked for it.
    // The 6-digit code in the same e-mail covers the other cases (installed iOS app,
    // mail app opening another browser).
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** PostgREST returns at most 1 000 rows per request: fetch every page. */
export async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: Error | null }>,
  pageSize = 1000,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

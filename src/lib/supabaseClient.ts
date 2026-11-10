import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig } from './supabaseConfig'

const { url, publishableKey } = readSupabaseConfig(import.meta.env)

/** Single shared client; import it only from modules that talk to Supabase. */
export const supabase = createClient(url, publishableKey)

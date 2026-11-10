export interface SupabaseConfig {
  url: string
  publishableKey: string
}

type EnvSource = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY', string>>

/**
 * Reads the public Supabase settings from the Vite environment.
 * Both values end up in the browser bundle by design; access to data is
 * enforced by Row Level Security, never by keeping these values hidden.
 * Never put the service_role or secret key in a VITE_ variable.
 */
export function readSupabaseConfig(env: EnvSource): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).',
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error(`VITE_SUPABASE_URL is not a valid URL: "${url}"`)
  }

  const isLocalhost = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
  if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
    throw new Error('VITE_SUPABASE_URL must use https outside local development.')
  }

  return { url: parsedUrl.origin, publishableKey }
}

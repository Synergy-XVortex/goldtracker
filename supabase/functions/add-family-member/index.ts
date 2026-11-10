// Gives a family member read access to a portfolio. Called from the app by a
// portfolio admin. Creates the account if needed (already confirmed, no e-mail
// is sent), so the person can then sign in from /connexion with their address.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { parseMemberRequest } from '../_shared/members/memberRequest.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const USERS_PAGE_SIZE = 200

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: caller } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!caller?.user) return json({ error: 'Sign in again.' }, 401)

  let memberRequest
  try {
    memberRequest = parseMemberRequest(await request.json())
  } catch (error) {
    return json({ error: errorMessage(error) }, 400)
  }

  const { data: callerMembership } = await admin
    .from('portfolio_members')
    .select('role')
    .eq('portfolio_id', memberRequest.portfolioId)
    .eq('user_id', caller.user.id)
    .maybeSingle()
  if (callerMembership?.role !== 'admin') {
    return json({ error: 'Only the portfolio admin can add members.' }, 403)
  }

  if (memberRequest.participantId) {
    const { data: participant } = await admin
      .from('participants')
      .select('id')
      .eq('id', memberRequest.participantId)
      .eq('portfolio_id', memberRequest.portfolioId)
      .maybeSingle()
    if (!participant) return json({ error: 'This participant is not part of the portfolio.' }, 400)
  }

  const user = await findOrCreateUser(admin, memberRequest.email)
  if ('error' in user) return json({ error: user.error }, 500)

  const { data: existing } = await admin
    .from('portfolio_members')
    .select('role')
    .eq('portfolio_id', memberRequest.portfolioId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error: writeError } = await admin.from('portfolio_members').upsert({
    portfolio_id: memberRequest.portfolioId,
    user_id: user.id,
    // Never downgrade an existing admin.
    role: existing?.role === 'admin' ? 'admin' : 'member',
    participant_id: memberRequest.participantId,
    email: memberRequest.email,
  })
  if (writeError) return json({ error: `Could not save the member: ${writeError.message}` }, 500)

  return json(
    { userId: user.id, accountCreated: user.created, alreadyMember: Boolean(existing) },
    200,
  )
})

async function findOrCreateUser(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; created: boolean } | { error: string }> {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (data?.user) return { id: data.user.id, created: true }

  // The address already has an account: find it.
  for (let page = 1; ; page++) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    })
    if (listError) return { error: `Could not list accounts: ${listError.message}` }
    const match = list.users.find((user) => user.email?.toLowerCase() === email)
    if (match) return { id: match.id, created: false }
    if (list.users.length < USERS_PAGE_SIZE) break
  }
  return { error: `Could not create the account: ${error?.message ?? 'unknown error'}` }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

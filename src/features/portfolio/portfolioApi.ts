import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'

export interface Participant {
  id: string
  displayName: string
}

export interface PortfolioPurchase {
  id: string
  productId: number
  quantity: number
  purchasedOn: string
  totalPriceCents: number
  feesCents: number
  seller: string | null
  note: string | null
  shares: { participantId: string; paidCents: number }[]
}

export interface Member {
  userId: string
  email: string | null
  role: 'admin' | 'member'
  participantId: string | null
}

export interface PortfolioData {
  portfolioId: string
  name: string
  role: 'admin' | 'member'
  /** Participant linked to the signed-in account, if any. */
  ownParticipantId: string | null
  participants: Participant[]
  purchases: PortfolioPurchase[]
  members: Member[]
}

/** The signed-in member's portfolio. Row Level Security limits every query to it. */
export function usePortfolio() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchPortfolio(userId ?? ''),
  })
}

async function fetchPortfolio(userId: string): Promise<PortfolioData | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('portfolio_members')
    .select('portfolio_id, role, participant_id, portfolios(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) return null

  const [participantsResult, purchasesResult, membersResult] = await Promise.all([
    supabase
      .from('participants')
      .select('id, display_name')
      .eq('portfolio_id', membership.portfolio_id)
      .eq('archived', false)
      .order('created_at'),
    supabase
      .from('purchases')
      .select(
        'id, product_id, quantity, purchased_on, total_price_cents, fees_cents, seller, note, purchase_shares(participant_id, paid_cents)',
      )
      .eq('portfolio_id', membership.portfolio_id)
      .order('purchased_on', { ascending: false }),
    supabase
      .from('portfolio_members')
      .select('user_id, email, role, participant_id')
      .eq('portfolio_id', membership.portfolio_id)
      .order('created_at'),
  ])
  if (participantsResult.error) throw participantsResult.error
  if (purchasesResult.error) throw purchasesResult.error
  if (membersResult.error) throw membersResult.error

  return {
    portfolioId: membership.portfolio_id,
    name: membership.portfolios?.name ?? 'Portefeuille',
    role: membership.role,
    ownParticipantId: membership.participant_id,
    participants: participantsResult.data.map((row) => ({
      id: row.id,
      displayName: row.display_name,
    })),
    purchases: purchasesResult.data.map((row) => ({
      id: row.id,
      productId: row.product_id,
      quantity: row.quantity,
      purchasedOn: row.purchased_on,
      totalPriceCents: row.total_price_cents,
      feesCents: row.fees_cents,
      seller: row.seller,
      note: row.note,
      shares: row.purchase_shares.map((share) => ({
        participantId: share.participant_id,
        paidCents: share.paid_cents,
      })),
    })),
    members: membersResult.data.map((row) => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
      participantId: row.participant_id,
    })),
  }
}

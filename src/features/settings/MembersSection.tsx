import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { supabase } from '../../lib/supabaseClient'
import type { PortfolioData } from '../portfolio/portfolioApi'

const ROLE_LABELS = { admin: 'Administrateur', member: 'Lecture seule' } as const

/** Admin only: who can open the portfolio, and a form to add a family member. */
export function MembersSection({ portfolio }: { portfolio: PortfolioData }) {
  const queryClient = useQueryClient()
  const online = useOnlineStatus()
  const [email, setEmail] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const names = new Map(
    portfolio.participants.map((participant) => [participant.id, participant.displayName]),
  )

  async function addMember(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const address = email.trim().toLowerCase()
    const { error } = await supabase.functions.invoke('add-family-member', {
      body: {
        portfolioId: portfolio.portfolioId,
        email: address,
        participantId: participantId || null,
      },
    })
    setPending(false)
    if (error) {
      setMessage({ tone: 'error', text: "L'ajout a échoué. Vérifiez l'adresse puis réessayez." })
      return
    }
    setEmail('')
    setParticipantId('')
    setMessage({
      tone: 'success',
      text: `${address} a accès au portefeuille. Prévenez cette personne : elle se connecte depuis la page Connexion famille avec cette adresse.`,
    })
    await queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-surface-line bg-surface p-4"
      aria-labelledby="members-title"
    >
      <h2 id="members-title" className="text-xs font-bold tracking-wider text-muted uppercase">
        Membres de la famille
      </h2>
      <ul className="divide-y divide-line text-sm">
        {portfolio.members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate">{member.email ?? 'Adresse non enregistrée'}</span>
              {member.participantId && (
                <span className="text-xs text-muted">
                  Participant : {names.get(member.participantId) ?? '—'}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs text-muted">{ROLE_LABELS[member.role]}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={addMember} className="flex flex-col gap-3 border-t border-line pt-3">
        <p className="text-sm font-semibold">Donner accès à un membre</p>
        <label htmlFor="member-email" className="flex flex-col gap-1.5 text-sm">
          Adresse e-mail
          <input
            id="member-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-control border border-control-line bg-surface px-3 py-2.5 text-base outline-accent"
          />
        </label>
        <label htmlFor="member-participant" className="flex flex-col gap-1.5 text-sm">
          Participant correspondant
          <select
            id="member-participant"
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            className="rounded-control border border-control-line bg-surface px-3 py-2.5 text-base outline-accent"
          >
            <option value="">Aucun</option>
            {portfolio.participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || !online}
          className="rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {pending ? 'Ajout…' : 'Donner accès en lecture'}
        </button>
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`text-sm ${message.tone === 'error' ? 'text-loss' : 'text-gain'}`}
          >
            {message.text}
          </p>
        )}
        <p className="text-xs text-muted">
          Tant que le serveur d'e-mails personnalisé n'est pas configuré, Supabase n'envoie les
          liens de connexion qu'aux membres de votre équipe Supabase.
        </p>
      </form>
    </section>
  )
}

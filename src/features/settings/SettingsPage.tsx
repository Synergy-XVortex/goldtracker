import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '../../components/AppShell'
import { clearCachedData } from '../../lib/queryPersistence'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { useDisplayedPortfolio } from '../portfolio/displayedPortfolio'
import { usePortfolio } from '../portfolio/portfolioApi'
import { ThemeSelector } from '../theme/ThemeSelector'
import { useTheme } from '../theme/ThemeProvider'
import { MembersSection } from './MembersSection'

const ROLE_LABELS = { admin: 'Administrateur', member: 'Membre (lecture seule)' } as const

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const { session } = useAuth()
  const { data: portfolio } = usePortfolio()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const { choice, setChoice } = useDisplayedPortfolio(
    session?.user.id,
    portfolio?.participants.map((participant) => participant.id) ?? [],
    portfolio?.ownParticipantId ?? null,
  )

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    // The portfolio is private: do not leave it in the device cache.
    await clearCachedData()
    navigate('/cours', { replace: true })
  }

  return (
    <Page title="Réglages">
      <div className="grid gap-4 md:grid-cols-2 md:items-start md:gap-6">
        <section className="rounded-card border border-surface-line bg-surface p-4">
          <ThemeSelector value={preference} onChange={setPreference} />
        </section>

        {portfolio && (
          <section className="rounded-card border border-surface-line bg-surface p-4">
            <label htmlFor="home-portfolio" className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-wider text-muted uppercase">Accueil</span>
              <span className="text-sm">Portefeuille affiché sur l'écran d'accueil</span>
              <select
                id="home-portfolio"
                value={choice.kind === 'family' ? 'family' : choice.participantId}
                onChange={(event) =>
                  setChoice(
                    event.target.value === 'family'
                      ? { kind: 'family' }
                      : { kind: 'participant', participantId: event.target.value },
                  )
                }
                className="rounded-control border border-control-line bg-surface px-3 py-2.5 text-sm outline-accent"
              >
                {portfolio.participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.displayName}
                    {participant.id === portfolio.ownParticipantId ? ' (vous)' : ''}
                  </option>
                ))}
                <option value="family">Toute la {portfolio.name.toLowerCase()}</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-muted">Mémorisé sur cet appareil.</p>
          </section>
        )}

        <section
          className="flex flex-col gap-3 rounded-card border border-surface-line bg-surface p-4"
          aria-labelledby="account-title"
        >
          <h2 id="account-title" className="text-xs font-bold tracking-wider text-muted uppercase">
            Compte
          </h2>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Adresse</dt>
              <dd className="truncate">{session?.user.email}</dd>
            </div>
            {portfolio && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Rôle</dt>
                <dd>{ROLE_LABELS[portfolio.role]}</dd>
              </div>
            )}
          </dl>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-control border border-control-line px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {signingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </section>
        {portfolio?.role === 'admin' && <MembersSection portfolio={portfolio} />}
      </div>
    </Page>
  )
}

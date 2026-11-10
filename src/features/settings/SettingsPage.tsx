import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '../../components/AppShell'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { usePortfolio } from '../portfolio/portfolioApi'
import { ThemeSelector } from '../theme/ThemeSelector'
import { useTheme } from '../theme/ThemeProvider'

const ROLE_LABELS = { admin: 'Administrateur', member: 'Membre (lecture seule)' } as const

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const { session } = useAuth()
  const { data: portfolio } = usePortfolio()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/cours', { replace: true })
  }

  return (
    <Page title="Réglages">
      <section className="rounded-card border border-surface-line bg-surface p-4">
        <ThemeSelector value={preference} onChange={setPreference} />
      </section>

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
    </Page>
  )
}

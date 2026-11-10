import { Link } from 'react-router'
import { AppShell, Page } from '../components/AppShell'
import { StateMessage } from '../components/StateMessage'
import { useAuth } from '../features/auth/AuthProvider'
import { PricesContent } from '../features/prices/PricesPage'

/**
 * The price page is the only public screen: inside the app for family members,
 * standalone with a sign-in link for everyone else.
 */
export function PricesRoute() {
  const { ready, session } = useAuth()
  if (!ready) return <StateMessage>Chargement…</StateMessage>

  if (session) {
    return (
      <AppShell>
        <Page title="Cours de l'or">
          <PricesContent />
        </Page>
      </AppShell>
    )
  }

  return (
    <div className="pb-10">
      <Page
        title="Cours de l'or"
        action={
          <Link to="/connexion" className="text-sm font-semibold text-accent-ink">
            Connexion famille
          </Link>
        }
      >
        <PricesContent />
      </Page>
    </div>
  )
}

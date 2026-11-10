import { Navigate, Outlet, useLocation } from 'react-router'
import { StateMessage } from '../../components/StateMessage'
import { useAuth } from './AuthProvider'

/** Family pages: signed-out visitors are sent to the login page. */
export function RequireAuth() {
  const { ready, session } = useAuth()
  const location = useLocation()

  if (!ready) return <StateMessage>Chargement…</StateMessage>
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  return <Outlet />
}

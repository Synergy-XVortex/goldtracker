import { useOnlineStatus } from '../lib/useOnlineStatus'

/** Tells the reader that figures come from the last connection. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <p
      role="status"
      className="rounded-control border border-control-line bg-chip px-3 py-2 text-xs text-muted"
    >
      Hors ligne : les chiffres affichés sont ceux de la dernière connexion.
    </p>
  )
}

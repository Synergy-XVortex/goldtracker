import type { ReactNode } from 'react'

/** Loading, empty and error states share one quiet layout. */
export function StateMessage({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-card border border-surface-line bg-surface p-4 text-sm ${tone === 'error' ? 'text-loss' : 'text-muted'}`}
    >
      {children}
    </p>
  )
}

import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

const TABS = [
  { to: '/', label: 'Accueil', end: true, icon: <path d="M4 11l8-7 8 7v9H4z" /> },
  {
    to: '/portefeuille',
    label: 'Portefeuille',
    end: false,
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M16 12h2" />
      </>
    ),
  },
  { to: '/cours', label: 'Cours', end: false, icon: <path d="M4 19V5M4 19h16M7 15l4-4 3 3 5-6" /> },
  {
    to: '/reglages',
    label: 'Réglages',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </>
    ),
  },
] as const

/** Signed-in layout: page content above a bottom tab bar. Renders the matched route unless given children. */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1 pb-24">{children ?? <Outlet />}</div>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-md justify-around px-2 pt-2 pb-3">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 text-[11px] ${isActive ? 'font-semibold text-accent-ink' : 'text-muted'}`
                }
              >
                <TabIcon>{tab.icon}</TabIcon>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Shared page frame: title row and a vertical stack of sections. */
export function Page({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  )
}

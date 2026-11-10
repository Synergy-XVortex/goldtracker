import type { ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { usePortfolio } from '../features/portfolio/portfolioApi'
import { OfflineBanner } from './OfflineBanner'

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
  {
    to: '/cours',
    label: 'Cours',
    end: false,
    icon: <path d="M4 19V5M4 19h16M7 15l4-4 3 3 5-6" />,
  },
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

const PLUS_ICON = <path d="M12 5v14M5 12h14" />

/**
 * Signed-in layout. Phones: content above a bottom tab bar. Wider screens: a
 * side navigation and a wider content column. Renders the matched route unless
 * given children.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  const { data: portfolio } = usePortfolio()
  const isAdmin = portfolio?.role === 'admin'

  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-line bg-surface px-4 py-6 md:flex">
        <Link to="/" className="flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-5 bg-accent [clip-path:polygon(18%_0,82%_0,100%_100%,0_100%)]"
          />
          GoldTracker
        </Link>
        <nav aria-label="Navigation principale">
          <ul className="flex flex-col gap-1">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-control px-3 py-2 text-sm ${isActive ? 'bg-chip font-semibold text-accent-ink' : 'text-muted hover:text-fg'}`
                  }
                >
                  <Icon>{tab.icon}</Icon>
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {isAdmin && (
          <Link
            to="/achats/nouveau"
            className="flex items-center justify-center gap-2 rounded-control bg-accent px-3 py-2.5 text-sm font-bold text-on-accent"
          >
            <Icon>{PLUS_ICON}</Icon>
            Nouvel achat
          </Link>
        )}
      </aside>

      <div className="pb-24 md:pb-10">{children ?? <Outlet />}</div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-3">
          {TABS.slice(0, 2).map((tab) => (
            <TabItem key={tab.to} {...tab} />
          ))}
          {isAdmin && (
            <li>
              <Link
                to="/achats/nouveau"
                aria-label="Nouvel achat"
                className="grid size-11 place-items-center rounded-card bg-accent text-on-accent"
              >
                <Icon>{PLUS_ICON}</Icon>
              </Link>
            </li>
          )}
          {TABS.slice(2).map((tab) => (
            <TabItem key={tab.to} {...tab} />
          ))}
        </ul>
      </nav>
    </div>
  )
}

function TabItem({ to, label, end, icon }: (typeof TABS)[number]) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-2 text-[11px] ${isActive ? 'font-semibold text-accent-ink' : 'text-muted'}`
        }
      >
        <Icon>{icon}</Icon>
        {label}
      </NavLink>
    </li>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 fill-none stroke-current"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Shared page frame: title row, offline notice and a vertical stack of sections. */
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] md:max-w-5xl md:gap-6 md:px-8 md:pt-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {action}
      </header>
      <OfflineBanner />
      {children}
    </main>
  )
}

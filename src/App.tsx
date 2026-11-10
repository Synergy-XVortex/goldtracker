import { ThemeSelector } from './features/theme/ThemeSelector'
import { useThemePreference } from './features/theme/useThemePreference'

export function App() {
  const { preference, setPreference } = useThemePreference()

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">GoldTracker</h1>
        <p className="text-sm text-muted">Suivi du portefeuille d'or familial.</p>
      </header>

      <section className="rounded-card border border-surface-line bg-surface p-4">
        <p className="text-sm">
          La nouvelle version est en cours de construction. Les cours, le portefeuille et la
          connexion arrivent dans les prochaines étapes.
        </p>
      </section>

      <section className="rounded-card border border-surface-line bg-surface p-4">
        <ThemeSelector value={preference} onChange={setPreference} />
      </section>
    </main>
  )
}

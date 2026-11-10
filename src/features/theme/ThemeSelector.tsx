import type { ThemePreference } from './themePreference'

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
]

interface ThemeSelectorProps {
  value: ThemePreference
  onChange: (preference: ThemePreference) => void
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">
        Apparence
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const isSelected = option.value === value
          return (
            <label
              key={option.value}
              className={[
                'cursor-pointer rounded-control border px-3 py-2.5 text-center text-sm font-semibold transition-colors',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                isSelected
                  ? 'border-transparent bg-accent text-on-accent'
                  : 'border-control-line bg-surface text-fg hover:bg-chip',
              ].join(' ')}
            >
              <input
                type="radio"
                name="theme-preference"
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted">Mémorisé sur cet appareil.</p>
    </fieldset>
  )
}

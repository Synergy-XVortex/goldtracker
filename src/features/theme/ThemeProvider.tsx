import { createContext, use, type ReactNode } from 'react'
import { useThemePreference } from './useThemePreference'

type ThemeContextValue = ReturnType<typeof useThemePreference>

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Applies the theme once for the whole app and shares the preference with the settings screen. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemePreference()
  return <ThemeContext value={theme}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

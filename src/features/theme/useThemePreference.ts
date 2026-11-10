import { useCallback, useEffect, useState } from 'react'
import {
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from './themePreference'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function getStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ?? false
}

/**
 * Keeps the user's theme choice, applies the resolved theme to the root element
 * and follows operating system changes while the choice is "system".
 */
export function useThemePreference(): {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(getStorage()),
  )
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(DARK_SCHEME_QUERY)
    if (!mediaQuery) return
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = resolveTheme(preference, prefersDark)

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference)
    writeStoredPreference(getStorage(), nextPreference)
  }, [])

  return { preference, resolvedTheme, setPreference }
}

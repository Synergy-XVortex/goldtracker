export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system']
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

/**
 * Key under which the preference is stored on the device.
 * The inline script in index.html reads the same key before React starts,
 * so both must be changed together.
 */
export const THEME_STORAGE_KEY = 'goldtracker.theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return preference
}

/**
 * Storage can be missing or throw (private browsing, blocked site data),
 * so every access falls back to the default instead of failing the app.
 */
export function readStoredPreference(
  storage: Pick<Storage, 'getItem'> | undefined,
): ThemePreference {
  try {
    const storedValue = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(storedValue) ? storedValue : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export function writeStoredPreference(
  storage: Pick<Storage, 'setItem'> | undefined,
  preference: ThemePreference,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The choice still applies for the current visit; it is just not remembered.
  }
}

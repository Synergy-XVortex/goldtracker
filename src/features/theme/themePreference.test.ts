import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
} from './themePreference'

describe('resolveTheme', () => {
  it('uses the explicit choice regardless of the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system setting when the choice is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('isThemePreference', () => {
  it('accepts only the three known values', () => {
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('sepia')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })
})

describe('readStoredPreference', () => {
  it('returns the stored value when it is valid', () => {
    const storage = { getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'dark' : null) }
    expect(readStoredPreference(storage)).toBe('dark')
  })

  it('falls back to the default for missing, invalid or unreadable storage', () => {
    expect(readStoredPreference(undefined)).toBe(DEFAULT_THEME_PREFERENCE)
    expect(readStoredPreference({ getItem: () => 'purple' })).toBe(DEFAULT_THEME_PREFERENCE)
    const throwingStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readStoredPreference(throwingStorage)).toBe(DEFAULT_THEME_PREFERENCE)
  })
})

describe('writeStoredPreference', () => {
  it('stores the preference under the shared key', () => {
    const written: Record<string, string> = {}
    writeStoredPreference({ setItem: (key, value) => (written[key] = value) }, 'light')
    expect(written).toEqual({ [THEME_STORAGE_KEY]: 'light' })
  })

  it('does not throw when storage is blocked', () => {
    const throwingStorage = {
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => writeStoredPreference(throwingStorage, 'dark')).not.toThrow()
  })
})

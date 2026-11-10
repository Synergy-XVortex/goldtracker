// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from './themePreference'
import { useThemePreference } from './useThemePreference'

function mockSystemScheme(prefersDark: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: prefersDark && query.includes('dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
}

describe('useThemePreference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('applies the system theme by default', () => {
    mockSystemScheme(true)
    const { result } = renderHook(() => useThemePreference())
    expect(result.current.preference).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('applies and remembers an explicit choice', () => {
    mockSystemScheme(true)
    const { result } = renderHook(() => useThemePreference())
    act(() => result.current.setPreference('light'))
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('restores the remembered choice on the next visit', () => {
    mockSystemScheme(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useThemePreference())
    expect(result.current.preference).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

import { act, renderHook, waitFor } from '@test-utils'
import { applyThemeClasses, THEME_STORAGE_KEY, useTheme } from './theme'

// Controllable matchMedia stand-in: happy-dom implements matchMedia but gives
// tests no handle on prefers-color-scheme, so we stub a MediaQueryList whose
// matches flag the test flips (firing registered change listeners).
function stubMatchMedia(initialMatches: boolean): {
  setMatches: (next: boolean) => void
  listenerCount: () => number
} {
  let matches = initialMatches
  const listeners = new Set<() => void>()
  const mediaQueryList = {
    get matches(): boolean {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, listener: () => void): void => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: () => void): void => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQueryList as unknown as MediaQueryList),
  )
  return {
    setMatches: (next) => {
      matches = next
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

describe('applyThemeClasses', () => {
  it('toggles the dark class for explicit variants', () => {
    applyThemeClasses('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyThemeClasses('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('follows matchMedia for the system variant', () => {
    const media = stubMatchMedia(true)
    applyThemeClasses('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    media.setMatches(false)
    applyThemeClasses('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('useTheme', () => {
  it('defaults to dark (the VZ5 flagship) and applies the class', async () => {
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.data).toBe('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reads a stored variant and applies it', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.data).toBe('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back to dark for an unrecognized stored value', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.data).toBe('dark'))
  })

  it('re-applies on OS appearance changes while in system mode', async () => {
    const media = stubMatchMedia(false)
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    const { result, unmount } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.data).toBe('system'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    await waitFor(() => expect(media.listenerCount()).toBe(1))
    act(() => {
      media.setMatches(true)
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    unmount()
    expect(media.listenerCount()).toBe(0)
    act(() => {
      media.setMatches(false)
    })
    // Listener is gone: nothing re-applies after unmount.
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not register a system listener for explicit variants', async () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.data).toBe('dark'))
    expect(media.listenerCount()).toBe(0)
  })
})

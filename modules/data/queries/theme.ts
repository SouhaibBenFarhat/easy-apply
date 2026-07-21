import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { keys } from '../keys'

export type ThemeVariant = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'easyapply-theme'

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): ThemeVariant {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  // Dark is the flagship and the default (PLAN.md §5 — the VZ5 look is the
  // app's identity); anything unrecognized falls back to it.
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
}

export function applyThemeClasses(variant: ThemeVariant): void {
  const dark =
    variant === 'dark' || (variant === 'system' && window.matchMedia(SYSTEM_DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme(): UseQueryResult<ThemeVariant, Error> {
  const result = useQuery({
    queryKey: keys.settings.theme,
    queryFn: () => {
      const variant = readStoredTheme()
      applyThemeClasses(variant)
      return variant
    },
    // Theme only changes through useSetTheme (which writes the cache
    // directly), so the query is never stale.
    staleTime: Number.POSITIVE_INFINITY,
  })

  const variant = result.data

  // The queryFn is skipped when the value was restored by the persister, so
  // re-apply whenever the resolved variant changes.
  useEffect(() => {
    if (variant !== undefined) applyThemeClasses(variant)
  }, [variant])

  // While following the OS ('system'), live-track appearance changes.
  useEffect(() => {
    if (variant !== 'system') return undefined
    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    const onChange = (): void => applyThemeClasses('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [variant])

  return result
}

import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '../keys'
import type { ThemeVariant } from '../queries/theme'
import { applyThemeClasses, THEME_STORAGE_KEY } from '../queries/theme'

export function useSetTheme(): UseMutationResult<ThemeVariant, Error, ThemeVariant> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (variant: ThemeVariant) => {
      localStorage.setItem(THEME_STORAGE_KEY, variant)
      applyThemeClasses(variant)
      return variant
    },
    onSuccess: (variant) => {
      client.setQueryData(keys.settings.theme, variant)
    },
  })
}

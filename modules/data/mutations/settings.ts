import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useSetAppSettings(): UseMutationResult<AppSettings, Error, Partial<AppSettings>> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (update: Partial<AppSettings>) =>
      unwrap(await window.electron.settings.set(update)),
    onSuccess: async (settings) => {
      // The set handler returns the merged settings — seed the cache with
      // them, then invalidate so any concurrent reader reconciles.
      client.setQueryData(keys.settings.app, settings)
      await client.invalidateQueries({ queryKey: keys.settings.app })
    },
  })
}

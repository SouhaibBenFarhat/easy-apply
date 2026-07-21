import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SyncSummary } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useSyncNow(): UseMutationResult<SyncSummary, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.sync.now()),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.jobs.all }),
        client.invalidateQueries({ queryKey: keys.sync.status }),
      ])
    },
  })
}

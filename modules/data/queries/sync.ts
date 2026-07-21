import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { SyncStatus } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useSyncStatus(): UseQueryResult<SyncStatus, Error> {
  return useQuery({
    queryKey: keys.sync.status,
    queryFn: async () => unwrap(await window.electron.sync.status()),
    // Cheap poll so "last synced X min ago" stays honest even if a push
    // event was missed; sync:completed events invalidate immediately.
    refetchInterval: 30_000,
  })
}

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { Query } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'

export const PERSIST_STORAGE_KEY = 'easyapply-query-cache'
const PERSIST_MAX_AGE_MS = 30 * 24 * 3_600_000 // 30 days
const PERSIST_BUSTER = 'v1'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 24 * 3_600_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

// Persist ONLY the 'settings' and 'local' namespaces. Job data is never
// dehydrated: SQLite (read over IPC) IS the job cache — every feed/detail
// query must re-read it on startup so the renderer can never show stale rows
// that a background sync already replaced.
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false
  const namespace = query.queryKey[0]
  return namespace === 'settings' || namespace === 'local'
}

export function setupPersistence(client: QueryClient, storage: Storage = localStorage): void {
  const persister = createSyncStoragePersister({ storage, key: PERSIST_STORAGE_KEY })
  persistQueryClient({
    queryClient: client,
    persister,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: PERSIST_BUSTER,
    dehydrateOptions: { shouldDehydrateQuery },
  })
}

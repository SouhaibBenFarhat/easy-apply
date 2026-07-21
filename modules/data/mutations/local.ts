import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '../keys'
import { LAST_FEED_VISIT_STORAGE_KEY } from '../queries/local'

// Written on feed blur/visit (PR 12) — moves the "new since last visit"
// divider. localStorage is the source of truth; the cache write keeps every
// mounted useLastFeedVisit in step without a refetch.
export function useMarkFeedVisited(): UseMutationResult<string, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      localStorage.setItem(LAST_FEED_VISIT_STORAGE_KEY, now)
      return now
    },
    onSuccess: (now) => {
      client.setQueryData(keys.local.lastFeedVisit, now)
    },
  })
}

import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { keys } from '../keys'

export const LAST_FEED_VISIT_STORAGE_KEY = 'easyapply-last-feed-visit'

// Feeds the "new since last visit" divider: jobs with
// firstSeenAt > lastFeedVisitAt render above it (PLAN.md §4.6).
export function useLastFeedVisit(): UseQueryResult<string | null, Error> {
  return useQuery({
    queryKey: keys.local.lastFeedVisit,
    queryFn: () => localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY),
    // Only useMarkFeedVisited changes it, and that writes the cache directly.
    staleTime: Number.POSITIVE_INFINITY,
  })
}

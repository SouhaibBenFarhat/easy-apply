import type { FeedFilters, RemoteScope, SourceId, WorkMode } from '@sources/shared'
import { REMOTE_SCOPES, SOURCE_IDS, WORK_MODES } from '@sources/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { keys } from '../keys'

export const LAST_FEED_VISIT_STORAGE_KEY = 'easyapply-last-feed-visit'
export const FEED_FILTERS_STORAGE_KEY = 'easyapply-feed-filters'

// Loose pick of known fields — stale/garbage storage must never break the
// feed. `search` is deliberately absent: it's ephemeral intent, not config.
export function readStoredFeedFilters(): FeedFilters {
  try {
    const raw = localStorage.getItem(FEED_FILTERS_STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    const filters: FeedFilters = {}
    if (Array.isArray(record.workModes)) {
      const modes = record.workModes.filter((m): m is WorkMode =>
        (WORK_MODES as readonly string[]).includes(m as string),
      )
      if (modes.length > 0) filters.workModes = modes
    }
    if (Array.isArray(record.sources)) {
      const sources = record.sources.filter((s): s is SourceId =>
        (SOURCE_IDS as readonly string[]).includes(s as string),
      )
      if (sources.length > 0) filters.sources = sources
    }
    if (Array.isArray(record.remoteScopes)) {
      const scopes = record.remoteScopes.filter((s): s is RemoteScope =>
        (REMOTE_SCOPES as readonly string[]).includes(s as string),
      )
      if (scopes.length > 0) filters.remoteScopes = scopes
    }
    if (record.hasSalary === true) filters.hasSalary = true
    return filters
  } catch {
    return {}
  }
}

// The feed's remembered configuration (active tab, salary toggle, source
// selection) — survives restarts via localStorage; initialData avoids one
// unfiltered first render.
export function useStoredFeedFilters(): UseQueryResult<FeedFilters, Error> {
  return useQuery({
    queryKey: keys.local.feedFilters,
    queryFn: readStoredFeedFilters,
    initialData: readStoredFeedFilters,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

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

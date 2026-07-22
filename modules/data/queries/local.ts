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
    if (record.origin === 'agent' || record.origin === 'api') filters.origin = record.origin
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

export const PANEL_WIDTHS_STORAGE_KEY = 'easyapply-panel-widths'

// Remembered widths (px) of the resizable panels: the feed's job list and the
// agent activity panel.
export interface PanelWidths {
  jobs: number
  activity: number
}

export const DEFAULT_PANEL_WIDTHS: PanelWidths = { jobs: 420, activity: 320 }

function readWidth(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// Loose read — stale/garbage storage falls back to the defaults, never throws.
export function readStoredPanelWidths(): PanelWidths {
  try {
    const raw = localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY)
    if (raw === null) return DEFAULT_PANEL_WIDTHS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PANEL_WIDTHS
    const record = parsed as Record<string, unknown>
    return {
      jobs: readWidth(record.jobs, DEFAULT_PANEL_WIDTHS.jobs),
      activity: readWidth(record.activity, DEFAULT_PANEL_WIDTHS.activity),
    }
  } catch {
    return DEFAULT_PANEL_WIDTHS
  }
}

// Panel widths, remembered across restarts via localStorage.
export function useStoredPanelWidths(): UseQueryResult<PanelWidths, Error> {
  return useQuery({
    queryKey: keys.local.panelWidths,
    queryFn: readStoredPanelWidths,
    initialData: readStoredPanelWidths,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

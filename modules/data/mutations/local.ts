import type { FeedFilters } from '@sources/shared'
import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '../keys'
import {
  FEED_FILTERS_STORAGE_KEY,
  LAST_FEED_VISIT_STORAGE_KEY,
  PANEL_WIDTHS_STORAGE_KEY,
  type PanelWidths,
} from '../queries/local'

// Written on feed blur/visit (PR 12) — moves the "new since last visit"
// divider. localStorage is the source of truth; the cache write keeps every
// mounted useLastFeedVisit in step without a refetch.
// Persists the feed's remembered configuration (tab, salary toggle, source
// selection). `search` is stripped — typed queries never survive a restart.
export function useSetStoredFeedFilters(): UseMutationResult<FeedFilters, Error, FeedFilters> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (next) => {
      const { search: _ephemeral, ...persistable } = next
      localStorage.setItem(FEED_FILTERS_STORAGE_KEY, JSON.stringify(persistable))
      return persistable
    },
    onSuccess: (persisted) => {
      client.setQueryData(keys.local.feedFilters, persisted)
    },
  })
}

// Persists the resizable panel widths (job list, activity panel).
export function useSetStoredPanelWidths(): UseMutationResult<PanelWidths, Error, PanelWidths> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (next) => {
      localStorage.setItem(PANEL_WIDTHS_STORAGE_KEY, JSON.stringify(next))
      return next
    },
    onSuccess: (saved) => {
      client.setQueryData(keys.local.panelWidths, saved)
    },
  })
}

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

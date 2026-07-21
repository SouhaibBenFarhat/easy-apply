import type { FeedFilters, StoredJob } from '@sources/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useFeed(filters: FeedFilters = {}): UseQueryResult<StoredJob[], Error> {
  return useQuery({
    queryKey: keys.jobs.feed(filters),
    queryFn: async () => unwrap(await window.electron.db.jobs.list(filters)),
    // Filter changes change the key; keep the previous rows on screen while
    // the new query resolves so the feed never blanks once populated
    // (PLAN.md §4.8/§6 anti-flash rule).
    placeholderData: keepPreviousData,
  })
}

export function useJob(id: string | null): UseQueryResult<StoredJob | null, Error> {
  return useQuery({
    // '' is a placeholder key segment while disabled; the queryFn never runs
    // without a real id (enabled gates it).
    queryKey: keys.jobs.detail(id ?? ''),
    queryFn: async () => {
      if (id === null) throw new Error('useJob queryFn ran without an id')
      return unwrap(await window.electron.db.jobs.get(id))
    },
    enabled: id !== null,
  })
}

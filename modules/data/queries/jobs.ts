import type { FeedFilters, StoredJob } from '@sources/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useFeed(filters: FeedFilters = {}): UseQueryResult<StoredJob[], Error> {
  return useQuery({
    queryKey: keys.jobs.feed(filters),
    queryFn: async () => unwrap(await window.electron.db.jobs.list(filters)),
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

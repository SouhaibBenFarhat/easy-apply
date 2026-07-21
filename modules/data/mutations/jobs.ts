import type { JobStatus, StoredJob } from '@sources/shared'
import type { QueryKey, UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export interface SetJobStatusVariables {
  id: string
  status: JobStatus | null
}

export interface SetJobNotesVariables {
  id: string
  notes: string | null
}

export interface SetJobHiddenVariables {
  id: string
  hidden: boolean
}

// Snapshot of every cached entry under keys.jobs.all, taken before the
// optimistic patch so onError can restore it verbatim.
interface JobsCacheSnapshot {
  entries: Array<[QueryKey, unknown]>
}

function isStoredJob(value: unknown): value is StoredJob {
  return typeof value === 'object' && value !== null && 'id' in value && 'status' in value
}

// Optimistic: the status pill must flip instantly in the feed, the tracker
// AND the open detail pane — so every cached list and detail entry under
// keys.jobs.all is patched, then re-read from SQLite on settle.
export function useSetJobStatus(): UseMutationResult<
  StoredJob | null,
  Error,
  SetJobStatusVariables
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: SetJobStatusVariables) =>
      unwrap(await window.electron.db.jobs.setStatus(id, status)),
    onMutate: async ({ id, status }: SetJobStatusVariables): Promise<JobsCacheSnapshot> => {
      // Stop in-flight refetches from clobbering the optimistic patch.
      await client.cancelQueries({ queryKey: keys.jobs.all })
      const entries = client.getQueriesData({ queryKey: keys.jobs.all })
      const statusUpdatedAt = new Date().toISOString()
      for (const [queryKey, data] of entries) {
        if (Array.isArray(data)) {
          client.setQueryData(
            queryKey,
            data.map((job) =>
              isStoredJob(job) && job.id === id ? { ...job, status, statusUpdatedAt } : job,
            ),
          )
        } else if (isStoredJob(data) && data.id === id) {
          client.setQueryData(queryKey, { ...data, status, statusUpdatedAt })
        }
      }
      return { entries }
    },
    onError: (_error, _variables, context) => {
      if (context === undefined) return
      for (const [queryKey, data] of context.entries) {
        client.setQueryData(queryKey, data)
      }
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: keys.jobs.all })
    },
  })
}

export function useSetJobNotes(): UseMutationResult<StoredJob | null, Error, SetJobNotesVariables> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: SetJobNotesVariables) =>
      unwrap(await window.electron.db.jobs.setNotes(id, notes)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.jobs.all })
    },
  })
}

export function useSetJobHidden(): UseMutationResult<
  StoredJob | null,
  Error,
  SetJobHiddenVariables
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, hidden }: SetJobHiddenVariables) =>
      unwrap(await window.electron.db.jobs.setHidden(id, hidden)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.jobs.all })
    },
  })
}

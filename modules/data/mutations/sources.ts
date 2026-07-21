import type { SourceId } from '@sources/shared'
import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SourceInfo } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export interface SetSourceEnabledVariables {
  sourceId: SourceId
  enabled: boolean
}

export interface SetSourceKeyVariables {
  sourceId: SourceId
  values: Record<string, string>
}

export interface ClearSourceKeyVariables {
  sourceId: SourceId
}

export function useSetSourceEnabled(): UseMutationResult<
  SourceInfo,
  Error,
  SetSourceEnabledVariables
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId, enabled }: SetSourceEnabledVariables) =>
      unwrap(await window.electron.sources.setEnabled(sourceId, enabled)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.sources.list })
    },
  })
}

export function useSetSourceKey(): UseMutationResult<SourceInfo, Error, SetSourceKeyVariables> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId, values }: SetSourceKeyVariables) =>
      unwrap(await window.electron.sources.setKey(sourceId, values)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.sources.list })
    },
  })
}

export function useClearSourceKey(): UseMutationResult<SourceInfo, Error, ClearSourceKeyVariables> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId }: ClearSourceKeyVariables) =>
      unwrap(await window.electron.sources.clearKey(sourceId)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.sources.list })
    },
  })
}

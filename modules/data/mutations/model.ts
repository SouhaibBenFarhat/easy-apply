import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ModelStatus } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

// Starts the (fire-and-forget) model download; progress then streams via
// useModelProgress and the final state via a model:status refetch.
export function useDownloadModel(): UseMutationResult<ModelStatus, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.model.download()),
    onSuccess: (status) => {
      client.setQueryData(keys.model.status, status)
    },
  })
}

export function useCancelModelDownload(): UseMutationResult<ModelStatus, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.model.cancel()),
    onSuccess: (status) => {
      client.setQueryData(keys.model.status, status)
    },
  })
}

// Deletes the installed model to reclaim disk; status returns to 'absent'.
export function useRemoveModel(): UseMutationResult<ModelStatus, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.model.remove()),
    onSuccess: (status) => {
      client.setQueryData(keys.model.status, status)
    },
  })
}

// Switches the active local model (e.g. Llama 8B → DeepSeek 14B). Cancels any
// in-flight download and unloads the current model to free RAM; the picked
// model's status returns.
export function useSelectModel(): UseMutationResult<ModelStatus, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (modelId: string) => unwrap(await window.electron.model.select(modelId)),
    onSuccess: (status) => {
      client.setQueryData(keys.model.status, status)
    },
  })
}

// Turns the on-device AI on/off. Off unloads the model to free RAM (the model
// file stays on disk); the mailbox source then skips email reading.
export function useSetModelEnabled(): UseMutationResult<ModelStatus, Error, boolean> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) => unwrap(await window.electron.model.setEnabled(enabled)),
    onSuccess: (status) => {
      client.setQueryData(keys.model.status, status)
    },
  })
}

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ModelStatus } from '../../../src/preload/electron-api'
import { keys } from '../keys'

// Mounted where the model UI lives: turns 'model:progress' push events into
// live cache updates — chunk events patch downloadedBytes onto the cached
// status so the progress bar moves, and the terminal { done } refetches the
// final state (ready / error / absent).
export function useModelProgress(): void {
  const client = useQueryClient()
  useEffect(() => {
    return window.electron.model.onProgress((event) => {
      if (event.done) {
        void client.invalidateQueries({ queryKey: keys.model.status })
        return
      }
      client.setQueryData<ModelStatus>(keys.model.status, (prev) =>
        prev === undefined
          ? prev
          : {
              ...prev,
              state: 'downloading',
              downloadedBytes: event.downloadedBytes,
              totalBytes: event.totalBytes,
            },
      )
    })
  }, [client])
}

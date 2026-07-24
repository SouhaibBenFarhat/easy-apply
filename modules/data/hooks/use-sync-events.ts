import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { SyncEvent } from '../../../src/preload/electron-api'
import { keys } from '../keys'

// Generic push-event subscription. The handler lives in a ref so consumers
// can pass inline closures without resubscribing the bridge listener on
// every render; the subscription itself lasts for the component's lifetime.
export function useSyncEvents(handler: (event: SyncEvent) => void): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    return window.electron.sync.onEvent((event) => {
      handlerRef.current(event)
    })
  }, [])
}

// Mounted once in the shell: a completed sync pass re-reads everything that
// could have changed — job rows, sync status, per-source lastSyncAt.
export function useSyncEventInvalidation(): void {
  const client = useQueryClient()
  useSyncEvents((event) => {
    if (event.type !== 'sync:completed') return
    void client.invalidateQueries({ queryKey: keys.jobs.all })
    void client.invalidateQueries({ queryKey: keys.sync.status })
    void client.invalidateQueries({ queryKey: keys.sources.list })
    // The just-finished run is now in history — refresh the Runs list.
    void client.invalidateQueries({ queryKey: keys.agent.runs })
  })
}

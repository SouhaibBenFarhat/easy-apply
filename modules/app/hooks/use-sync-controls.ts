import { useSyncNow, useSyncStatus } from '@data'
import { useToast } from '@ui-kit'
import { useCallback } from 'react'
import { formatSyncToast } from '../format-sync-toast'

export interface SyncControls {
  syncing: boolean
  onSyncNow: () => void
}

// Header sync state: spinning while a pass runs — whether this window
// triggered it (mutation pending) or the scheduler did (status.running).
export function useSyncControls(): SyncControls {
  const status = useSyncStatus()
  const { mutate, isPending } = useSyncNow()
  const { toast } = useToast()

  const onSyncNow = useCallback(() => {
    if (isPending) return
    mutate(undefined, {
      onSuccess: (summary) => {
        toast({ title: 'Sync complete', description: formatSyncToast(summary) })
      },
      onError: (error) => {
        toast({ title: 'Sync failed', description: error.message, variant: 'destructive' })
      },
    })
  }, [isPending, mutate, toast])

  return {
    syncing: (status.data?.running ?? false) || isPending,
    onSyncNow,
  }
}

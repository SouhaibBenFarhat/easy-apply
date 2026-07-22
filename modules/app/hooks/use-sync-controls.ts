import type { AgentState } from '@data'
import { useAgentState, usePauseAgent, useResumeAgent, useStopAgent, useSyncNow } from '@data'
import { useToast } from '@ui-kit'
import { useCallback } from 'react'
import { formatSyncToast } from '../format-sync-toast'

export interface SyncControls {
  /** Authoritative transport state from the main process. */
  state: AgentState
  onSyncNow: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

// The header's transport surface, mirroring the pipeline panel's. State comes
// from main rather than being inferred from `sync:status.running`: a held pass
// is still "running" by that measure, which is exactly why the old spinner kept
// turning after a pause.
export function useSyncControls(): SyncControls {
  const state = useAgentState().data ?? 'idle'
  const { mutate, isPending } = useSyncNow()
  const pause = usePauseAgent()
  const resume = useResumeAgent()
  const stop = useStopAgent()
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

  const onPause = useCallback(() => pause.mutate(), [pause.mutate])
  const onResume = useCallback(() => resume.mutate(), [resume.mutate])
  const onStop = useCallback(() => stop.mutate(), [stop.mutate])

  return { state, onSyncNow, onPause, onResume, onStop }
}

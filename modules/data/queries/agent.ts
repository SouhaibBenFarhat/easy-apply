import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  AgentRunSummary,
  AgentState,
  AgentTraceEvent,
} from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

// The agent's transport state, owned by the main process. Read once on mount so
// a panel opened mid-pass is immediately correct, then kept live by the
// 'agent:state-changed' push — never polled, and never guessed at from timings
// in the renderer.
//
// The state matters most around 'pausing': the scan holds only BETWEEN emails,
// so after a pause is requested a local model can spend minutes finishing the
// email in flight. Without that distinct state the controls looked broken.
export function useAgentState(): UseQueryResult<AgentState, Error> {
  const client = useQueryClient()

  useEffect(() => {
    return window.electron.agent.onStateChange((state) => {
      client.setQueryData(keys.agent.state, state)
    })
  }, [client])

  return useQuery({
    queryKey: keys.agent.state,
    queryFn: async () => unwrap(await window.electron.agent.state()),
    // Pushes are the update path; a refetch would only ever confirm them.
    staleTime: Number.POSITIVE_INFINITY,
  })
}

// Persisted run history for the Runs page. A completed sync invalidates this
// (use-sync-events), so a finished run appears without a manual refresh.
export function useAgentRuns(): UseQueryResult<AgentRunSummary[], Error> {
  return useQuery({
    queryKey: keys.agent.runs,
    queryFn: async () => unwrap(await window.electron.agent.runs()),
  })
}

// The steps of one past run, shaped as trace events so the Runs page renders
// them with the same timeline components as the live panel. Disabled until a
// run is selected.
export function useAgentRunSteps(runId: number | null): UseQueryResult<AgentTraceEvent[], Error> {
  return useQuery({
    queryKey: keys.agent.runSteps(runId ?? -1),
    queryFn: async () => {
      if (runId === null) throw new Error('useAgentRunSteps ran without a run id')
      return unwrap(await window.electron.agent.runSteps(runId))
    },
    enabled: runId !== null,
    // A finished run is immutable — its steps never change once written.
    staleTime: Number.POSITIVE_INFINITY,
  })
}

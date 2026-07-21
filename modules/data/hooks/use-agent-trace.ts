import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { AgentTraceEvent } from '../../../src/preload/electron-api'
import { keys } from '../keys'

const MAX_TRACE = 300

// Mounted once (in the shell): collects 'agent:trace' push events into the
// cache — the live window into what the agent/LLM is doing. Capped so a long
// run doesn't grow unbounded; not persisted, so it resets each launch.
export function useAgentTraceCollector(): void {
  const client = useQueryClient()
  useEffect(() => {
    return window.electron.agent.onTrace((event) => {
      client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, (prev = []) =>
        [...prev, event].slice(-MAX_TRACE),
      )
    })
  }, [client])
}

// Reads the collected trace for the header monitor panel.
export function useAgentTrace(): UseQueryResult<AgentTraceEvent[], Error> {
  return useQuery({
    queryKey: keys.agent.trace,
    queryFn: () => [] as AgentTraceEvent[],
    initialData: () => [] as AgentTraceEvent[],
    staleTime: Number.POSITIVE_INFINITY,
  })
}

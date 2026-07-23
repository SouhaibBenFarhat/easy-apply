import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { AgentTraceEvent } from '../../../src/preload/electron-api'
import { keys } from '../keys'

const MAX_TRACE = 300

// Mounted once (in the shell): collects 'agent:trace' push events into the
// cache — the live window into what the agent/LLM is doing. Capped so a long
// run doesn't grow unbounded; not persisted, so it resets each launch.
export function useAgentTraceCollector(): void {
  const client = useQueryClient()
  // Last kept-jobs total seen, to spot the moment new jobs land.
  const kept = useRef(0)

  useEffect(() => {
    return window.electron.agent.onTrace((event) => {
      client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, (prev = []) =>
        // seq restarts at 0 for each pass (src/main/sync.ts): a new run starts
        // a fresh timeline instead of appending to the previous run's.
        event.seq === 0 ? [event] : [...prev, event].slice(-MAX_TRACE),
      )
      // The mailbox agent upserts each email's jobs as it goes, but the only
      // invalidation used to be on 'sync:completed' — so a scan that takes an
      // hour left the feed looking empty for that whole hour. Re-read as soon
      // as the funnel reports jobs actually kept. A drop means a new run
      // started counting from zero, not that rows vanished.
      const total = event.stats?.jobsKept
      if (total === undefined) return
      if (total > kept.current) void client.invalidateQueries({ queryKey: keys.jobs.all })
      kept.current = total
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

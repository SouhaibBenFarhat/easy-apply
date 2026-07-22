import type { AgentTraceJob } from '@data'
import { ExternalLink } from 'lucide-react'
import type { ReactElement } from 'react'

export interface TraceJobsProps {
  jobs: AgentTraceJob[]
}

// The jobs one email actually yielded, listed under its verdict row. A count
// alone ("2 job(s)") is unauditable — you cannot tell a good extraction from a
// hallucinated one. Each row opens the real posting so the agent's judgement
// can be checked against the source.
//
// Recessed one step below the panel body (§visual-hierarchy) so the group reads
// as evidence attached to the row above, not as more timeline.
export function TraceJobs({ jobs }: TraceJobsProps): ReactElement | null {
  if (jobs.length === 0) return null
  return (
    <ul className="mt-1 space-y-px overflow-hidden rounded-md border border-border bg-input">
      {jobs.map((job) => (
        <li key={job.id}>
          {/* Renderer never navigates: the window-open guards (PLAN.md §4.9)
              intercept this and hand it to shell.openExternal. */}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            title={`Open posting: ${job.title} — ${job.company}`}
            className="flex items-center gap-1.5 px-2 py-1.5 transition-colors hover:bg-interactive-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.7rem] font-medium leading-tight">
                {job.title}
              </span>
              <span className="block truncate text-[0.65rem] leading-tight text-foreground-subtle">
                {job.company}
              </span>
            </span>
            <ExternalLink className="size-3 shrink-0 text-foreground-ghost" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}

import type { AgentTraceJob } from '@data'
import { cn } from '@ui-kit'
import { MapPin, Sparkles } from 'lucide-react'
import type { ReactElement } from 'react'

export interface TraceJobsProps {
  jobs: AgentTraceJob[]
}

// Hairline icons so they carry the same optical weight as the caps text they
// prefix (the feed uses the same 1.5 stroke).
const META_ICON_STROKE = 1.5

// The jobs one email actually yielded, listed under its verdict row. A count
// alone ("2 job(s)") is unauditable — you cannot tell a good extraction from a
// hallucinated one. Each card opens the real posting so the agent's judgement
// can be checked against the source.
//
// These are the SAME card as the feed (JobList), just compact: the house card
// treatment (raised surface, real edge, low shadow) with the feed's meta lines
// — MapPin place, Sparkles source · company — at a smaller size for the panel.
export function TraceJobs({ jobs }: TraceJobsProps): ReactElement | null {
  if (jobs.length === 0) return null
  return (
    <ul className="mt-2 space-y-2.5">
      {jobs.map((job) => (
        <li key={job.id}>
          {/* Renderer never navigates: the window-open guards (PLAN.md §4.9)
              intercept this and hand it to shell.openExternal. */}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            title={`Open posting: ${job.title} — ${job.company}`}
            className={cn(
              'flex flex-col gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5',
              'shadow-elevation-low transition-colors hover:bg-interactive-hover',
            )}
          >
            <span className="truncate text-xs font-medium leading-tight">{job.title}</span>
            {/* Line 2 — place. Omitted (with its pin) when the job has none, so
                there's never a lone icon. */}
            {job.location !== null && job.location !== '' ? (
              <span className="label-caps flex w-full items-center gap-1 normal-case leading-none tracking-[0.02em]">
                <MapPin aria-hidden className="size-2.5 shrink-0" strokeWidth={META_ICON_STROKE} />
                <span className="min-w-0 truncate">{job.location}</span>
              </span>
            ) : null}
            {/* Line 3 — source · company. Inbox finds carry the info sparkle,
                the same accent the feed gives agent-sourced rows. */}
            <span className="label-caps flex w-full items-center gap-1 normal-case leading-none tracking-[0.02em]">
              <Sparkles
                aria-label="Found by the inbox agent"
                className="size-2.5 shrink-0 text-info"
                strokeWidth={META_ICON_STROKE}
              />
              <span className="min-w-0 truncate">
                {job.source} · {job.company}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

import type { AgentPipelineStats, AgentState } from '@data'
import { cn, TransportControl } from '@ui-kit'
import { Mail } from 'lucide-react'
import type { ReactElement } from 'react'

function StatChip({
  dot,
  label,
  value,
}: {
  dot: string
  label: string
  value: number
}): ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      <span className="text-foreground-muted">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  )
}

export interface PipelineFunnelProps {
  stats: AgentPipelineStats
  /** Authoritative transport state from the main process. */
  state: AgentState
  onStop: () => void
  onPause: () => void
  onResume: () => void
}

// The chip beside the PIPELINE label — the run's own status, in words.
const STATE_LABEL: Record<AgentState, string | null> = {
  idle: null,
  running: null,
  pausing: 'pausing…',
  paused: 'paused',
}

// The email→job funnel for the agent monitor: a live progress bar over emails
// scanned plus the accepted/rejected and proposed/kept counts. A grouped section
// lifted one step off the panel body (§visual-hierarchy): `surface` +
// `border-border` + radius + a `label-caps` header. Uses info/success/muted —
// never copper (scarce). While a run is in progress it offers a Stop to cut the
// (slow) scan.
export function PipelineFunnel({
  stats,
  state,
  onStop,
  onPause,
  onResume,
}: PipelineFunnelProps): ReactElement {
  const pct =
    stats.emailsTotal === 0 ? 0 : Math.round((stats.emailsProcessed / stats.emailsTotal) * 100)
  // The transport state is authoritative — the funnel's own `done` flag lags a
  // stopped run and says nothing at all about a pause that is still winding
  // down, which is what made the old controls unreadable.
  const active = state !== 'idle'
  const stateLabel = STATE_LABEL[state]

  return (
    <div className="shrink-0 px-3 pt-3">
      <section className="rounded-lg border border-border bg-surface p-3" aria-label="Pipeline">
        <div className="mb-2 flex items-center gap-2">
          <span className="label-caps">Pipeline</span>
          {stats.capped ? (
            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-warning">
              capped
            </span>
          ) : null}
          {stateLabel !== null ? (
            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-warning">
              {stateLabel}
            </span>
          ) : null}
          <span className="ml-auto text-xs tabular-nums text-foreground-subtle">
            {stats.emailsProcessed} / {stats.emailsTotal}
          </span>
          <TransportControl state={state} onPause={onPause} onResume={onResume} onStop={onStop} />
        </div>
        {/* Progress groove — info while running, warning while held or winding
            down, success when finished (copper stays scarce). */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-label="Emails processed"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              !active ? 'bg-success' : state === 'running' ? 'bg-info' : 'bg-warning',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* The email under analysis right now — subject (links to Gmail when we
            have a message-id) + sender. */}
        {stats.current !== null ? (
          <div className="mb-8 mt-5 flex items-start gap-1.5">
            <Mail className="mt-0.5 size-3 shrink-0 text-foreground-subtle" aria-hidden />
            <div className="min-w-0 text-xs">
              {stats.current.url !== null ? (
                <a
                  href={stats.current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-medium transition-colors hover:text-primary"
                  title={`Open in Gmail: ${stats.current.subject}`}
                >
                  {stats.current.subject === '' ? '(no subject)' : stats.current.subject}
                </a>
              ) : (
                <div className="truncate font-medium" title={stats.current.subject}>
                  {stats.current.subject === '' ? '(no subject)' : stats.current.subject}
                </div>
              )}
              <div className="mt-2 truncate text-foreground-subtle" title={stats.current.sender}>
                {stats.current.sender}
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <StatChip dot="bg-success" label="Accepted" value={stats.emailsAccepted} />
          <StatChip dot="bg-foreground-ghost" label="Rejected" value={stats.emailsRejected} />
          <StatChip dot="bg-info" label="Jobs found" value={stats.jobsProposed} />
          <StatChip dot="bg-success" label="Kept" value={stats.jobsKept} />
        </div>
      </section>
    </div>
  )
}

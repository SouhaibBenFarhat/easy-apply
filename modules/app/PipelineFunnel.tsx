import type { AgentPhase, AgentPipelineStats, AgentState } from '@data'
import { cn, TransportControl } from '@ui-kit'
import { Mail } from 'lucide-react'
import type { ReactElement } from 'react'
import { formatElapsedClock } from './format-duration'
import { useElapsedSince } from './hooks/use-elapsed-since'

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
  /**
   * When the current step began (the newest stats event's main-stamped
   * timestamp) — drives the live clock beside the in-flight email.
   */
  stepStartedAt?: string
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

// What the agent is doing right now, in the user's words rather than ours.
const PHASE_LABEL: Record<AgentPhase, string> = {
  reading: 'Reading inbox',
  triaging: 'Triaging',
  downloading: 'Downloading',
  scanning: 'Scanning',
  done: 'Finished',
}

// The bar shows REAL progress in whichever unit the current phase counts in:
// emails while scanning (row-based), and the phase's own units otherwise —
// inboxes read, triage batches judged, inboxes downloaded (step-based).
//
// An indeterminate sweep is the last resort, not the default: it appears only
// when a phase genuinely has no total yet, which lasts a moment at most. A bar
// that sweeps through an entire run tells the user nothing.
interface Progress {
  determinate: boolean
  pct: number
  // What to show where the count goes: "37 / 60", "2 / 4 batches", or the
  // phase name while a total is still unknown.
  readout: string
}

function progressOf(stats: AgentPipelineStats, phaseLabel: string): Progress {
  const rowBased = stats.phase === 'scanning' || stats.phase === 'done'
  const done = rowBased ? stats.emailsProcessed : stats.phaseDone
  const total = rowBased ? stats.emailsTotal : stats.phaseTotal
  if (total <= 0) return { determinate: false, pct: 0, readout: phaseLabel }
  return {
    determinate: true,
    pct: Math.min(100, Math.round((done / total) * 100)),
    readout: `${done} / ${total}`,
  }
}

// The email→job funnel for the agent monitor: a live progress bar over emails
// scanned plus the accepted/rejected and proposed/kept counts. A grouped section
// lifted one step off the panel body (§visual-hierarchy): `surface` +
// `border-border` + radius + a `label-caps` header. Uses info/success/muted —
// never copper (scarce). While a run is in progress it offers a Stop to cut the
// (slow) scan.
export function PipelineFunnel({
  stats,
  stepStartedAt,
  state,
  onStop,
  onPause,
  onResume,
}: PipelineFunnelProps): ReactElement {
  // The transport state is authoritative — the funnel's own `done` flag lags a
  // stopped run and says nothing at all about a pause that is still winding
  // down, which is what made the old controls unreadable.
  const active = state !== 'idle'
  const stateLabel = STATE_LABEL[state]
  const phaseLabel = PHASE_LABEL[stats.phase]
  const { determinate, pct, readout } = progressOf(stats, phaseLabel)
  // Live "running for" clock on the in-flight email — the front-and-center
  // counterpart of the timeline rows' stopwatch. Ticks while the step genuinely
  // executes ('pausing' still is: the model holds only at the next checkpoint);
  // a held or finished run shows nothing.
  const stepMs = useElapsedSince(
    stepStartedAt ?? '',
    (state === 'running' || state === 'pausing') &&
      stepStartedAt !== undefined &&
      stats.current !== null,
  )

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
          {/* The phase is always named; the count sits beside it once the
              phase has a total, so the two never compete for the same slot. */}
          <span className="ml-auto truncate text-[0.65rem] uppercase tracking-wide text-foreground-subtle">
            {phaseLabel}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">{readout}</span>
          <TransportControl state={state} onPause={onPause} onResume={onResume} onStop={onStop} />
        </div>
        {/* Progress groove — info while running, warning while held or winding
            down, success when finished (copper stays scarce). Before scanning
            there is no total to fill toward, so the band sweeps instead: the
            phase is genuinely working, and a bar stuck at 0% would say
            otherwise. */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-label={determinate ? `${phaseLabel} progress` : phaseLabel}
          {...(determinate
            ? { 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }
            : {})}
        >
          <div
            className={cn(
              'h-full rounded-full',
              determinate ? 'transition-[width]' : 'w-1/3 animate-progress-sweep',
              !active ? 'bg-success' : state === 'running' ? 'bg-info' : 'bg-warning',
            )}
            {...(determinate ? { style: { width: `${pct}%` } } : {})}
          />
        </div>
        {/* The email under analysis right now — subject (links to Gmail when we
            have a message-id) + sender. */}
        {stats.current !== null ? (
          <div className="mb-8 mt-5 flex items-start gap-1.5">
            <Mail className="mt-0.5 size-3 shrink-0 text-foreground-subtle" aria-hidden />
            <div className="min-w-0 flex-1 text-xs">
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
            {stepMs !== null ? (
              <span
                role="timer"
                aria-label="Current step running for"
                className={cn(
                  'ml-2 shrink-0 text-xs font-semibold tabular-nums',
                  // The clock wears the run's accent: info while executing,
                  // warning while a pause winds down — never copper.
                  state === 'running' ? 'text-info' : 'text-warning',
                )}
              >
                {formatElapsedClock(stepMs)}
              </span>
            ) : null}
          </div>
        ) : null}
        {/* Two units, said out loud. The old 2×2 grid counted EMAILS on one row
            and JOBS on the other with nothing to say so, and gave "Accepted"
            and "Kept" the same green — which read as one measure counted twice. */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <span className="label-caps col-span-2">Emails</span>
          <StatChip dot="bg-success" label="Accepted" value={stats.emailsAccepted} />
          <StatChip dot="bg-foreground-ghost" label="Rejected" value={stats.emailsRejected} />
          <span className="label-caps col-span-2 mt-1.5">Jobs</span>
          <StatChip dot="bg-info" label="Found" value={stats.jobsProposed} />
          <StatChip dot="bg-success" label="Kept" value={stats.jobsKept} />
        </div>
      </section>
    </div>
  )
}

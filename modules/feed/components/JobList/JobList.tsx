import type { JobStatus, StoredJob } from '@sources/shared'
import { isAgentSource } from '@sources/shared'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BadgeProps } from '@ui-kit'
import { Badge, cn, formatRelativeTime } from '@ui-kit'
import { Sparkles } from 'lucide-react'
import type { CSSProperties, ReactElement } from 'react'
import { useMemo, useRef, useState } from 'react'
import { formatSalary, remoteScopeLabel, workModeLabel } from '../../lib/format'

export interface JobListProps {
  jobs: StoredJob[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** ISO timestamp of the previous feed visit; jobs first seen after it are "new". */
  newSince: string | null
  /** sourceId → displayName, for the source chip. */
  sourceNames: Record<string, string>
}

type Row = { kind: 'divider' } | { kind: 'job'; job: StoredJob; jobIndex: number }

type BadgeVariant = NonNullable<BadgeProps['variant']>

const STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  applied: 'success',
  interview: 'info',
  interested: 'warning',
  rejected: 'destructive',
}

const STATUS_LABELS: Record<JobStatus, string> = {
  interested: 'Interested',
  applied: 'Applied',
  interview: 'Interview',
  rejected: 'Rejected',
}

const DIVIDER_SIZE = 32
// Two-line row: py-2 (16) + title line (20) + gap (6) + meta line (~16) ≈ 58.
const ROW_SIZE = 64
// Rows with a salary carry a third line (copper figure) — sized per row via
// estimateSize, the same mechanism the divider row uses.
const SALARY_ROW_SIZE = 84

function hasSalary(job: StoredJob): boolean {
  return job.salary.min !== null || job.salary.max !== null
}

// §5.5 — the staggered fade+rise entrance runs once per app launch, never on
// refetch, filter change or scroll. Module scope survives remounts.
let entrancePlayed = false

// Insert the "new since last visit" divider before the first job that is NOT
// new (firstSeenAt <= newSince). The feed is newest-first; the divider renders
// only when both groups are non-empty.
function buildRows(jobs: StoredJob[], newSince: string | null): Row[] {
  const rows: Row[] = jobs.map((job, jobIndex) => ({ kind: 'job', job, jobIndex }))
  if (newSince === null) return rows
  const split = jobs.findIndex((job) => job.firstSeenAt <= newSince)
  if (split <= 0) return rows
  rows.splice(split, 0, { kind: 'divider' })
  return rows
}

export function JobList({
  jobs,
  selectedId,
  onSelect,
  newSince,
  sourceNames,
}: JobListProps): ReactElement {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const rows = useMemo(() => buildRows(jobs, newSince), [jobs, newSince])

  // Read-and-latch on first mount: only the mount that flips the flag plays
  // the entrance, and only for the rows visible at that moment.
  const [animateEntrance] = useState(() => {
    if (entrancePlayed) return false
    entrancePlayed = true
    return true
  })

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (row === undefined || row.kind === 'divider') return DIVIDER_SIZE
      return hasSalary(row.job) ? SALARY_ROW_SIZE : ROW_SIZE
    },
    getItemKey: (index) => {
      const row = rows[index]
      return row === undefined || row.kind === 'divider' ? 'new-divider' : row.job.id
    },
    overscan: 8,
    // Rows are fixed-height (no measureElement), so the only rect consumer is
    // the visible-range math; a static initial rect also lets happy-dom tests
    // render rows despite the zero-size layout.
    initialRect: { width: 420, height: 600 },
  })

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined) return null
          const style: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: item.size,
            transform: `translateY(${item.start}px)`,
          }
          if (row.kind === 'divider') {
            return (
              <div
                key={item.key}
                style={style}
                className="flex items-end border-t border-primary/40 px-3 pb-1 animate-fade-in"
              >
                <span className="label-caps text-primary">New since your last visit</span>
              </div>
            )
          }
          const { job, jobIndex } = row
          const salary = formatSalary(job.salary)
          const selected = job.id === selectedId
          const stagger = animateEntrance && jobIndex < 10
          // One place token, zero redundancy: remote rows show the SCOPE as
          // their place (the mode slot already says REMOTE — never echo it,
          // and multi-country restriction lists are noise); on-site/hybrid
          // rows show the city.
          const scopeLabel = job.remoteScope !== null ? remoteScopeLabel(job.remoteScope) : null
          const rawPlace = job.city ?? job.locationRaw
          const bareRemotePlace = /^remote$/i.test(rawPlace.trim()) || /anywhere/i.test(rawPlace)
          const place =
            job.workMode === 'remote'
              ? (scopeLabel ?? (bareRemotePlace ? null : rawPlace))
              : rawPlace
          const metaLeft = place === null ? job.company : `${job.company} · ${place}`
          const metaRight = `${formatRelativeTime(job.postedAt ?? job.firstSeenAt)} · ${sourceNames[job.sourceId] ?? job.sourceId}`
          // Jobs the inbox agent extracted get a sparkle accent (info, never
          // copper — copper stays scarce).
          const fromAgent = isAgentSource(job.sourceId)
          return (
            <div key={item.key} style={style}>
              <button
                type="button"
                data-selected={selected}
                onClick={() => onSelect(job.id)}
                className={cn(
                  // §5.4 — flat row: hairline divider, background-change hover
                  // only, no transforms inside the scrolling list.
                  'relative flex h-full w-full flex-col justify-center gap-1 overflow-hidden',
                  'border-b border-border-subtle px-3 py-2 text-left transition-colors',
                  'hover:bg-interactive-hover',
                  selected && 'bg-primary/10',
                  stagger && 'animate-rise-in',
                )}
                style={stagger ? { animationDelay: `${jobIndex * 30}ms` } : undefined}
              >
                {selected ? (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                ) : null}
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'min-w-0 truncate text-sm font-medium',
                      selected && 'text-primary',
                    )}
                  >
                    {job.title}
                  </span>
                  {job.status !== null ? (
                    <Badge variant={STATUS_VARIANTS[job.status]} className="ml-auto shrink-0">
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  ) : null}
                </span>
                {/* §5.4 scannability: a fixed-width mode slot keeps every row's
                    meta starting at the same x — no chip zigzag. */}
                {/* Time + source are right-anchored and never truncate; the
                    company/place group absorbs all the squeeze. */}
                {/* Tight tracking (label-caps defaults to 0.18em, which eats
                    horizontal room) + a slim mode slot + small gaps, so the
                    company/place shows as much as possible before truncating. */}
                <span className="label-caps flex w-full items-baseline gap-1.5 tracking-[0.02em]">
                  <span className="w-14 shrink-0">{workModeLabel(job.workMode)}</span>
                  <span className="min-w-0 flex-1 truncate">{metaLeft}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {fromAgent ? (
                      <Sparkles
                        className="size-3 text-info"
                        aria-label="Found by the inbox agent"
                      />
                    ) : null}
                    {metaRight}
                  </span>
                </span>
                {salary !== null ? (
                  // Third line: the salary as plain copper text — the figure
                  // is the signal, no chip (§5.1 copper scarcity).
                  <span className="text-xs font-semibold tabular-nums text-primary">{salary}</span>
                ) : null}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

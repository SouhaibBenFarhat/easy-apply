import type { JobStatus, StoredJob } from '@sources/shared'
import { isAgentSource } from '@sources/shared'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BadgeProps } from '@ui-kit'
import { Badge, cn, formatRelativeTime, ScrollArea } from '@ui-kit'
import { MapPin, Plug, Sparkles } from 'lucide-react'
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

// Lucide draws at a 2px stroke by default, which reads as a blob at 12px —
// the meta icons go hairline so they carry the same optical weight as the
// quiet caps text they prefix.
const META_ICON_STROKE = 1.5

const DIVIDER_SIZE = 32
// Card slot: 10px gutter + bordered card (borders 2 + py-2 16 + title 20 +
// 2 × (gap 4 + meta ~11) ≈ 68) ≈ 78.
const ROW_SIZE = 78
// Cards with a salary carry a fourth line (copper figure, +20px) — sized per
// row via estimateSize, the same mechanism the divider row uses.
const SALARY_ROW_SIZE = 98

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
    // Radix ScrollArea: the thumb floats OVER the cards and auto-hides, so no
    // scrollbar lane is reserved and the card gutters stay symmetric. The
    // virtualizer scrolls the viewport element via viewportRef.
    <ScrollArea className="min-h-0 flex-1" viewportRef={parentRef}>
      {/* Bottom inset lives on a sibling spacer — padding on the sizer would
          be swallowed by its border-box inline height. */}
      <div
        data-testid="virtual-sizer"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
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
                className="flex items-end px-3 pb-1 animate-fade-in"
              >
                {/* The copper hairline sits inside the card gutter so it
                    aligns with the card edges, not the panel edges. */}
                <span className="label-caps w-full border-t border-primary/40 pt-1 text-primary">
                  New since your last visit
                </span>
              </div>
            )
          }
          const { job, jobIndex } = row
          const salary = formatSalary(job.salary)
          const selected = job.id === selectedId
          const stagger = animateEntrance && jobIndex < 10
          // One place token, zero redundancy: remote rows show the SCOPE as
          // their place (the mode line already says REMOTE — never echo it,
          // and multi-country restriction lists are noise); on-site/hybrid
          // rows show the city.
          const scopeLabel = job.remoteScope !== null ? remoteScopeLabel(job.remoteScope) : null
          const rawPlace = job.city ?? job.locationRaw
          const bareRemotePlace = /^remote$/i.test(rawPlace.trim()) || /anywhere/i.test(rawPlace)
          const place =
            job.workMode === 'remote'
              ? (scopeLabel ?? (bareRemotePlace ? null : rawPlace))
              : rawPlace
          const sourceName = sourceNames[job.sourceId] ?? job.sourceId
          // Line 2 is "where": place then work style, either of which can be
          // absent — join only the parts that exist, never a dangling separator.
          const placeLine = [place, workModeLabel(job.workMode)]
            .filter((part): part is string => part !== null && part !== '')
            .join(' · ')
          // Line 3 is "where it came from": source then company.
          const sourceLine = `${sourceName} · ${job.company}`
          const published = formatRelativeTime(job.postedAt ?? job.firstSeenAt)
          // Jobs the inbox agent extracted get a sparkle accent (info, never
          // copper — copper stays scarce).
          const fromAgent = isAgentSource(job.sourceId)
          return (
            <div key={item.key} style={style} className="px-3 pt-2.5">
              <button
                type="button"
                data-selected={selected}
                onClick={() => onSelect(job.id)}
                className={cn(
                  // Card row: the house Card treatment (raised surface, real
                  // edge, low shadow) with 10px gutters doing the separation.
                  // Background-color transitions only inside the scrolling
                  // list — the shadow is static, never animated. The selected
                  // card is the copper treatment (fill + border, one of the
                  // five uses).
                  'relative flex h-full w-full flex-col justify-center gap-1 overflow-hidden',
                  'rounded-lg border border-border bg-surface-raised px-3 py-2 text-left',
                  'shadow-elevation-low transition-colors hover:bg-interactive-hover',
                  selected && 'border-primary bg-primary/10',
                  stagger && 'animate-rise-in',
                )}
                style={stagger ? { animationDelay: `${jobIndex * 30}ms` } : undefined}
              >
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
                {/* §5.4 scannability, two quiet meta lines under the title —
                    label-caps for size/weight/color but normal case and tight
                    tracking (its 0.18em uppercase default eats horizontal
                    room), so each shows as much as possible before truncating.
                    Both lines lead with a same-size icon on the same gap, so
                    their text starts on one x. Line 2: place · work style. */}
                <span className="label-caps flex w-full items-center gap-1.5 normal-case leading-none tracking-[0.02em]">
                  {/* Decorative pin — the text is the information; no pin when
                      the job has no place at all. */}
                  {place !== null ? (
                    <MapPin
                      aria-hidden
                      className="size-3 shrink-0"
                      strokeWidth={META_ICON_STROKE}
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{placeLine}</span>
                </span>
                {/* Line 3: source · company, publish time right-anchored — it
                    never truncates; the source/company group absorbs all the
                    squeeze. The leading icon says where the job came from: a
                    plug for the API sources, the sparkle for inbox-agent finds
                    (info, never copper). */}
                <span className="label-caps flex w-full items-center gap-1.5 normal-case leading-none tracking-[0.02em]">
                  {fromAgent ? (
                    <Sparkles
                      className="size-3 shrink-0 text-info"
                      aria-label="Found by the inbox agent"
                      strokeWidth={META_ICON_STROKE}
                    />
                  ) : (
                    <Plug aria-hidden className="size-3 shrink-0" strokeWidth={META_ICON_STROKE} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{sourceLine}</span>
                  <span className="shrink-0">{published}</span>
                </span>
                {salary !== null ? (
                  // Fourth line: the salary as plain copper text — the figure
                  // is the signal, no chip (§5.1 copper scarcity).
                  <span className="text-xs font-semibold tabular-nums text-primary">{salary}</span>
                ) : null}
              </button>
            </div>
          )
        })}
      </div>
      <div aria-hidden className="h-2.5" />
    </ScrollArea>
  )
}

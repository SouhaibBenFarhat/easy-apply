import type { JobStatus, StoredJob } from '@sources/shared'
import type { BadgeProps } from '@ui-kit'
import { Badge, Button, EmptyState, formatRelativeTime, Label, ScrollArea, Textarea } from '@ui-kit'
import { ExternalLink, EyeOff, MousePointerClick } from 'lucide-react'
import type { ReactElement } from 'react'
import { formatSalary, remoteScopeLabel, workModeLabel } from '../../lib/format'
import { SanitizedDescription } from '../SanitizedDescription'

export interface JobDetailPaneProps {
  job: StoredJob | null
  /** Display name of the job's source (attribution + chip); null falls back to the id. */
  sourceName: string | null
  onSetStatus: (status: JobStatus | null) => void
  onSetNotes: (notes: string | null) => void
  onHide: () => void
}

const STATUSES: Array<{ status: JobStatus; label: string }> = [
  { status: 'interested', label: 'Interested' },
  { status: 'applied', label: 'Applied' },
  { status: 'interview', label: 'Interview' },
  { status: 'rejected', label: 'Rejected' },
]

type BadgeVariant = NonNullable<BadgeProps['variant']>

// §5.4 status → color mapping: applied success · interview info ·
// interested warning · rejected destructive.
const STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  applied: 'success',
  interview: 'info',
  interested: 'warning',
  rejected: 'destructive',
}

export function JobDetailPane({
  job,
  sourceName,
  onSetStatus,
  onSetNotes,
  onHide,
}: JobDetailPaneProps): ReactElement {
  if (job === null) {
    return (
      <EmptyState
        className="h-full"
        icon={<MousePointerClick className="size-5" />}
        title="Select a job"
        description="Pick a row on the left to read the posting."
      />
    )
  }

  const salary = formatSalary(job.salary)
  const attribution = sourceName ?? job.sourceId

  // key={job.id} remounts the pane per job so animate-fade-in replays — the
  // §5.5 selection crossfade — and the notes textarea re-seeds its default.
  return (
    <div key={job.id} className="relative h-full min-h-0 animate-fade-in">
      <ScrollArea className="h-full">
        {/* Sticky detail header (§sidebars): one step above the description
            body (`surface`) as a translucent glass veil, so scrolled
            content shows through it and signals there's more underneath. */}
        <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-surface-hover/85 px-6 py-4 backdrop-blur-md">
          <h2 className="truncate text-lg font-semibold">{job.title}</h2>
          <p className="label-caps truncate">
            {job.company} · {job.city ?? job.locationRaw} · posted{' '}
            {formatRelativeTime(job.postedAt ?? job.firstSeenAt)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {job.workMode !== 'unknown' ? (
              <Badge variant="outline">{workModeLabel(job.workMode)}</Badge>
            ) : null}
            {job.remoteScope !== null ? (
              <Badge variant="outline">{remoteScopeLabel(job.remoteScope)}</Badge>
            ) : null}
            {salary !== null ? (
              <span className="text-sm font-semibold tabular-nums text-primary">{salary}</span>
            ) : null}
            {job.status !== null ? (
              <Badge variant={STATUS_VARIANTS[job.status]}>
                {STATUSES.find((entry) => entry.status === job.status)?.label}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Renderer never navigates: the window-open/will-navigate guards
                (PLAN.md §4.9) intercept this and hand it to shell.openExternal. */}
            <Button asChild>
              <a href={job.applyUrl ?? job.url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open application page
              </a>
            </Button>
            {STATUSES.map(({ status, label }) => (
              <Button
                key={status}
                size="sm"
                variant={job.status === status ? 'default' : 'outline'}
                onClick={() => onSetStatus(job.status === status ? null : status)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={onHide}>
              <EyeOff />
              Hide
            </Button>
          </div>
        </header>

        <div className="space-y-6 px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="job-notes">Notes</Label>
            <Textarea
              id="job-notes"
              placeholder="Anything worth remembering about this one…"
              defaultValue={job.notes ?? ''}
              onBlur={(event) => {
                const value = event.target.value
                if (value === (job.notes ?? '')) return
                onSetNotes(value === '' ? null : value)
              }}
            />
          </div>

          {job.descriptionHtml !== null && job.descriptionHtml !== '' ? (
            <SanitizedDescription html={job.descriptionHtml} />
          ) : (
            <p className="text-sm text-foreground-muted">
              No description from this source — open the posting.
            </p>
          )}

          <footer className="border-t border-border-subtle pt-3">
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="label-caps inline-flex items-center gap-1 transition-colors hover:text-primary"
            >
              via {attribution} <ExternalLink className="size-3" aria-hidden />
            </a>
          </footer>
        </div>
      </ScrollArea>
    </div>
  )
}

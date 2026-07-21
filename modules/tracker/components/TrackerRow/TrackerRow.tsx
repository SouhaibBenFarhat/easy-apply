import type { JobStatus, StoredJob } from '@sources/shared'
import { JOB_STATUSES } from '@sources/shared'
import {
  Badge,
  Button,
  cn,
  formatRelativeTime,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui-kit'
import { ExternalLink, X } from 'lucide-react'
import type { ReactElement } from 'react'
import { formatSalaryCompact, statusLabel } from '../../lib/format'

export interface TrackerRowProps {
  job: StoredJob
  /** Display name of the job's source; the page resolves ids via useSources. */
  sourceName: string
  onSetStatus: (id: string, status: JobStatus | null) => void
}

export function TrackerRow({ job, sourceName, onSetStatus }: TrackerRowProps): ReactElement {
  const salary = formatSalaryCompact(job.salary)
  return (
    <div
      className={cn(
        // §5.4 flat row: hairline divider, background-change hover only —
        // no cards, no transforms.
        'flex items-center gap-3 border-b border-border-subtle px-3 py-2.5',
        'transition-colors last:border-0 hover:bg-interactive-hover',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{job.title}</span>
          {salary !== null ? (
            <Badge variant="copper" className="shrink-0">
              {salary}
            </Badge>
          ) : null}
        </span>
        <span className="label-caps truncate">
          {job.company} · {sourceName}
          {job.status !== null && job.statusUpdatedAt !== null
            ? ` · ${statusLabel(job.status)} ${formatRelativeTime(job.statusUpdatedAt)}`
            : null}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={job.status ?? undefined}
          onValueChange={(value) => {
            // Radix reports a plain string; the only items offered are the
            // four JobStatus values, so the narrowing cast is sound.
            onSetStatus(job.id, value as JobStatus)
          }}
        >
          <SelectTrigger aria-label="Set status" className="h-7 w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Renderer never navigates: the window-open/will-navigate guards
            (PLAN.md §4.9) intercept this and hand it to shell.openExternal. */}
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href={job.applyUrl ?? job.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open posting"
          >
            <ExternalLink />
          </a>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove from tracker"
              onClick={() => onSetStatus(job.id, null)}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove from tracker</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

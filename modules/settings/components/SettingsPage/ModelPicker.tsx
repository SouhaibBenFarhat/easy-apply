import type { ModelState, ModelStatus } from '@data'
import { Button, cn } from '@ui-kit'
import { Check, Download, X } from 'lucide-react'
import type { ReactElement } from 'react'

function gb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

// The per-row action: download / a thin progress bar + cancel / remove — each
// model manages its own state right on its row.
function ModelRowAction({
  state,
  displayName,
  percent,
  error,
  armed,
  onDownload,
  onCancel,
  onRemove,
}: {
  state: ModelState
  displayName: string
  percent: number
  error: string | null
  armed: boolean
  onDownload: () => void
  onCancel: () => void
  onRemove: () => void
}): ReactElement {
  if (state === 'downloading') {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Thin recessed groove — a slim progress line, not a fat bar. */}
        <div
          className="h-1 w-16 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-label="Download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full rounded-full bg-info transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[0.65rem] tabular-nums text-foreground-muted">{percent}%</span>
        <Button size="icon-sm" variant="ghost" aria-label="Cancel download" onClick={onCancel}>
          <X />
        </Button>
      </div>
    )
  }
  if (state === 'ready') {
    return (
      <Button
        size="sm"
        variant={armed ? 'destructive' : 'secondary'}
        className="shrink-0"
        onClick={onRemove}
      >
        {armed ? 'Confirm remove' : 'Remove'}
      </Button>
    )
  }
  // 'absent' | 'error'
  return (
    <div className="flex shrink-0 items-center gap-2">
      {state === 'error' && error !== null ? (
        <span className="max-w-[8rem] truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={onDownload}
        aria-label={state === 'error' ? undefined : `Download ${displayName}`}
      >
        <Download /> {state === 'error' ? 'Retry download' : 'Download'}
      </Button>
    </div>
  )
}

export interface ModelPickerProps {
  status: ModelStatus
  removeArmedId: string | null
  onSelect: (modelId: string) => void
  onDownload: (modelId: string) => void
  onCancel: () => void
  onRemove: (modelId: string) => void
  disabled?: boolean
}

// Radio-style picker for the model catalog. Each row is selectable (neutral
// tokens only — copper stays scarce) and carries its OWN download / progress /
// remove control, so the model you act on is the one under your cursor. The
// selected model's live state comes from `status`; other rows show their
// installed flag.
export function ModelPicker({
  status,
  removeArmedId,
  onSelect,
  onDownload,
  onCancel,
  onRemove,
  disabled = false,
}: ModelPickerProps): ReactElement {
  const percent =
    status.totalBytes > 0
      ? Math.min(100, Math.round((status.downloadedBytes / status.totalBytes) * 100))
      : 0

  return (
    <div className="space-y-1.5">
      <span className="label-caps">Model</span>
      <div className="flex flex-col gap-1.5">
        {status.catalog.map((model) => {
          const selected = model.id === status.modelId
          // Only the selected model has live download state; others just report
          // whether they're on disk.
          const state: ModelState = selected ? status.state : model.installed ? 'ready' : 'absent'
          return (
            <div
              key={model.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-border px-3 py-2',
                selected ? 'bg-surface-hover' : 'bg-surface-content',
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                aria-label={model.displayName}
                disabled={disabled}
                onClick={() => {
                  if (!selected) onSelect(model.id)
                }}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-60"
              >
                <Check
                  className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{model.displayName}</span>
                  <span className="text-xs text-foreground-muted">{gb(model.sizeBytes)}</span>
                </span>
              </button>
              <ModelRowAction
                state={state}
                displayName={model.displayName}
                percent={percent}
                error={status.error}
                armed={removeArmedId === model.id}
                onDownload={() => onDownload(model.id)}
                onCancel={onCancel}
                onRemove={() => onRemove(model.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

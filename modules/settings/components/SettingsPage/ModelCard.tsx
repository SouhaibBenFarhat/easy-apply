import {
  useCancelModelDownload,
  useDownloadModel,
  useModelProgress,
  useModelStatus,
  useRemoveModel,
  useSetModelEnabled,
} from '@data'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Switch, useToast } from '@ui-kit'
import { Cpu, Download, X } from 'lucide-react'
import { type ReactElement, useEffect, useState } from 'react'

function gb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

// How long the armed "Confirm remove" state stays live before disarming.
const REMOVE_ARM_MS = 3000

// On-device model manager card (Phase 1): download state + a live progress bar.
// The model runs locally to read job-alert emails into the feed. The bar fill
// is `info`, never copper — copper stays scarce (5 uses only).
export function ModelCard(): ReactElement {
  useModelProgress() // stream download progress into the status cache
  const status = useModelStatus()
  const download = useDownloadModel()
  const cancel = useCancelModelDownload()
  const remove = useRemoveModel()
  const setEnabled = useSetModelEnabled()
  const { toast } = useToast()
  const [removeArmed, setRemoveArmed] = useState(false)

  const data = status.data
  const total = data?.totalBytes ?? 0
  const percent =
    data && total > 0 ? Math.min(100, Math.round((data.downloadedBytes / total) * 100)) : 0

  // Two-step confirm before deleting a ~5 GB file: first click arms, a second
  // click removes, and this timeout quietly disarms otherwise (KeySection's
  // pattern).
  useEffect(() => {
    if (!removeArmed) return undefined
    const timer = setTimeout(() => setRemoveArmed(false), REMOVE_ARM_MS)
    return () => clearTimeout(timer)
  }, [removeArmed])

  const startDownload = (): void => {
    download.mutate(undefined, {
      onError: (error) => {
        toast({
          title: 'Could not start download',
          description: error.message,
          variant: 'destructive',
        })
      },
    })
  }

  const handleRemove = (): void => {
    if (!removeArmed) {
      setRemoveArmed(true)
      return
    }
    setRemoveArmed(false)
    remove.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="size-4" /> On-device AI model
        </CardTitle>
        <div className="ml-auto flex items-center gap-2">
          {data?.enabled && data.state === 'ready' ? <Badge variant="success">Ready</Badge> : null}
          {/* Off unloads the model to free its RAM (file stays on disk). */}
          <Switch
            checked={data?.enabled ?? true}
            onCheckedChange={(value) => setEnabled.mutate(value)}
            aria-label="Enable on-device AI"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground-muted">
          Runs locally to read job-alert emails into your feed. Downloads once (~
          {gb(total || 4_920_000_000)}), then works fully offline — nothing leaves your Mac.
        </p>

        {data === undefined ? null : !data.enabled ? (
          <p className="text-sm">
            AI is <strong>off</strong> — the model is unloaded to free RAM. Turn it back on to read
            job-alert emails.
          </p>
        ) : data.state === 'downloading' ? (
          <div className="space-y-2">
            {/* Recessed well one step below the card + a full-strength border
                = a crisp track with real edges, not a flat strip (§visual-hierarchy). */}
            <div
              role="progressbar"
              aria-label="Model download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-surface-content"
            >
              <div
                className="h-full rounded-full bg-info transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps">
                {gb(data.downloadedBytes)} / {gb(total)} · {percent}%
              </span>
              {/* Cancel is a de-emphasized action → the skill's allowed ghost
                  use (a quiet icon button), not a merging text button. */}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Cancel download"
                onClick={() => cancel.mutate()}
              >
                <X />
              </Button>
            </div>
          </div>
        ) : data.state === 'ready' ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">Model installed — email reading is available.</p>
            {/* Secondary at rest (visible on the card, §visual-hierarchy),
                destructive once armed. */}
            <Button
              size="sm"
              variant={removeArmed ? 'destructive' : 'secondary'}
              className="shrink-0"
              onClick={handleRemove}
            >
              {removeArmed ? 'Confirm remove' : 'Remove'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.state === 'error' && data.error !== null ? (
              <p className="text-sm text-destructive">{data.error}</p>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              disabled={download.isPending}
              onClick={startDownload}
            >
              <Download /> {data.state === 'error' ? 'Retry download' : 'Download model'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

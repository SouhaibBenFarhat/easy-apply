import {
  useCancelModelDownload,
  useDownloadModel,
  useModelProgress,
  useModelStatus,
  useRemoveModel,
  useSelectModel,
  useSetModelEnabled,
} from '@data'
import { Badge, Card, CardContent, CardHeader, CardTitle, Switch, useToast } from '@ui-kit'
import { Cpu } from 'lucide-react'
import { type ReactElement, useEffect, useState } from 'react'
import { ModelPicker } from './ModelPicker'

// How long the armed "Confirm remove" state stays live before disarming.
const REMOVE_ARM_MS = 3000

// On-device model manager card. Downloading, progress, and removal all happen
// per-model in the picker (the model you act on is the one under your cursor);
// the card just owns the AI on/off switch and the shared mutations.
export function ModelCard(): ReactElement {
  useModelProgress() // stream download progress into the status cache
  const status = useModelStatus()
  const download = useDownloadModel()
  const cancel = useCancelModelDownload()
  const remove = useRemoveModel()
  const select = useSelectModel()
  const setEnabled = useSetModelEnabled()
  const { toast } = useToast()
  // The row whose delete is armed (two-step confirm), keyed by model id.
  const [removeArmedId, setRemoveArmedId] = useState<string | null>(null)

  const data = status.data

  // Two-step confirm before deleting a multi-GB file: first click arms, a second
  // click removes, and this timeout quietly disarms otherwise.
  useEffect(() => {
    if (removeArmedId === null) return undefined
    const timer = setTimeout(() => setRemoveArmedId(null), REMOVE_ARM_MS)
    return () => clearTimeout(timer)
  }, [removeArmedId])

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

  // Downloads (or removes) the given model — selecting it first when it isn't
  // the active one, since both operations target the selected model.
  const handleDownload = (id: string): void => {
    setRemoveArmedId(null)
    if (data !== undefined && id === data.modelId) {
      startDownload()
      return
    }
    select.mutate(id, { onSuccess: () => startDownload() })
  }

  const handleRemove = (id: string): void => {
    if (removeArmedId !== id) {
      setRemoveArmedId(id)
      return
    }
    setRemoveArmedId(null)
    if (data !== undefined && id === data.modelId) {
      remove.mutate()
      return
    }
    select.mutate(id, { onSuccess: () => remove.mutate() })
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
          Runs locally to read job-alert emails into your feed. Pick a model — it downloads once,
          then works fully offline, and nothing leaves your Mac.
        </p>

        {data === undefined ? null : !data.enabled ? (
          <p className="text-sm">
            AI is <strong>off</strong> — the model is unloaded to free RAM. Turn it back on to read
            job-alert emails.
          </p>
        ) : (
          <ModelPicker
            status={data}
            removeArmedId={removeArmedId}
            onSelect={(id) => select.mutate(id)}
            onDownload={handleDownload}
            onCancel={() => cancel.mutate()}
            onRemove={handleRemove}
            disabled={select.isPending}
          />
        )}
      </CardContent>
    </Card>
  )
}

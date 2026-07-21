import type { SourceInfo, SyncRun } from '@data'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatRelativeTime,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui-kit'
import { ExternalLink } from 'lucide-react'
import type { ReactElement } from 'react'
import { KeySection } from './KeySection'

export interface SourceCardProps {
  source: SourceInfo
  lastRun: SyncRun | null
  onToggle: (enabled: boolean) => void
  onSaveKey: (values: Record<string, string>) => void
  onClearKey: () => void
}

// Sync errors can carry whole HTML error pages; the tooltip shows a preview,
// never the full payload.
const ERROR_PREVIEW_MAX = 200

function truncateError(error: string | null): string {
  if (error === null || error === '') return 'Unknown error'
  return error.length <= ERROR_PREVIEW_MAX ? error : `${error.slice(0, ERROR_PREVIEW_MAX)}…`
}

// Presentational card for one provider: toggle, last-sync state, attribution,
// and (for keyed sources) API-key management. All side effects come in as
// callbacks from the SourcesPage orchestrator.
export function SourceCard({
  source,
  lastRun,
  onToggle,
  onSaveKey,
  onClearKey,
}: SourceCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-1 space-y-0">
        <CardTitle className="text-base">{source.displayName}</CardTitle>
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${source.displayName}`}>
          {/* Renderer never navigates: the window-open/will-navigate guards
              (PLAN.md §4.9) intercept this and hand it to shell.openExternal. */}
          <a href={source.homepage} target="_blank" rel="noreferrer">
            <ExternalLink />
          </a>
        </Button>
        <Switch
          className="ml-auto"
          checked={source.enabled}
          onCheckedChange={onToggle}
          aria-label={`Enable ${source.displayName}`}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="label-caps">
            {source.lastSyncAt === null
              ? 'Never synced'
              : `Synced ${formatRelativeTime(source.lastSyncAt)}`}
            {' · '}
            {source.attribution.label}
          </p>
          {lastRun !== null && lastRun.ok === false ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive">last sync failed</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{truncateError(lastRun.error)}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {source.requiresKey !== undefined ? (
          <KeySection source={source} onSaveKey={onSaveKey} onClearKey={onClearKey} />
        ) : null}
      </CardContent>
    </Card>
  )
}

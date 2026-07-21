import { Button, cn } from '@ui-kit'
import { RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'

export interface SyncButtonProps {
  syncing: boolean
  onSyncNow: () => void
}

// The rotating icon is the app's only looping animation, and only while a
// sync is genuinely active (PLAN.md §5.5).
export function SyncButton({ syncing, onSyncNow }: SyncButtonProps): ReactElement {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sync now" onClick={onSyncNow}>
      <RefreshCw className={cn(syncing && 'animate-spin-slow')} />
    </Button>
  )
}

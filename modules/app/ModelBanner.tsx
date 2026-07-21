import { useMailboxAccounts, useModelStatus } from '@data'
import { Button } from '@ui-kit'
import { Cpu } from 'lucide-react'
import type { ReactElement } from 'react'

export interface ModelBannerProps {
  onOpen: () => void
}

// App-wide warning bar: shown once the user has connected job-alert inboxes but
// the on-device model that reads them isn't installed. Surface is the warning
// quad (subtle fill + full-strength warning border) so it reads as a distinct
// bar with real edges (§visual-hierarchy), and the action is a secondary button
// that stays visible on it. Disappears on its own once the model is ready.
export function ModelBanner({ onOpen }: ModelBannerProps): ReactElement | null {
  const model = useModelStatus()
  const accounts = useMailboxAccounts()
  const state = model.data?.state
  const hasInboxes = (accounts.data?.length ?? 0) > 0
  const show = hasInboxes && (state === 'absent' || state === 'error')
  if (!show) return null

  return (
    <div className="flex items-center gap-3 border-b border-warning-border bg-warning-subtle px-4 py-2.5">
      <Cpu className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-sm">
        Reading your job-alert emails needs the on-device AI model — it isn't installed yet.
      </p>
      <Button size="sm" variant="secondary" className="shrink-0" onClick={onOpen}>
        Install in Settings
      </Button>
    </div>
  )
}

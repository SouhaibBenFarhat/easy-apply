import type { ThemeVariant } from '@data'
import type { ReactElement, ReactNode } from 'react'
import { SyncButton } from './SyncButton'
import { ThemeToggle } from './ThemeToggle'

export interface AppHeaderProps {
  title: string
  syncing: boolean
  onSyncNow: () => void
  theme: ThemeVariant
  onCycleTheme: () => void
  /** Extra page-level actions, rendered left of the sync/theme controls. */
  children?: ReactNode
}

// Glass per PLAN.md §5.3: content scrolls underneath the header. The whole
// bar drags the window; the action cluster opts back out. The sidebar owns
// the traffic-light zone, so the header starts right of it.
export function AppHeader({
  title,
  syncing,
  onSyncNow,
  theme,
  onCycleTheme,
  children,
}: AppHeaderProps): ReactElement {
  return (
    <header className="glass app-drag flex h-12 shrink-0 items-center justify-between pl-2 pr-3">
      <h1 className="truncate px-2 text-sm font-semibold">{title}</h1>
      <div className="app-no-drag flex shrink-0 items-center gap-1">
        {children}
        <SyncButton syncing={syncing} onSyncNow={onSyncNow} />
        <ThemeToggle theme={theme} onCycleTheme={onCycleTheme} />
      </div>
    </header>
  )
}

import type { ThemeVariant } from '@data'
import type { ReactElement, ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'

export interface AppHeaderProps {
  title: string
  theme: ThemeVariant
  onCycleTheme: () => void
  /**
   * Page-level actions, rendered left of the theme toggle. The agent transport
   * arrives this way from @app, which decides where it belongs: exactly one
   * transport is ever on screen, never one here AND one in the pipeline panel.
   */
  children?: ReactNode
}

// Glass per PLAN.md §5.3: content scrolls underneath the header. The whole
// bar drags the window; the action cluster opts back out. The sidebar owns
// the traffic-light zone, so the header starts right of it.
export function AppHeader({ title, theme, onCycleTheme, children }: AppHeaderProps): ReactElement {
  return (
    <header className="glass app-drag flex h-12 shrink-0 items-center justify-between pl-2 pr-3">
      <h1 className="truncate px-2 text-sm font-semibold">{title}</h1>
      <div className="app-no-drag flex shrink-0 items-center gap-1">
        {children}
        <ThemeToggle theme={theme} onCycleTheme={onCycleTheme} />
      </div>
    </header>
  )
}

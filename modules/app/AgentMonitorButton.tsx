import { useAgentTrace } from '@data'
import { Button, cn } from '@ui-kit'
import { Activity } from 'lucide-react'
import type { ReactElement } from 'react'

export interface AgentMonitorButtonProps {
  open: boolean
  onToggle: () => void
}

// Header button that opens/closes the layout-push activity timeline. A dot marks
// unseen activity while it's closed.
export function AgentMonitorButton({ open, onToggle }: AgentMonitorButtonProps): ReactElement {
  const trace = useAgentTrace()
  const count = trace.data?.length ?? 0
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Agent activity"
      aria-pressed={open}
      onClick={onToggle}
      className={cn('relative', open && 'bg-interactive-active')}
    >
      <Activity />
      {count > 0 && !open ? (
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-info" aria-hidden />
      ) : null}
    </Button>
  )
}

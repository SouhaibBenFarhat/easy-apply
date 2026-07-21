import { useModelStatus, useSetModelEnabled } from '@data'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@ui-kit'
import { Cpu } from 'lucide-react'
import type { ReactElement } from 'react'

// Header toggle for the on-device AI. Off unloads the model to free its RAM;
// dimmed when off. The quickest way to stop the LLM eating memory from anywhere.
export function AiToggle(): ReactElement {
  const status = useModelStatus()
  const setEnabled = useSetModelEnabled()
  const enabled = status.data?.enabled ?? true

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            enabled ? 'AI on — click to turn off and free RAM' : 'AI off — click to turn on'
          }
          aria-pressed={enabled}
          onClick={() => setEnabled.mutate(!enabled)}
          className={enabled ? undefined : 'text-foreground-ghost'}
        >
          <Cpu />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? 'AI on — click to free RAM' : 'AI off — click to enable'}
      </TooltipContent>
    </Tooltip>
  )
}

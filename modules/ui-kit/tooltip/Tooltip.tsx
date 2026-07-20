import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type TooltipProviderProps = ComponentProps<typeof TooltipPrimitive.Provider>

export function TooltipProvider({
  delayDuration = 300,
  ...props
}: TooltipProviderProps): ReactElement {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

export type TooltipProps = ComponentProps<typeof TooltipPrimitive.Root>

export function Tooltip(props: TooltipProps): ReactElement {
  return <TooltipPrimitive.Root {...props} />
}

export type TooltipTriggerProps = ComponentProps<typeof TooltipPrimitive.Trigger>

export function TooltipTrigger({ type = 'button', ...props }: TooltipTriggerProps): ReactElement {
  return <TooltipPrimitive.Trigger type={type} {...props} />
}

export type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Content>

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: TooltipContentProps): ReactElement {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md border border-border-subtle bg-overlay px-3 py-1.5',
          'text-xs text-foreground shadow-elevation-medium animate-fade-in',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

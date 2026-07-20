import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type PopoverProps = ComponentProps<typeof PopoverPrimitive.Root>

export function Popover(props: PopoverProps): ReactElement {
  return <PopoverPrimitive.Root {...props} />
}

export type PopoverTriggerProps = ComponentProps<typeof PopoverPrimitive.Trigger>

export function PopoverTrigger({ type = 'button', ...props }: PopoverTriggerProps): ReactElement {
  return <PopoverPrimitive.Trigger type={type} {...props} />
}

export type PopoverAnchorProps = ComponentProps<typeof PopoverPrimitive.Anchor>

export function PopoverAnchor(props: PopoverAnchorProps): ReactElement {
  return <PopoverPrimitive.Anchor {...props} />
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Content>

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: PopoverContentProps): ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-lg glass-overlay border border-border-subtle p-4',
          'shadow-elevation-high animate-scale-in outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

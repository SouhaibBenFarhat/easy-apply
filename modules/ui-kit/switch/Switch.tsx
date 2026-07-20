import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root>

export function Switch({ className, ...props }: SwitchProps): ReactElement {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent transition-colors',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-elevation-low',
          'transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

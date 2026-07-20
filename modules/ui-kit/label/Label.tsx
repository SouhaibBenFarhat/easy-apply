import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export interface LabelProps extends ComponentProps<typeof LabelPrimitive.Root> {}

export function Label({ className, ...props }: LabelProps): ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

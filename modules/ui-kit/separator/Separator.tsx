import { Root } from '@radix-ui/react-separator'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export interface SeparatorProps extends ComponentProps<typeof Root> {}

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorProps): ReactElement {
  return (
    <Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

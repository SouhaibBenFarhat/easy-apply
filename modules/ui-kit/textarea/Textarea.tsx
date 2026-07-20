import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, ...props }: TextareaProps): ReactElement {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full resize-none rounded border border-border bg-input px-3 py-2 text-sm transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

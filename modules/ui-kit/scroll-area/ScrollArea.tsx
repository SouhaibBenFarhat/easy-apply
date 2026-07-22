import { Corner, Root, Scrollbar, Thumb, Viewport } from '@radix-ui/react-scroll-area'
import type { ComponentProps, ReactElement, Ref } from 'react'
import { cn } from '../utils'

export interface ScrollAreaProps extends ComponentProps<typeof Root> {
  /** Ref to the scrollable viewport element — for virtualizers that need
   * the real scroll container (e.g. TanStack Virtual's getScrollElement). */
  viewportRef?: Ref<HTMLDivElement>
}

export function ScrollArea({
  className,
  children,
  viewportRef,
  ...props
}: ScrollAreaProps): ReactElement {
  return (
    <Root className={cn('relative overflow-hidden', className)} {...props}>
      {/* Radix wraps children in a display:table div sized to max-content, which
          breaks `truncate` on descendants (they overflow instead of ellipsing).
          Force it to block so children are constrained to the viewport width. */}
      <Viewport ref={viewportRef} className="h-full w-full rounded-[inherit] [&>div]:!block">
        {children}
      </Viewport>
      <ScrollBar />
      <Corner />
    </Root>
  )
}

export interface ScrollBarProps extends ComponentProps<typeof Scrollbar> {}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollBarProps): ReactElement {
  return (
    <Scrollbar
      orientation={orientation}
      className={cn(
        'flex touch-none select-none transition-colors',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
        className,
      )}
      {...props}
    >
      <Thumb className="relative flex-1 rounded-full bg-border" />
    </Scrollbar>
  )
}

import { useEffect, useRef, useState } from 'react'

export type DeferredLoadingState = 'content' | 'skeleton' | 'blank'

export interface DeferredLoadingOptions {
  /** Milliseconds of loading before the skeleton appears. Defaults to 150. */
  showDelay?: number
  /** Minimum milliseconds the skeleton stays visible once shown. Defaults to 400. */
  minVisible?: number
}

/**
 * Anti-flash loading state: fast loads render nothing ('blank') instead of
 * flashing a skeleton, slow loads show a skeleton after `showDelay`, and a
 * skeleton that appeared stays visible for at least `minVisible`.
 */
export function useDeferredLoading(
  isLoading: boolean,
  options: DeferredLoadingOptions = {},
): DeferredLoadingState {
  const { showDelay = 150, minVisible = 400 } = options
  const [state, setState] = useState<DeferredLoadingState>(isLoading ? 'blank' : 'content')
  const skeletonShownAt = useRef<number | null>(null)

  useEffect(() => {
    if (isLoading) {
      if (skeletonShownAt.current !== null) {
        return undefined
      }
      setState('blank')
      const timer = setTimeout(() => {
        skeletonShownAt.current = Date.now()
        setState('skeleton')
      }, showDelay)
      return () => clearTimeout(timer)
    }

    if (skeletonShownAt.current !== null) {
      const remaining = minVisible - (Date.now() - skeletonShownAt.current)
      if (remaining > 0) {
        const timer = setTimeout(() => {
          skeletonShownAt.current = null
          setState('content')
        }, remaining)
        return () => clearTimeout(timer)
      }
    }
    skeletonShownAt.current = null
    setState('content')
    return undefined
  }, [isLoading, showDelay, minVisible])

  return state
}

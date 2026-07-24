import type { AnyRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

// ⌘1–4 page switching and ⌘[/⌘] history (PLAN.md §6): memory history has no
// browser chrome, so back/forward must be wired explicitly.
const ROUTE_BY_KEY: Readonly<Record<string, string>> = {
  '1': '/feed',
  '2': '/tracker',
  '3': '/sources',
  '4': '/runs',
  '5': '/settings',
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useAppKeyboard(router: AnyRouter): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return
      if (isTextTarget(event.target)) return
      const to = ROUTE_BY_KEY[event.key]
      if (to !== undefined) {
        event.preventDefault()
        void router.navigate({ to })
        return
      }
      if (event.key === '[') {
        event.preventDefault()
        router.history.back()
        return
      }
      if (event.key === ']') {
        event.preventDefault()
        router.history.forward()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])
}

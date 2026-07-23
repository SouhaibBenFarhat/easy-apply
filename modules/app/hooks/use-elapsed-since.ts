import { useEffect, useState } from 'react'

const TICK_MS = 1_000

// Live elapsed ms since a main-stamped ISO timestamp, ticking once a second
// while `enabled`. Returns null when disabled (call unconditionally, gate with
// the flag) — the interval only exists for an enabled hook, and only one trace
// row is ever active, so at most one timer runs.
export function useElapsedSince(iso: string, enabled: boolean): number | null {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!enabled) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [enabled])

  if (!enabled) return null
  const startedAt = Date.parse(iso)
  if (Number.isNaN(startedAt)) return null
  return Math.max(0, now - startedAt)
}

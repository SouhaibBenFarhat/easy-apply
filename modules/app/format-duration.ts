// Compact duration for timeline rows: sub-second in ms, seconds with one
// decimal under 10s, whole seconds under a minute, then "3m 05s" / "1h 12m".
// Density first — these sit at the end of already-tight trace rows.
export function formatTraceDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

// Stopwatch face for a step still running: "0:07" → "12:42" → "1:02:05".
// Deliberately a different shape from formatTraceDuration so a live counter
// never reads as a final measurement.
export function formatElapsedClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mmss = `${minutes}:${String(seconds).padStart(2, '0')}`
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : mmss
}

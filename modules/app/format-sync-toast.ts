import type { SyncSummary } from '@data'

// The renderer cannot import @sources/main's summary helpers — rebuild the
// one-line toast from the IPC SyncSummary instead.
export function formatSyncToast(summary: SyncSummary): string {
  const jobs =
    summary.inserted === 0
      ? 'No new jobs'
      : summary.inserted === 1
        ? '1 new job'
        : `${summary.inserted} new jobs`
  const failed = summary.perSource.filter((entry) => !entry.ok && !entry.skipped).length
  if (failed === 0) return jobs
  return `${jobs} · ${failed} ${failed === 1 ? 'source' : 'sources'} failed`
}

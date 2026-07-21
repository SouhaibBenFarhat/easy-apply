import type { SyncSummary } from '@data'
import { formatSyncToast } from './format-sync-toast'

function summary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    inserted: 0,
    updated: 0,
    perSource: [],
    startedAt: '2026-07-20T10:00:00.000Z',
    finishedAt: '2026-07-20T10:00:05.000Z',
    ...overrides,
  }
}

function source(ok: boolean, skipped = false): SyncSummary['perSource'][number] {
  return { sourceId: 'ba', ok, inserted: 0, updated: 0, error: ok ? null : 'boom', skipped }
}

describe('formatSyncToast', () => {
  it('reports no new jobs', () => {
    expect(formatSyncToast(summary())).toBe('No new jobs')
  })

  it('singularizes one new job', () => {
    expect(formatSyncToast(summary({ inserted: 1 }))).toBe('1 new job')
  })

  it('pluralizes multiple new jobs', () => {
    expect(formatSyncToast(summary({ inserted: 12 }))).toBe('12 new jobs')
  })

  it('appends a failed-source note, ignoring skipped sources', () => {
    const line = formatSyncToast(
      summary({ inserted: 3, perSource: [source(true), source(false), source(false, true)] }),
    )
    expect(line).toBe('3 new jobs · 1 source failed')
  })

  it('pluralizes multiple failed sources', () => {
    const line = formatSyncToast(summary({ perSource: [source(false), source(false)] }))
    expect(line).toBe('No new jobs · 2 sources failed')
  })
})

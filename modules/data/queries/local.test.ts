import { renderHook, waitFor } from '@test-utils'
import {
  FEED_FILTERS_STORAGE_KEY,
  LAST_FEED_VISIT_STORAGE_KEY,
  readStoredFeedFilters,
  useLastFeedVisit,
  useStoredFeedFilters,
} from './local'

describe('useLastFeedVisit', () => {
  it('resolves null when the feed was never visited', async () => {
    const { result } = renderHook(() => useLastFeedVisit())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('resolves the stored timestamp', async () => {
    localStorage.setItem(LAST_FEED_VISIT_STORAGE_KEY, '2026-07-20T10:00:00.000Z')
    const { result } = renderHook(() => useLastFeedVisit())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('2026-07-20T10:00:00.000Z')
  })
})

describe('readStoredFeedFilters', () => {
  it('returns {} when nothing is stored', () => {
    expect(readStoredFeedFilters()).toEqual({})
  })

  it('round-trips valid stored filters', () => {
    localStorage.setItem(
      FEED_FILTERS_STORAGE_KEY,
      JSON.stringify({ workModes: ['remote'], hasSalary: true, sources: ['ba', 'adzuna'] }),
    )
    expect(readStoredFeedFilters()).toEqual({
      workModes: ['remote'],
      hasSalary: true,
      sources: ['ba', 'adzuna'],
    })
  })

  it('drops unknown values and never includes search', () => {
    localStorage.setItem(
      FEED_FILTERS_STORAGE_KEY,
      JSON.stringify({
        workModes: ['remote', 'teleport'],
        sources: ['ba', 'not-a-source'],
        hasSalary: 'yes',
        search: 'stale query',
      }),
    )
    expect(readStoredFeedFilters()).toEqual({ workModes: ['remote'], sources: ['ba'] })
  })

  it('survives garbage storage', () => {
    localStorage.setItem(FEED_FILTERS_STORAGE_KEY, 'not json {')
    expect(readStoredFeedFilters()).toEqual({})
  })
})

describe('useStoredFeedFilters', () => {
  it('serves stored filters on first render via initialData', () => {
    localStorage.setItem(FEED_FILTERS_STORAGE_KEY, JSON.stringify({ hasSalary: true }))
    const { result } = renderHook(() => useStoredFeedFilters())
    expect(result.current.data).toEqual({ hasSalary: true })
  })
})

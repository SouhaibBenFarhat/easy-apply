import { renderHook, waitFor } from '@test-utils'
import {
  DEFAULT_PANEL_WIDTHS,
  FEED_FILTERS_STORAGE_KEY,
  LAST_FEED_VISIT_STORAGE_KEY,
  PANEL_WIDTHS_STORAGE_KEY,
  readStoredFeedFilters,
  readStoredPanelWidths,
  useLastFeedVisit,
  useStoredFeedFilters,
  useStoredPanelWidths,
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
      JSON.stringify({
        workModes: ['remote'],
        hasSalary: true,
        sources: ['ba', 'adzuna'],
        origin: 'agent',
      }),
    )
    expect(readStoredFeedFilters()).toEqual({
      workModes: ['remote'],
      hasSalary: true,
      sources: ['ba', 'adzuna'],
      origin: 'agent',
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

describe('readStoredPanelWidths', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(readStoredPanelWidths()).toEqual(DEFAULT_PANEL_WIDTHS)
  })

  it('keeps valid numbers and falls back per-field for garbage', () => {
    localStorage.setItem(
      PANEL_WIDTHS_STORAGE_KEY,
      JSON.stringify({ jobs: 500, activity: 'very wide' }),
    )
    expect(readStoredPanelWidths()).toEqual({
      jobs: 500,
      activity: DEFAULT_PANEL_WIDTHS.activity,
    })
  })

  it('falls back on malformed or non-object storage', () => {
    localStorage.setItem(PANEL_WIDTHS_STORAGE_KEY, 'not json')
    expect(readStoredPanelWidths()).toEqual(DEFAULT_PANEL_WIDTHS)
    localStorage.setItem(PANEL_WIDTHS_STORAGE_KEY, 'null')
    expect(readStoredPanelWidths()).toEqual(DEFAULT_PANEL_WIDTHS)
  })
})

describe('useStoredPanelWidths', () => {
  it('exposes the stored widths without a loading flash', () => {
    localStorage.setItem(PANEL_WIDTHS_STORAGE_KEY, JSON.stringify({ jobs: 500, activity: 300 }))
    const { result } = renderHook(() => useStoredPanelWidths())
    expect(result.current.data).toEqual({ jobs: 500, activity: 300 })
  })
})

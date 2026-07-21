import { act, createTestQueryClient, renderHook, waitFor } from '@test-utils'
import { keys } from '../keys'
import { FEED_FILTERS_STORAGE_KEY, LAST_FEED_VISIT_STORAGE_KEY } from '../queries/local'
import { useMarkFeedVisited, useSetStoredFeedFilters } from './local'

describe('useMarkFeedVisited', () => {
  it('writes a now-ISO timestamp to localStorage and the cache', async () => {
    const client = createTestQueryClient()
    const before = Date.now()
    const { result } = renderHook(() => useMarkFeedVisited(), { client })
    act(() => {
      result.current.mutate()
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const stored = localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY)
    expect(stored).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const timestamp = new Date(stored as string).getTime()
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(Date.now())
    expect(client.getQueryData(keys.local.lastFeedVisit)).toBe(stored)
    expect(result.current.data).toBe(stored)
  })
})

describe('useSetStoredFeedFilters', () => {
  it('persists filters to localStorage and the cache, stripping search', async () => {
    const { result } = renderHook(() => useSetStoredFeedFilters())
    result.current.mutate({ workModes: ['hybrid'], hasSalary: true, search: 'react' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const stored = JSON.parse(localStorage.getItem(FEED_FILTERS_STORAGE_KEY) ?? '{}')
    expect(stored).toEqual({ workModes: ['hybrid'], hasSalary: true })
    expect(stored.search).toBeUndefined()
    expect(result.current.data).toEqual({ workModes: ['hybrid'], hasSalary: true })
  })
})

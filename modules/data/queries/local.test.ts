import { renderHook, waitFor } from '@test-utils'
import { LAST_FEED_VISIT_STORAGE_KEY, useLastFeedVisit } from './local'

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

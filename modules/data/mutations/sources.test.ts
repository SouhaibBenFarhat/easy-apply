import { act, createTestQueryClient, renderHook, waitFor } from '@test-utils'
import { keys } from '../keys'
import { useClearSourceKey, useSetSourceEnabled, useSetSourceKey } from './sources'

describe('useSetSourceEnabled', () => {
  it('toggles the source and invalidates the source list', async () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.sources.list, [])
    const { result } = renderHook(() => useSetSourceEnabled(), { client })
    act(() => {
      result.current.mutate({ sourceId: 'ba', enabled: false })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.enabled).toBe(false)
    expect(client.getQueryState(keys.sources.list)?.isInvalidated).toBe(true)
  })
})

describe('useSetSourceKey', () => {
  it('stores the key (enabling the source) and invalidates the list', async () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.sources.list, [])
    const { result } = renderHook(() => useSetSourceKey(), { client })
    act(() => {
      result.current.mutate({
        sourceId: 'adzuna',
        values: { app_id: 'id', app_key: 'key' },
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.hasKey).toBe(true)
    expect(result.current.data?.enabled).toBe(true)
    expect(client.getQueryState(keys.sources.list)?.isInvalidated).toBe(true)
  })

  it('surfaces an IpcResult failure for a keyless source', async () => {
    const { result } = renderHook(() => useSetSourceKey())
    act(() => {
      result.current.mutate({ sourceId: 'ba', values: { token: 'x' } })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('ba does not take an API key')
  })
})

describe('useClearSourceKey', () => {
  it('clears the key and invalidates the list', async () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.sources.list, [])
    const { result } = renderHook(() => useClearSourceKey(), { client })
    act(() => {
      result.current.mutate({ sourceId: 'adzuna' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.hasKey).toBe(false)
    expect(client.getQueryState(keys.sources.list)?.isInvalidated).toBe(true)
  })
})

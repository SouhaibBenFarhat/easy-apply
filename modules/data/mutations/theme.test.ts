import { act, createTestQueryClient, renderHook, waitFor } from '@test-utils'
import { keys } from '../keys'
import { THEME_STORAGE_KEY } from '../queries/theme'
import { useSetTheme } from './theme'

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('useSetTheme', () => {
  it('persists the variant, applies the class and seeds the cache', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSetTheme(), { client })
    act(() => {
      result.current.mutate('dark')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(client.getQueryData(keys.settings.theme)).toBe('dark')
  })

  it('switching to light removes the dark class', async () => {
    document.documentElement.classList.add('dark')
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSetTheme(), { client })
    act(() => {
      result.current.mutate('light')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(client.getQueryData(keys.settings.theme)).toBe('light')
  })
})

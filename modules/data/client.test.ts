import type { Query } from '@tanstack/react-query'
import { dehydrate } from '@tanstack/react-query'
import { createTestQueryClient } from '@test-utils'
import {
  createQueryClient,
  PERSIST_STORAGE_KEY,
  setupPersistence,
  shouldDehydrateQuery,
} from './client'
import { keys } from './keys'

describe('createQueryClient', () => {
  it('applies the app-wide defaults', () => {
    const client = createQueryClient()
    const defaults = client.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(60_000)
    expect(defaults.queries?.gcTime).toBe(24 * 3_600_000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
    expect(defaults.mutations?.retry).toBe(0)
  })
})

describe('shouldDehydrateQuery', () => {
  it('persists only settings/local queries when dehydrating a real cache', () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.settings.app, { syncIntervalHours: 3 })
    client.setQueryData(keys.settings.theme, 'dark')
    client.setQueryData(keys.local.lastFeedVisit, '2026-07-20T10:00:00.000Z')
    client.setQueryData(keys.jobs.feed({}), [])
    client.setQueryData(keys.jobs.detail('ba:1'), null)
    client.setQueryData(keys.sources.list, [])
    client.setQueryData(keys.sync.status, { running: false })
    const dehydrated = dehydrate(client, { shouldDehydrateQuery })
    const namespaces = dehydrated.queries.map((query) => query.queryKey[0]).toSorted()
    expect(namespaces).toEqual(['local', 'settings', 'settings'])
  })

  it('never persists a query that has not succeeded', () => {
    const pending = {
      queryKey: keys.settings.theme,
      state: { status: 'pending' },
    } as unknown as Query
    const errored = {
      queryKey: keys.local.lastFeedVisit,
      state: { status: 'error' },
    } as unknown as Query
    expect(shouldDehydrateQuery(pending)).toBe(false)
    expect(shouldDehydrateQuery(errored)).toBe(false)
  })

  it('accepts successful settings and local queries only', () => {
    const make = (queryKey: readonly unknown[]): Query =>
      ({ queryKey, state: { status: 'success' } }) as unknown as Query
    expect(shouldDehydrateQuery(make(keys.settings.app))).toBe(true)
    expect(shouldDehydrateQuery(make(keys.settings.theme))).toBe(true)
    expect(shouldDehydrateQuery(make(keys.local.lastFeedVisit))).toBe(true)
    expect(shouldDehydrateQuery(make(keys.jobs.all))).toBe(false)
    expect(shouldDehydrateQuery(make(keys.jobs.feed({})))).toBe(false)
    expect(shouldDehydrateQuery(make(keys.sources.list))).toBe(false)
    expect(shouldDehydrateQuery(make(keys.sync.status))).toBe(false)
  })
})

describe('setupPersistence', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes only settings/local queries to localStorage under the v1 buster', async () => {
    vi.useFakeTimers()
    const client = createTestQueryClient()
    setupPersistence(client)
    await vi.advanceTimersByTimeAsync(0) // flush the initial restore
    client.setQueryData(keys.settings.theme, 'dark')
    client.setQueryData(keys.local.lastFeedVisit, '2026-07-20T10:00:00.000Z')
    client.setQueryData(keys.jobs.feed({}), [])
    await vi.advanceTimersByTimeAsync(1_100) // sync-storage persister throttles at 1 s
    const raw = localStorage.getItem(PERSIST_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw as string) as {
      buster: string
      clientState: { queries: Array<{ queryKey: unknown[] }> }
    }
    expect(persisted.buster).toBe('v1')
    const namespaces = persisted.clientState.queries.map((query) => query.queryKey[0]).toSorted()
    expect(namespaces).toEqual(['local', 'settings'])
  })
})

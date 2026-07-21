import type { StoredJob } from '@sources/shared'
import { createMockElectron, renderHook, setupMockElectron, waitFor } from '@test-utils'
import { useFeed, useJob } from './jobs'

function makeStoredJob(overrides: Partial<StoredJob> = {}): StoredJob {
  return {
    id: 'ba:1',
    sourceId: 'ba',
    url: 'https://example.com/job/1',
    applyUrl: null,
    title: 'Software Engineer',
    company: 'Acme GmbH',
    locationRaw: 'München',
    city: 'München',
    country: 'DE',
    workMode: 'onsite',
    remoteScope: null,
    salary: { min: null, max: null, currency: null, period: null, isEstimated: false, raw: null },
    postedAt: '2026-07-19T08:00:00.000Z',
    descriptionHtml: null,
    tags: [],
    dedupeKey: 'acme|software engineer|münchen',
    firstSeenAt: '2026-07-19T09:00:00.000Z',
    fetchedAt: '2026-07-19T09:00:00.000Z',
    status: null,
    statusUpdatedAt: null,
    notes: null,
    hidden: false,
    ...overrides,
  }
}

describe('useFeed', () => {
  it('resolves feed rows from the bridge, newest first', async () => {
    const older = makeStoredJob({ id: 'ba:1', postedAt: '2026-07-18T08:00:00.000Z' })
    const newer = makeStoredJob({ id: 'ba:2', postedAt: '2026-07-20T08:00:00.000Z' })
    setupMockElectron(createMockElectron({ jobs: [older, newer] }))
    const { result } = renderHook(() => useFeed({}))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((job) => job.id)).toEqual(['ba:2', 'ba:1'])
  })

  it('passes the filters through to the bridge', async () => {
    const spy = vi.spyOn(window.electron.db.jobs, 'list')
    const { result } = renderHook(() => useFeed({ search: 'react', hasSalary: true }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ search: 'react', hasSalary: true })
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.db.jobs, 'list').mockResolvedValue({
      success: false,
      error: 'db exploded',
    })
    const { result } = renderHook(() => useFeed({}))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('db exploded')
  })
})

describe('useJob', () => {
  it('stays disabled while the id is null', () => {
    const spy = vi.spyOn(window.electron.db.jobs, 'get')
    const { result } = renderHook(() => useJob(null))
    expect(result.current.fetchStatus).toBe('idle')
    expect(spy).not.toHaveBeenCalled()
  })

  it('loads the job once an id is provided', async () => {
    const job = makeStoredJob({ id: 'ba:7' })
    setupMockElectron(createMockElectron({ jobs: [job] }))
    const { result } = renderHook(() => useJob('ba:7'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('ba:7')
  })

  it('resolves null for an unknown id', async () => {
    const { result } = renderHook(() => useJob('ba:missing'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

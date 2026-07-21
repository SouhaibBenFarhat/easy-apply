import type { StoredJob } from '@sources/shared'
import {
  act,
  createMockElectron,
  createTestQueryClient,
  renderHook,
  setupMockElectron,
  waitFor,
} from '@test-utils'
import { keys } from '../keys'
import { useSetJobHidden, useSetJobNotes, useSetJobStatus } from './jobs'

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

describe('useSetJobStatus', () => {
  it('optimistically patches every cached feed list and the detail entry', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    const other = makeStoredJob({ id: 'ba:2' })
    setupMockElectron(createMockElectron({ jobs: [job, other] }))
    // Never-resolving bridge call keeps the mutation in its optimistic window.
    vi.spyOn(window.electron.db.jobs, 'setStatus').mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [job, other])
    client.setQueryData(keys.jobs.feed({ search: 'acme' }), [job])
    client.setQueryData(keys.jobs.detail('ba:1'), job)

    const { result } = renderHook(() => useSetJobStatus(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', status: 'applied' })
    })

    await waitFor(() => {
      const feed = client.getQueryData<StoredJob[]>(keys.jobs.feed({}))
      expect(feed?.[0]?.status).toBe('applied')
    })
    const filtered = client.getQueryData<StoredJob[]>(keys.jobs.feed({ search: 'acme' }))
    expect(filtered?.[0]?.status).toBe('applied')
    const detail = client.getQueryData<StoredJob>(keys.jobs.detail('ba:1'))
    expect(detail?.status).toBe('applied')
    expect(detail?.statusUpdatedAt).not.toBeNull()
    // Other rows are untouched.
    const feed = client.getQueryData<StoredJob[]>(keys.jobs.feed({}))
    expect(feed?.[1]?.status).toBeNull()
  })

  it('rolls back every cached entry when the bridge rejects', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    vi.spyOn(window.electron.db.jobs, 'setStatus').mockRejectedValue(new Error('db down'))
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [job])
    client.setQueryData(keys.jobs.detail('ba:1'), job)

    const { result } = renderHook(() => useSetJobStatus(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', status: 'interview' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('db down')
    expect(client.getQueryData<StoredJob[]>(keys.jobs.feed({}))).toEqual([job])
    expect(client.getQueryData<StoredJob>(keys.jobs.detail('ba:1'))).toEqual(job)
  })

  it('rolls back when the bridge resolves an IpcResult failure', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    vi.spyOn(window.electron.db.jobs, 'setStatus').mockResolvedValue({
      success: false,
      error: 'no such job',
    })
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [job])

    const { result } = renderHook(() => useSetJobStatus(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', status: 'rejected' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('no such job')
    expect(client.getQueryData<StoredJob[]>(keys.jobs.feed({}))).toEqual([job])
  })

  it('resolves the updated row and invalidates jobs on success', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    setupMockElectron(createMockElectron({ jobs: [job] }))
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [job])

    const { result } = renderHook(() => useSetJobStatus(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', status: 'applied' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('applied')
    expect(client.getQueryState(keys.jobs.feed({}))?.isInvalidated).toBe(true)
  })
})

describe('useSetJobNotes', () => {
  it('saves notes and invalidates jobs', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    setupMockElectron(createMockElectron({ jobs: [job] }))
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.detail('ba:1'), job)

    const { result } = renderHook(() => useSetJobNotes(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', notes: 'referred by Anna' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.notes).toBe('referred by Anna')
    expect(client.getQueryState(keys.jobs.detail('ba:1'))?.isInvalidated).toBe(true)
  })
})

describe('useSetJobHidden', () => {
  it('hides the job and invalidates jobs', async () => {
    const job = makeStoredJob({ id: 'ba:1' })
    setupMockElectron(createMockElectron({ jobs: [job] }))
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [job])

    const { result } = renderHook(() => useSetJobHidden(), { client })
    act(() => {
      result.current.mutate({ id: 'ba:1', hidden: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.hidden).toBe(true)
    expect(client.getQueryState(keys.jobs.feed({}))?.isInvalidated).toBe(true)
  })
})

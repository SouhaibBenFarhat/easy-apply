import {
  act,
  createAgentTraceEmitter,
  createTestQueryClient,
  renderHook,
  setupMockElectron,
  waitFor,
} from '@test-utils'
import { useAgentTrace, useAgentTraceCollector } from './use-agent-trace'

describe('useAgentTrace', () => {
  it('collects trace push events into the cache in order', async () => {
    const mock = setupMockElectron()
    const emit = createAgentTraceEmitter(mock)
    const client = createTestQueryClient()
    const { result } = renderHook(
      () => {
        useAgentTraceCollector()
        return useAgentTrace()
      },
      { client },
    )

    expect(result.current.data).toEqual([])
    act(() => {
      emit({ seq: 0, at: '2026-07-21T09:00:00.000Z', channel: 'sync', label: 'Sync started' })
      emit({
        seq: 1,
        at: '2026-07-21T09:00:01.000Z',
        channel: 'llm',
        label: 'Prompt',
        body: 'x',
        chars: 1,
      })
    })

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.data?.map((event) => event.label)).toEqual(['Sync started', 'Prompt'])
  })

  // seq restarts at 0 for each pass — a new run must wipe the previous run's
  // timeline, not append to it.
  it('starts a fresh timeline when a new run begins', async () => {
    const mock = setupMockElectron()
    const emit = createAgentTraceEmitter(mock)
    const client = createTestQueryClient()
    const { result } = renderHook(
      () => {
        useAgentTraceCollector()
        return useAgentTrace()
      },
      { client },
    )

    act(() => {
      emit({ seq: 0, at: '2026-07-21T09:00:00.000Z', channel: 'sync', label: 'Sync started' })
      emit({ seq: 1, at: '2026-07-21T09:00:09.000Z', channel: 'sync', label: 'Sync finished' })
      emit({ seq: 0, at: '2026-07-21T10:00:00.000Z', channel: 'sync', label: 'Sync started' })
      emit({ seq: 1, at: '2026-07-21T10:00:01.000Z', channel: 'mailbox', label: 'Connecting…' })
    })

    await waitFor(() =>
      expect(result.current.data?.map((event) => event.label)).toEqual([
        'Sync started',
        'Connecting…',
      ]),
    )
    expect(result.current.data?.[0]?.at).toBe('2026-07-21T10:00:00.000Z')
  })

  // The mailbox agent upserts each email's jobs as it goes, so the feed has to
  // re-read mid-run. Waiting for sync:completed left it looking empty for the
  // whole (hour-long) scan.
  it('re-reads the feed as soon as new jobs are kept', async () => {
    const mock = setupMockElectron()
    const emit = createAgentTraceEmitter(mock)
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useAgentTraceCollector(), { client })

    const pipelineEvent = (seq: number, jobsKept: number): Parameters<typeof emit>[0] => ({
      seq,
      at: '2026-07-21T09:00:00.000Z',
      channel: 'pipeline',
      label: `Subject ${seq}`,
      stats: {
        phase: 'scanning',
        phaseDone: 0,
        phaseTotal: 0,
        emailsTotal: 10,
        emailsProcessed: seq,
        emailsAccepted: jobsKept,
        emailsRejected: 0,
        jobsProposed: jobsKept,
        jobsKept,
        capped: false,
        done: false,
        paused: false,
        current: null,
      },
    })

    // No jobs yet → nothing to re-read.
    act(() => emit(pipelineEvent(1, 0)))
    await waitFor(() => expect(invalidate).not.toHaveBeenCalled())

    act(() => emit(pipelineEvent(2, 2)))
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['jobs'] })),
    )

    // A steady count is not new work — no repeat invalidation.
    invalidate.mockClear()
    act(() => emit(pipelineEvent(3, 2)))
    await waitFor(() => expect(invalidate).not.toHaveBeenCalled())
  })
})

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
})

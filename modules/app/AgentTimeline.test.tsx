import type { AgentTraceEvent } from '@data'
import { keys } from '@data'
import { createTestQueryClient, render, screen, userEvent } from '@test-utils'
import { AgentTimeline } from './AgentTimeline'

function ev(
  seq: number,
  channel: AgentTraceEvent['channel'],
  label: string,
  body?: string,
): AgentTraceEvent {
  return { seq, at: '2026-07-21T09:00:15.000Z', channel, label, body }
}

describe('AgentTimeline', () => {
  it('shows an empty hint with no trace', () => {
    render(<AgentTimeline onClose={vi.fn()} />)
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument()
  })

  it('lists every checkpoint', () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.agent.trace, [
      ev(0, 'sync', 'Sync started'),
      ev(1, 'mailbox', 'Found 3 alert emails'),
      ev(2, 'mailbox', 'Inbox read failed'),
      ev(3, 'llm', 'Prompt · 42 chars', 'EXTRACT JOBS FROM THIS EMAIL'),
    ])
    render(<AgentTimeline onClose={vi.fn()} />, { client })

    expect(screen.getByText('Sync started')).toBeInTheDocument()
    expect(screen.getByText('Found 3 alert emails')).toBeInTheDocument()
    expect(screen.getByText('Prompt · 42 chars')).toBeInTheDocument()
  })

  it('closes on the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AgentTimeline onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close activity' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

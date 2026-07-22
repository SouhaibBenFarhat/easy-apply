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

  it('renders the pipeline funnel from the latest stats event', () => {
    const client = createTestQueryClient()
    client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, [
      ev(0, 'sync', 'Sync started'),
      {
        seq: 1,
        at: '2026-07-21T09:00:16.000Z',
        channel: 'pipeline',
        label: 'Email 8/12 · 2 job(s)',
        stats: {
          emailsTotal: 12,
          emailsProcessed: 8,
          emailsAccepted: 5,
          emailsRejected: 3,
          jobsProposed: 9,
          jobsKept: 7,
          capped: false,
          done: false,
          paused: false,
          current: null,
        },
      },
    ])
    render(<AgentTimeline onClose={vi.fn()} />, { client })

    expect(screen.getByLabelText('Pipeline')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67')
    expect(screen.getByText('8 / 12')).toBeInTheDocument()
    // Footer summarizes the run instead of a raw checkpoint count.
    expect(screen.getByText('7 jobs · 8/12 emails')).toBeInTheDocument()
  })

  it('links a scanned-email row to Gmail when the event carries a url', () => {
    const client = createTestQueryClient()
    client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, [
      {
        seq: 0,
        at: '2026-07-21T22:15:04.000Z',
        channel: 'pipeline',
        label: 'Analyzing "Your application was viewed by Oliver Bernard"',
        stats: {
          emailsTotal: 5,
          emailsProcessed: 2,
          emailsAccepted: 1,
          emailsRejected: 1,
          jobsProposed: 3,
          jobsKept: 1,
          capped: false,
          done: false,
          paused: false,
          current: {
            subject: 'Your application was viewed by Oliver Bernard',
            sender: 'jobs@linkedin.com',
            url: 'https://mail.google.com/mail/u/0/#search/rfc822msgid%3Ax',
          },
        },
      },
    ])
    render(<AgentTimeline onClose={vi.fn()} />, { client })

    expect(screen.getByRole('link', { name: /Analyzing/ })).toHaveAttribute(
      'href',
      'https://mail.google.com/mail/u/0/#search/rfc822msgid%3Ax',
    )
  })

  it('collapses a thinking event by default and expands it on click', async () => {
    const client = createTestQueryClient()
    client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, [
      ev(0, 'sync', 'Sync started'),
      ev(1, 'thinking', 'Thinking · 24 chars', 'Let me scan for postings'),
    ])
    const user = userEvent.setup()
    render(<AgentTimeline onClose={vi.fn()} />, { client })

    // Collapsed: the reasoning body is hidden until the user opens it.
    expect(screen.getByRole('button', { name: /Thinking/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('Let me scan for postings')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Thinking/ }))
    expect(screen.getByText('Let me scan for postings')).toBeInTheDocument()
  })

  it('closes on the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AgentTimeline onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close activity' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

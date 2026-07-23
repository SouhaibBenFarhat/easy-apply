import type { AgentTraceEvent } from '@data'
import { keys } from '@data'
import { act, createTestQueryClient, render, screen, userEvent, waitFor } from '@test-utils'
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
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />)
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument()
  })

  // The app's single launch point lives here, and only while idle — once a run
  // is under way the transport owns the controls, so Start can never become a
  // second way to kick one off.
  it('starts a run while idle and hides Start once one is under way', async () => {
    const onStart = vi.fn()
    const client = createTestQueryClient()
    render(<AgentTimeline onClose={vi.fn()} onStart={onStart} />, { client })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start' }))
    expect(onStart).toHaveBeenCalledTimes(1)

    client.setQueryData(keys.agent.state, 'running')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument(),
    )
  })

  // Each email's verdict row carries the jobs it produced, so the agent's
  // judgement can be checked against the real postings.
  it('shows the jobs an email yielded under its verdict row', () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.agent.trace, [
      {
        ...ev(0, 'pipeline', 'Backend roles for you · 1 job(s)'),
        jobs: [
          {
            id: 'linkedin:1',
            title: 'Senior TypeScript Engineer',
            company: 'Petrol GmbH',
            url: 'https://jobs.example.com/1',
          },
        ],
      },
      ev(1, 'pipeline', 'Newsletter · no jobs'),
    ])
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

    expect(screen.getByRole('link', { name: /Senior TypeScript Engineer/ })).toHaveAttribute(
      'href',
      'https://jobs.example.com/1',
    )
    // A rejected email contributes no rows to audit.
    expect(screen.getByText('Newsletter · no jobs')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('lists every checkpoint', () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.agent.trace, [
      ev(0, 'sync', 'Sync started'),
      ev(1, 'mailbox', 'Found 3 alert emails'),
      ev(2, 'mailbox', 'Inbox read failed'),
      ev(3, 'llm', 'Prompt · 42 chars', 'EXTRACT JOBS FROM THIS EMAIL'),
    ])
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

    expect(screen.getByText('Sync started')).toBeInTheDocument()
    expect(screen.getByText('Found 3 alert emails')).toBeInTheDocument()
    expect(screen.getByText('Prompt · 42 chars')).toBeInTheDocument()
  })

  // Each step's execution time — stamped in main on the completion row — is
  // pinned to the right of both plain and expandable rows.
  it('shows the execution time on rows that carry one', () => {
    const client = createTestQueryClient()
    client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, [
      ev(0, 'sync', 'Sync started'),
      { ...ev(1, 'pipeline', 'Backend roles for you · no jobs'), jobs: [], durationMs: 12_400 },
      { ...ev(2, 'llm', 'Response · 96 chars', '[]'), durationMs: 842 },
    ])
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

    expect(screen.getByText('12s')).toBeInTheDocument() // verdict row
    expect(screen.getByText('842ms')).toBeInTheDocument() // expandable LLM row
    // A start marker has no duration to show.
    expect(screen.queryByText(/^0ms$/)).not.toBeInTheDocument()
  })

  // The in-flight step gets a live stopwatch: elapsed since its main-stamped
  // start, ticking each second, gone once the completion row lands (which
  // carries the final figure instead). A stopwatch face ("0:05"), not a
  // duration ("5.0s"), so a running count never reads as a measurement.
  it('ticks a live counter on the in-flight step', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-21T09:00:20.000Z'))
    try {
      const client = createTestQueryClient()
      client.setQueryData(keys.agent.state, 'running')
      client.setQueryData<AgentTraceEvent[]>(keys.agent.trace, [
        { ...ev(0, 'llm', 'Response · 96 chars', '[]'), durationMs: 842 },
        ev(1, 'pipeline', 'Analyzing "Backend roles for you"'), // at 09:00:15
      ])
      render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

      expect(screen.getByText('0:05')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3_000)
      })
      expect(screen.getByText('0:08')).toBeInTheDocument()
      // The finished row keeps its stamped duration — no counter there.
      expect(screen.getByText('842ms')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
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
          phase: 'scanning',
          phaseDone: 0,
          phaseTotal: 0,
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
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

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
          phase: 'scanning',
          phaseDone: 0,
          phaseTotal: 0,
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
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

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
    render(<AgentTimeline onClose={vi.fn()} onStart={vi.fn()} />, { client })

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
    render(<AgentTimeline onClose={onClose} onStart={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Close activity' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

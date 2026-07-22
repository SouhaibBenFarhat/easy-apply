import type { AgentPipelineStats } from '@data'
import { render, screen, userEvent } from '@test-utils'
import { PipelineFunnel } from './PipelineFunnel'

function stats(overrides: Partial<AgentPipelineStats> = {}): AgentPipelineStats {
  return {
    emailsTotal: 10,
    emailsProcessed: 4,
    emailsAccepted: 3,
    emailsRejected: 1,
    jobsProposed: 5,
    jobsKept: 4,
    capped: false,
    done: false,
    paused: false,
    current: null,
    ...overrides,
  }
}

describe('PipelineFunnel', () => {
  it('renders progress and the funnel counts', () => {
    render(<PipelineFunnel stats={stats()} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('4 / 10')).toBeInTheDocument()
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Jobs found')).toBeInTheDocument()
    expect(screen.getByText('Kept')).toBeInTheDocument()
  })

  it('shows the email currently under analysis', () => {
    render(
      <PipelineFunnel
        stats={stats({
          current: { subject: 'Backend roles for you', sender: 'jobs@linkedin.com', url: null },
        })}
      />,
    )
    expect(screen.getByText('Backend roles for you')).toBeInTheDocument()
    expect(screen.getByText('jobs@linkedin.com')).toBeInTheDocument()
  })

  it('links the current email subject to Gmail when a url is present', () => {
    render(
      <PipelineFunnel
        stats={stats({
          current: {
            subject: 'Backend roles for you',
            sender: 'jobs@linkedin.com',
            url: 'https://mail.google.com/mail/u/me%40gmail.com/#search/rfc822msgid%3Ax',
          },
        })}
      />,
    )
    expect(screen.getByRole('link', { name: 'Backend roles for you' })).toHaveAttribute(
      'href',
      'https://mail.google.com/mail/u/me%40gmail.com/#search/rfc822msgid%3Ax',
    )
  })

  it('shows a capped badge when the inbox was truncated', () => {
    render(<PipelineFunnel stats={stats({ capped: true })} />)
    expect(screen.getByText('capped')).toBeInTheDocument()
  })

  it('omits the capped badge when the inbox fit under the cap', () => {
    render(<PipelineFunnel stats={stats({ capped: false })} />)
    expect(screen.queryByText('capped')).not.toBeInTheDocument()
  })

  it('offers Stop while running and fires onStop', async () => {
    const onStop = vi.fn()
    const user = userEvent.setup()
    render(
      <PipelineFunnel stats={stats({ emailsProcessed: 4, emailsTotal: 10 })} onStop={onStop} />,
    )

    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('offers Pause while running and Resume while paused', async () => {
    const onPause = vi.fn()
    const onResume = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <PipelineFunnel stats={stats()} onPause={onPause} onResume={onResume} />,
    )
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()

    rerender(
      <PipelineFunnel stats={stats({ paused: true })} onPause={onPause} onResume={onResume} />,
    )
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('hides Stop once the run is done or stopped', () => {
    // `done` — not the count — hides Stop, so a stopped run (processed < total)
    // also loses the button.
    render(<PipelineFunnel stats={stats({ done: true, emailsProcessed: 5 })} onStop={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })
})

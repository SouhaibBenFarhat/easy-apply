import type { AgentPipelineStats, AgentState } from '@data'
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

const NOOP = (): void => {}

function renderFunnel(
  props: { stats?: AgentPipelineStats; state?: AgentState } & Partial<{
    onStop: () => void
    onPause: () => void
    onResume: () => void
  }> = {},
): ReturnType<typeof render> {
  const { stats: seed = stats(), state = 'running', ...handlers } = props
  return render(
    <PipelineFunnel
      stats={seed}
      state={state}
      onStop={handlers.onStop ?? NOOP}
      onPause={handlers.onPause ?? NOOP}
      onResume={handlers.onResume ?? NOOP}
    />,
  )
}

describe('PipelineFunnel', () => {
  it('renders progress and the funnel counts', () => {
    renderFunnel()

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('4 / 10')).toBeInTheDocument()
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Jobs found')).toBeInTheDocument()
    expect(screen.getByText('Kept')).toBeInTheDocument()
  })

  it('shows the email currently under analysis', () => {
    renderFunnel({
      stats: stats({
        current: { subject: 'Backend roles for you', sender: 'jobs@linkedin.com', url: null },
      }),
    })
    expect(screen.getByText('Backend roles for you')).toBeInTheDocument()
    expect(screen.getByText('jobs@linkedin.com')).toBeInTheDocument()
  })

  it('links the current email subject to Gmail when a url is present', () => {
    renderFunnel({
      stats: stats({
        current: {
          subject: 'Backend roles for you',
          sender: 'jobs@linkedin.com',
          url: 'https://mail.google.com/mail/u/me%40gmail.com/#search/rfc822msgid%3Ax',
        },
      }),
    })
    expect(screen.getByRole('link', { name: 'Backend roles for you' })).toHaveAttribute(
      'href',
      'https://mail.google.com/mail/u/me%40gmail.com/#search/rfc822msgid%3Ax',
    )
  })

  it('shows a capped badge when the inbox was truncated', () => {
    renderFunnel({ stats: stats({ capped: true }) })
    expect(screen.getByText('capped')).toBeInTheDocument()
  })

  it('omits the capped badge when the inbox fit under the cap', () => {
    renderFunnel({ stats: stats({ capped: false }) })
    expect(screen.queryByText('capped')).not.toBeInTheDocument()
  })

  it('offers Stop while running and fires onStop', async () => {
    const onStop = vi.fn()
    renderFunnel({ onStop })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('offers Pause while running and Resume while paused', async () => {
    const onPause = vi.fn()
    const onResume = vi.fn()
    const user = userEvent.setup()

    const { unmount } = renderFunnel({ state: 'running', onPause, onResume })
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
    unmount()

    renderFunnel({ state: 'paused', onPause, onResume })
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  // The bug this rework exists for: a pause only takes effect between emails,
  // so the funnel has to show that it is winding down instead of looking as if
  // the click did nothing.
  it('announces a pause that has not reached its checkpoint yet', () => {
    renderFunnel({ state: 'pausing' })
    expect(screen.getByText('pausing…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pausing…' })).toBeDisabled()
    // Stop is still live — a slow pause must never trap the run.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
  })

  it('labels a run that is actually held', () => {
    renderFunnel({ state: 'paused' })
    expect(screen.getByText('paused')).toBeInTheDocument()
  })

  // Starting a run lives in the sidebar, so an idle funnel shows counts only —
  // no transport at all, and never a second way to kick a run off.
  it('drops the whole transport once the run is idle', () => {
    renderFunnel({ state: 'idle', stats: stats({ done: true, emailsProcessed: 5 }) })

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument()
    // The funnel itself still reports the finished run.
    expect(screen.getByText('5 / 10')).toBeInTheDocument()
  })
})

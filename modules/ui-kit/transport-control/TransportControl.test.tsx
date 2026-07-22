import { render, screen, userEvent } from '@test-utils'
import { TransportControl, type TransportState } from './TransportControl'

function setup(state: TransportState): {
  onPause: ReturnType<typeof vi.fn>
  onResume: ReturnType<typeof vi.fn>
  onStop: ReturnType<typeof vi.fn>
} {
  const handlers = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
  }
  render(<TransportControl state={state} {...handlers} />)
  return handlers
}

describe('TransportControl', () => {
  // Runs begin from exactly one place (the sidebar), so an idle transport is
  // not a start button — it is nothing at all.
  it('renders nothing when idle', () => {
    setup('idle')
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pauses while running', async () => {
    const { onPause } = setup('running')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pause' }))
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  // The regression this whole state exists for: a pause that has been requested
  // but has not yet reached its checkpoint must SAY so, not sit there looking
  // identical to a running scan.
  it('reads as pending, not inert, while pausing', async () => {
    const { onPause, onResume } = setup('pausing')
    const primary = screen.getByRole('button', { name: 'Pausing…' })
    expect(primary).toBeDisabled()
    await userEvent.setup().click(primary)
    expect(onPause).not.toHaveBeenCalled()
    expect(onResume).not.toHaveBeenCalled()
    // Stop stays live — a slow pause must never trap you in the run.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
  })

  it('resumes from paused', async () => {
    const { onResume } = setup('paused')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume' }))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('stops from every active state', async () => {
    const user = userEvent.setup()
    for (const state of ['running', 'pausing', 'paused'] as const) {
      const { onStop } = setup(state)
      await user.click(screen.getAllByRole('button', { name: 'Stop' }).at(-1) as HTMLElement)
      expect(onStop).toHaveBeenCalledTimes(1)
    }
  })
})

import { render, screen, userEvent } from '@test-utils'
import { AgentMonitorButton } from './AgentMonitorButton'

describe('AgentMonitorButton', () => {
  it('reflects the pressed state and toggles on click', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<AgentMonitorButton open={false} onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: 'Agent activity' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

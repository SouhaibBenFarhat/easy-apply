import { render, screen, userEvent } from '@test-utils'

import { Switch } from './Switch'

describe('Switch', () => {
  it('renders an unchecked switch by default', () => {
    render(<Switch aria-label="Notifications" />)
    const toggle = screen.getByRole('switch', { name: 'Notifications' })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('data-state', 'unchecked')
  })

  it('toggles checked state on click', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="Notifications" />)
    const toggle = screen.getByRole('switch', { name: 'Notifications' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('data-state', 'checked')
  })

  it('calls onCheckedChange when toggled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Notifications" onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole('switch', { name: 'Notifications' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Notifications" disabled onCheckedChange={onCheckedChange} />)
    const toggle = screen.getByRole('switch', { name: 'Notifications' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})

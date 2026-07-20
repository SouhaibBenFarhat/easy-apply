import { render, screen, userEvent } from '@test-utils'
import { Input } from './Input'

describe('Input', () => {
  it('renders a textbox with base classes', () => {
    render(<Input placeholder="Search jobs" />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('bg-input', 'border-border', 'rounded')
  })

  it('lightens to background on focus via focus-visible classes', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('focus-visible:bg-background', 'focus-visible:border-primary')
  })

  it('accepts typed text', async () => {
    const user = userEvent.setup()
    render(<Input />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'Munich')
    expect(input).toHaveValue('Munich')
  })

  it('does not accept input when disabled', async () => {
    const user = userEvent.setup()
    render(<Input disabled />)
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    await user.type(input, 'nope')
    expect(input).toHaveValue('')
  })

  it('merges a custom className', () => {
    render(<Input className="w-64" />)
    expect(screen.getByRole('textbox')).toHaveClass('w-64')
  })
})

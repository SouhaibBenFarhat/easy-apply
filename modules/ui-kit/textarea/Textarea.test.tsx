import { render, screen, userEvent } from '@test-utils'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders a textarea with placeholder', () => {
    render(<Textarea placeholder="Cover letter" />)
    expect(screen.getByPlaceholderText('Cover letter')).toBeInTheDocument()
  })

  it('accepts typed input', async () => {
    const user = userEvent.setup()
    render(<Textarea aria-label="Notes" />)
    const textarea = screen.getByRole('textbox', { name: 'Notes' })
    await user.type(textarea, 'hello')
    expect(textarea).toHaveValue('hello')
  })

  it('merges custom className', () => {
    render(<Textarea aria-label="Notes" className="min-h-40" />)
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass('min-h-40')
  })

  it('is disabled when the disabled prop is set', () => {
    render(<Textarea aria-label="Notes" disabled />)
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeDisabled()
  })
})

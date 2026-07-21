import { render, screen, userEvent } from '@test-utils'
import { Button } from './Button'

describe('Button', () => {
  it('renders a button with type="button" by default', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('applies the default variant and size classes', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground', 'h-9')
  })

  it('applies secondary variant classes that stay visible on elevated surfaces', () => {
    render(<Button variant="secondary">Open</Button>)
    const button = screen.getByRole('button', { name: 'Open' })
    expect(button).toHaveClass('bg-surface-hover', 'border-border', 'shadow-elevation-low')
  })

  it('applies ghost variant and icon size classes', () => {
    render(
      <Button variant="ghost" size="icon" aria-label="Settings">
        S
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Settings' })
    expect(button).toHaveClass('hover:bg-interactive-hover', 'h-9', 'w-9')
  })

  it('calls onClick when clicked and not when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
  })

  it('renders the child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/jobs">Jobs</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Jobs' })
    expect(link).toHaveClass('inline-flex')
    expect(link).not.toHaveAttribute('type')
  })
})

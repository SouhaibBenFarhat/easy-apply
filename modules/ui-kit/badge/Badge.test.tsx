import { render, screen } from '@test-utils'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Remote</Badge>)
    expect(screen.getByText('Remote')).toBeInTheDocument()
  })

  it('applies default variant classes', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('bg-surface-raised', 'border-border', 'text-foreground')
  })

  it('applies copper variant classes', () => {
    render(<Badge variant="copper">85k EUR</Badge>)
    const badge = screen.getByText('85k EUR')
    expect(badge).toHaveClass('bg-primary/15', 'border-primary/40', 'text-primary')
  })

  it('applies outline variant classes', () => {
    render(<Badge variant="outline">Draft</Badge>)
    const badge = screen.getByText('Draft')
    expect(badge).toHaveClass('bg-transparent', 'text-foreground-muted')
  })

  it('merges a custom className with base classes', () => {
    render(<Badge className="ml-2">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('ml-2', 'rounded-full', 'inline-flex')
  })

  it('renders as a span and forwards native props', () => {
    render(
      <Badge data-testid="badge" title="Salary">
        Info
      </Badge>,
    )
    const badge = screen.getByTestId('badge')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).toHaveAttribute('title', 'Salary')
  })
})

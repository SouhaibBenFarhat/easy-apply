import { render, screen } from '@test-utils'
import { Separator } from './Separator'

describe('Separator', () => {
  it('renders as decorative by default without a separator role', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('applies horizontal classes by default', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('shrink-0', 'bg-border', 'h-px', 'w-full')
  })

  it('applies vertical classes when orientation is vertical', () => {
    render(<Separator orientation="vertical" data-testid="sep" />)
    expect(screen.getByTestId('sep')).toHaveClass('h-full', 'w-px')
  })

  it('exposes the separator role when not decorative', () => {
    render(<Separator decorative={false} />)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    render(<Separator data-testid="sep" className="my-4" />)
    expect(screen.getByTestId('sep')).toHaveClass('my-4', 'bg-border')
  })
})

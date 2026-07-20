import { render, screen } from '@test-utils'

import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a div with the skeleton animation classes', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.tagName).toBe('DIV')
    expect(skeleton).toHaveClass('animate-skeleton', 'rounded-md', 'bg-border-muted')
  })

  it('merges a custom className with the base classes', () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-32" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('h-4', 'w-32', 'animate-skeleton')
  })

  it('forwards arbitrary div props', () => {
    render(<Skeleton data-testid="skeleton" aria-hidden="true" id="loading-block" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveAttribute('id', 'loading-block')
  })
})

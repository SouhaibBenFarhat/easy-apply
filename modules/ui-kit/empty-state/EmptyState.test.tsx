import { render, screen } from '@test-utils'

import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title as a heading', () => {
    render(<EmptyState title="No jobs found" />)
    expect(screen.getByRole('heading', { name: 'No jobs found' })).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="No jobs found" description="Try adjusting your filters" />)
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
  })

  it('renders icon and action content', () => {
    render(
      <EmptyState
        title="No jobs found"
        icon={<span data-testid="icon" />}
        action={<button type="button">Clear filters</button>}
      />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('omits description and action when not provided', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })
})

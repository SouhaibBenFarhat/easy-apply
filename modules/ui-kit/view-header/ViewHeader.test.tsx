import { render, screen } from '@test-utils'
import { ViewHeader } from './ViewHeader'

describe('ViewHeader', () => {
  it('renders the title as a level-one heading', () => {
    render(<ViewHeader title="Applications" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Applications' })).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<ViewHeader title="Applications" subtitle="12 open" />)
    expect(screen.getByText('12 open')).toBeInTheDocument()
  })

  it('renders right-aligned action children', () => {
    render(
      <ViewHeader title="Applications">
        <button type="button">Refresh</button>
      </ViewHeader>,
    )
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('renders a banner landmark and forwards extra props', () => {
    render(<ViewHeader title="Applications" data-testid="view-header" />)
    const header = screen.getByRole('banner')
    expect(header).toHaveAttribute('data-testid', 'view-header')
  })
})

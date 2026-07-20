import { render, screen } from '@test-utils'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card'

describe('Card', () => {
  it('renders a full card composition with accessible structure', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Frontend Engineer</CardTitle>
          <CardDescription>Munich, Germany</CardDescription>
        </CardHeader>
        <CardContent>Job details</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>,
    )

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Frontend Engineer' })).toBeInTheDocument()
    expect(screen.getByText('Munich, Germany')).toBeInTheDocument()
    expect(screen.getByText('Job details')).toBeInTheDocument()
  })

  it('merges custom className on the root', () => {
    render(<Card data-testid="card" className="w-64" />)

    expect(screen.getByTestId('card')).toHaveClass('w-64', 'rounded-xl')
  })
})

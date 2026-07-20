import { render, screen } from '@test-utils'
import { Label } from './Label'

describe('Label', () => {
  it('renders its text content', () => {
    render(<Label>Email</Label>)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('applies base typography and peer-disabled classes', () => {
    render(<Label>Email</Label>)
    const label = screen.getByText('Email')
    expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-40')
  })

  it('merges custom className', () => {
    render(<Label className="text-foreground-muted">Email</Label>)
    expect(screen.getByText('Email')).toHaveClass('text-foreground-muted', 'text-sm')
  })

  it('associates with a form control via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" type="text" />
      </>,
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})

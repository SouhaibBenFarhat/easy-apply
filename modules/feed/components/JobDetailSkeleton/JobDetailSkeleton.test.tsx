import { render, screen } from '@test-utils'
import { JobDetailSkeleton } from './JobDetailSkeleton'

describe('JobDetailSkeleton', () => {
  it('announces itself as a loading placeholder', () => {
    render(<JobDetailSkeleton />)
    expect(screen.getByRole('status', { name: 'Loading job details' })).toBeInTheDocument()
  })
})

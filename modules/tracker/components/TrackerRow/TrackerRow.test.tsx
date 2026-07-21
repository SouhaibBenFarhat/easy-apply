import { render, screen, userEvent } from '@test-utils'
import { makeJob, makeSalary } from '../../test-helpers'
import { TrackerRow } from './TrackerRow'

// happy-dom lacks pointer-capture and scrollIntoView APIs that Radix Select
// relies on (same shim as the ui-kit Select tests).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('TrackerRow', () => {
  it('renders title, salary badge and the status meta line', () => {
    const job = makeJob({
      title: 'Staff Engineer',
      company: 'Petrol AG',
      status: 'applied',
      statusUpdatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      salary: makeSalary({ min: 60000, max: 80000, currency: 'EUR' }),
    })
    render(<TrackerRow job={job} sourceName="Arbeitnow" onSetStatus={vi.fn()} />)

    expect(screen.getByText('Staff Engineer')).toBeInTheDocument()
    expect(screen.getByText('€60k–€80k')).toBeInTheDocument()
    expect(screen.getByText(/Petrol AG · Arbeitnow · Applied 3 days ago/)).toBeInTheDocument()
  })

  it('omits the salary badge when the salary has no bounds', () => {
    render(
      <TrackerRow job={makeJob({ status: 'interested' })} sourceName="X" onSetStatus={vi.fn()} />,
    )
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
  })

  it('links to applyUrl when present', () => {
    const job = makeJob({
      status: 'applied',
      url: 'https://board.example/post',
      applyUrl: 'https://company.example/apply',
    })
    render(<TrackerRow job={job} sourceName="X" onSetStatus={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Open posting' })).toHaveAttribute(
      'href',
      'https://company.example/apply',
    )
  })

  it('falls back to the posting url without an applyUrl', () => {
    const job = makeJob({ status: 'applied', url: 'https://board.example/post', applyUrl: null })
    render(<TrackerRow job={job} sourceName="X" onSetStatus={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Open posting' })).toHaveAttribute(
      'href',
      'https://board.example/post',
    )
  })

  it('changes the status through the select', async () => {
    const onSetStatus = vi.fn()
    const job = makeJob({ status: 'interested' })
    const user = userEvent.setup()
    render(<TrackerRow job={job} sourceName="X" onSetStatus={onSetStatus} />)

    await user.click(screen.getByRole('combobox', { name: 'Set status' }))
    await user.click(await screen.findByRole('option', { name: 'Interview' }))

    expect(onSetStatus).toHaveBeenCalledExactlyOnceWith(job.id, 'interview')
  })

  it('clears the status with the remove button and explains it in a tooltip', async () => {
    const onSetStatus = vi.fn()
    const job = makeJob({ status: 'rejected' })
    const user = userEvent.setup()
    render(<TrackerRow job={job} sourceName="X" onSetStatus={onSetStatus} />)

    const remove = screen.getByRole('button', { name: 'Remove from tracker' })
    await user.hover(remove)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Remove from tracker')

    await user.click(remove)
    expect(onSetStatus).toHaveBeenCalledExactlyOnceWith(job.id, null)
  })
})

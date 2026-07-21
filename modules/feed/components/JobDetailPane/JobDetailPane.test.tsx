import { render, screen, userEvent } from '@test-utils'
import { makeJob, makeSalary } from '../../test-helpers'
import { JobDetailPane } from './JobDetailPane'

function renderPane(
  props: Partial<Parameters<typeof JobDetailPane>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <JobDetailPane
      job={null}
      sourceName={null}
      onSetStatus={() => {}}
      onSetNotes={() => {}}
      onHide={() => {}}
      {...props}
    />,
  )
}

describe('JobDetailPane', () => {
  it('shows the empty state without a selection', () => {
    renderPane()
    expect(screen.getByText('Select a job')).toBeInTheDocument()
  })

  it('renders title, meta, badges and the fade wrapper', () => {
    const job = makeJob({
      title: 'Staff Engineer',
      company: 'Copper AG',
      city: 'München',
      workMode: 'hybrid',
      remoteScope: 'germany',
      status: 'interview',
      salary: makeSalary({ min: 90000, currency: 'EUR' }),
    })
    const { container } = renderPane({ job, sourceName: 'Arbeitnow' })

    expect(screen.getByRole('heading', { level: 2, name: 'Staff Engineer' })).toBeInTheDocument()
    expect(screen.getByText(/Copper AG · München · posted/)).toBeInTheDocument()
    expect(screen.getByText('Hybrid')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('€90k+')).toBeInTheDocument()
    // Status appears as a badge AND as the active toggle button.
    expect(screen.getAllByText('Interview').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.animate-fade-in')).not.toBeNull()
  })

  it('links the primary action to applyUrl when present, falling back to url', () => {
    const job = makeJob({ applyUrl: 'https://apply.example.com/123' })
    renderPane({ job })
    const open = screen.getByRole('link', { name: /Open application page/ })
    expect(open).toHaveAttribute('href', 'https://apply.example.com/123')
    expect(open).toHaveAttribute('target', '_blank')
    expect(open).toHaveAttribute('rel', 'noreferrer')

    renderPane({ job: makeJob({ applyUrl: null, url: 'https://posting.example.com/1' }) })
    const fallback = screen.getAllByRole('link', { name: /Open application page/ }).at(-1)
    expect(fallback).toHaveAttribute('href', 'https://posting.example.com/1')
  })

  it('toggles a status on and back off', async () => {
    const onSetStatus = vi.fn()
    const user = userEvent.setup()
    renderPane({ job: makeJob({ status: null }), onSetStatus })

    await user.click(screen.getByRole('button', { name: 'Applied' }))
    expect(onSetStatus).toHaveBeenCalledExactlyOnceWith('applied')

    onSetStatus.mockClear()
    renderPane({ job: makeJob({ status: 'applied' }), onSetStatus })
    await user.click(screen.getAllByRole('button', { name: 'Applied' }).at(-1) as HTMLElement)
    expect(onSetStatus).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('saves notes on blur only when changed', async () => {
    const onSetNotes = vi.fn()
    const user = userEvent.setup()
    renderPane({ job: makeJob({ notes: null }), onSetNotes })

    const notes = screen.getByLabelText('Notes')
    await user.click(notes)
    await user.keyboard('call back on Monday')
    await user.tab()
    expect(onSetNotes).toHaveBeenCalledExactlyOnceWith('call back on Monday')

    // Once the stored notes match the field (mutation settled), blur is a no-op.
    onSetNotes.mockClear()
    renderPane({ job: makeJob({ notes: 'call back on Monday' }), onSetNotes })
    const saved = screen.getAllByLabelText('Notes').at(-1) as HTMLElement
    await user.click(saved)
    await user.tab()
    expect(onSetNotes).not.toHaveBeenCalled()
  })

  it('clears notes emptied on blur', async () => {
    const onSetNotes = vi.fn()
    const user = userEvent.setup()
    renderPane({ job: makeJob({ notes: 'old note' }), onSetNotes })

    const notes = screen.getByLabelText('Notes')
    expect(notes).toHaveValue('old note')
    await user.clear(notes)
    await user.tab()
    expect(onSetNotes).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('hides the job', async () => {
    const onHide = vi.fn()
    renderPane({ job: makeJob(), onHide })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide' }))
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('renders the sanitized description', () => {
    const job = makeJob({
      descriptionHtml: '<p>Great <strong>role</strong></p><script>alert(1)</script>',
    })
    renderPane({ job })
    expect(screen.getByText(/Great/)).toBeInTheDocument()
    expect(screen.getByText('role')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('falls back when the source ships no description', () => {
    renderPane({ job: makeJob({ descriptionHtml: null }) })
    expect(
      screen.getByText('No description from this source — open the posting.'),
    ).toBeInTheDocument()
  })

  it('always shows the attribution link back to the posting', () => {
    const job = makeJob({ url: 'https://www.arbeitnow.com/jobs/abc', descriptionHtml: null })
    renderPane({ job, sourceName: 'Arbeitnow' })
    const attribution = screen.getByRole('link', { name: 'via Arbeitnow ↗' })
    expect(attribution).toHaveAttribute('href', 'https://www.arbeitnow.com/jobs/abc')
  })

  it('falls back to the source id when the display name is unknown', () => {
    renderPane({ job: makeJob({ sourceId: 'wwr' }), sourceName: null })
    expect(screen.getByRole('link', { name: 'via wwr ↗' })).toBeInTheDocument()
  })
})

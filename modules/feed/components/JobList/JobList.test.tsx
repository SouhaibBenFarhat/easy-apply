import { render, screen, userEvent, within } from '@test-utils'
import { makeJob, makeSalary, mockElementRects } from '../../test-helpers'
import { JobList } from './JobList'

beforeAll(() => {
  mockElementRects()
})

const SOURCE_NAMES = { arbeitnow: 'Arbeitnow', remoteok: 'RemoteOK' }

function renderList(props: Partial<Parameters<typeof JobList>[0]> = {}): ReturnType<typeof render> {
  return render(
    <JobList
      jobs={[]}
      selectedId={null}
      onSelect={() => {}}
      newSince={null}
      sourceNames={SOURCE_NAMES}
      {...props}
    />,
  )
}

describe('JobList', () => {
  // Module-level entrance latch: the FIRST mount in this file is this test,
  // so it owns the "plays once" assertion; everything after sees no stagger.
  it('plays the staggered entrance only on the first mount per session', () => {
    const jobs = [makeJob({ title: 'First job' }), makeJob({ title: 'Second job' })]
    const { unmount } = renderList({ jobs })
    const first = screen.getByRole('button', { name: /First job/ })
    expect(first).toHaveClass('animate-rise-in')
    expect(screen.getByRole('button', { name: /Second job/ }).style.animationDelay).toBe('30ms')
    unmount()

    renderList({ jobs })
    expect(screen.getByRole('button', { name: /First job/ })).not.toHaveClass('animate-rise-in')
  })

  it('renders flat rows inside the scroll container (virtualizer smoke)', () => {
    const jobs = Array.from({ length: 30 }, (_, i) => makeJob({ title: `Job number ${i}` }))
    const { container } = renderList({ jobs })

    // 600px viewport / 64px rows + overscan 8 → a strict subset renders.
    expect(screen.getByRole('button', { name: /Job number 0\b/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Job number 1\b/ })).toBeInTheDocument()
    const rendered = screen.getAllByRole('button')
    expect(rendered.length).toBeGreaterThanOrEqual(8)
    expect(rendered.length).toBeLessThan(30)

    // Total scroll height accounts for every row, not just the rendered ones.
    const sizer = container.querySelector('[style*="height"]')
    expect(sizer).toHaveStyle({ height: `${30 * 64}px` })
  })

  it('shows title, meta line, badges and salary on a row', () => {
    const job = makeJob({
      title: 'Senior TypeScript Engineer',
      company: 'Petrol GmbH',
      city: 'München',
      workMode: 'remote',
      remoteScope: 'europe',
      status: 'applied',
      salary: makeSalary({ min: 60000, max: 80000, currency: 'EUR' }),
    })
    renderList({ jobs: [job] })

    const row = screen.getByRole('button', { name: /Senior TypeScript Engineer/ })
    expect(within(row).getByText('€60k–€80k')).toBeInTheDocument()
    // One quiet meta line, fixed order — and zero redundancy: remote rows
    // show the SCOPE as their place (the mode slot already says REMOTE), so
    // the city is dropped. Time + source are right-anchored, never truncated.
    expect(within(row).getByText('Remote')).toBeInTheDocument()
    expect(within(row).getByText('Petrol GmbH · Europe')).toBeInTheDocument()
    expect(within(row).getByText(/· Arbeitnow$/)).toBeInTheDocument()
    expect(within(row).queryByText(/München/)).not.toBeInTheDocument()
    expect(within(row).getByText('Applied')).toBeInTheDocument()
  })

  it('falls back to locationRaw and the raw source id', () => {
    const job = makeJob({
      city: null,
      locationRaw: 'Somewhere, DE',
      sourceId: 'wwr',
      workMode: 'unknown',
    })
    renderList({ jobs: [job] })
    const row = screen.getByRole('button')
    expect(within(row).getByText(/Somewhere, DE/)).toBeInTheDocument()
    expect(within(row).getByText(/· wwr$/)).toBeInTheDocument()
    // Unknown mode renders an empty fixed-width slot, never a "?" chip.
    expect(within(row).queryByText('?')).not.toBeInTheDocument()
  })

  it('marks the selected row and paints the copper indicator', () => {
    const jobs = [makeJob({ title: 'Picked' }), makeJob({ title: 'Other' })]
    const selected = jobs[0] as NonNullable<(typeof jobs)[0]>
    renderList({ jobs, selectedId: selected.id })

    const row = screen.getByRole('button', { name: /Picked/ })
    expect(row).toHaveAttribute('data-selected', 'true')
    expect(row.className).toContain('bg-primary/10')
    expect(screen.getByRole('button', { name: /Other/ })).toHaveAttribute('data-selected', 'false')
  })

  it('reports the clicked job id', async () => {
    const onSelect = vi.fn()
    const job = makeJob({ title: 'Clickable' })
    renderList({ jobs: [job], onSelect })

    await userEvent.setup().click(screen.getByRole('button', { name: /Clickable/ }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(job.id)
  })

  describe('new-since divider', () => {
    const newSince = '2026-07-19T00:00:00.000Z'
    const newJob = (): ReturnType<typeof makeJob> =>
      makeJob({ title: 'Fresh job', firstSeenAt: '2026-07-19T06:00:00.000Z' })
    const oldJob = (): ReturnType<typeof makeJob> =>
      makeJob({ title: 'Stale job', firstSeenAt: '2026-07-18T06:00:00.000Z' })

    it('renders between the new and older groups', () => {
      renderList({ jobs: [newJob(), oldJob()], newSince })
      const divider = screen.getByText('New since your last visit')
      expect(divider).toBeInTheDocument()

      // Document order: fresh row → divider → stale row.
      const fresh = screen.getByRole('button', { name: /Fresh job/ })
      const stale = screen.getByRole('button', { name: /Stale job/ })
      expect(fresh.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(divider.compareDocumentPosition(stale) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('is absent when every job is new', () => {
      renderList({ jobs: [newJob(), newJob()], newSince })
      expect(screen.queryByText('New since your last visit')).not.toBeInTheDocument()
    })

    it('is absent when nothing is new', () => {
      renderList({ jobs: [oldJob(), oldJob()], newSince })
      expect(screen.queryByText('New since your last visit')).not.toBeInTheDocument()
    })

    it('is absent when there is no recorded visit', () => {
      renderList({ jobs: [newJob(), oldJob()], newSince: null })
      expect(screen.queryByText('New since your last visit')).not.toBeInTheDocument()
    })
  })
})

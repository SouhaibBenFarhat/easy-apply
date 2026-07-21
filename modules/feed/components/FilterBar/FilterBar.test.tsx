import type { SourceInfo } from '@data'
import type { FeedFilters } from '@sources/shared'
import { act, fireEvent, render, screen, userEvent, waitFor } from '@test-utils'
import { FilterBar } from './FilterBar'

function makeSource(
  overrides: Partial<SourceInfo> & { sourceId: SourceInfo['sourceId'] },
): SourceInfo {
  return {
    displayName: overrides.sourceId,
    homepage: 'https://example.com',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: overrides.sourceId, required: false },
    ...overrides,
  }
}

const SOURCES: SourceInfo[] = [
  makeSource({ sourceId: 'ba', displayName: 'Arbeitsagentur' }),
  makeSource({ sourceId: 'arbeitnow', displayName: 'Arbeitnow' }),
  makeSource({ sourceId: 'remoteok', displayName: 'RemoteOK' }),
]

function renderBar(
  filters: FeedFilters = {},
  onChange: (filters: FeedFilters) => void = () => {},
): ReturnType<typeof render> {
  return render(<FilterBar filters={filters} sources={SOURCES} onChange={onChange} />)
}

describe('FilterBar', () => {
  it('maps the segmented control onto workModes', async () => {
    const onChange = vi.fn()
    renderBar({}, onChange)

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Remote' }))
    // Radix automatic activation fires on focus AND click while the spy keeps
    // the component's value pinned — assert the payload, not the call count.
    expect(onChange).toHaveBeenCalledWith({ workModes: ['remote'] })
  })

  it('marks the active work mode and maps All back to undefined', async () => {
    const onChange = vi.fn()
    renderBar({ workModes: ['hybrid'] }, onChange)

    expect(screen.getByRole('tab', { name: 'Hybrid' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.setup().click(screen.getByRole('tab', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith({ workModes: undefined })
  })

  // The two debounce tests drive the input with synchronous fireEvent.change:
  // user-event's delay loop deadlocks against vitest fake timers under
  // happy-dom, and the unit under test is our debounce, not typing mechanics.
  it('debounces search input by 250ms', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      renderBar({}, onChange)

      const input = screen.getByRole('searchbox', { name: 'Search jobs' })
      fireEvent.change(input, { target: { value: 'rea' } })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      // A keystroke inside the window restarts the timer.
      fireEvent.change(input, { target: { value: 'react' } })
      act(() => {
        vi.advanceTimersByTime(249)
      })
      expect(onChange).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ search: 'react' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits undefined when the search is cleared back to whitespace', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      renderBar({ search: 'react' }, onChange)

      const input = screen.getByRole('searchbox', { name: 'Search jobs' })
      expect(input).toHaveValue('react')
      fireEvent.change(input, { target: { value: '   ' } })
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ search: undefined })
    } finally {
      vi.useRealTimers()
    }
  })

  it('adopts an external reset without emitting it back', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FilterBar filters={{ search: 'react' }} sources={SOURCES} onChange={onChange} />,
    )
    rerender(<FilterBar filters={{}} sources={SOURCES} onChange={onChange} />)

    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('')
    await waitFor(() => expect(onChange).not.toHaveBeenCalled())
  })

  it('toggles the salary switch into hasSalary', async () => {
    const onChange = vi.fn()
    renderBar({}, onChange)

    await userEvent.setup().click(screen.getByRole('switch', { name: 'Salary' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ hasSalary: true })
  })

  it('clears hasSalary when switched back off', async () => {
    const onChange = vi.fn()
    renderBar({ hasSalary: true }, onChange)

    const toggle = screen.getByRole('switch', { name: 'Salary' })
    expect(toggle).toBeChecked()
    await userEvent.setup().click(toggle)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ hasSalary: undefined })
  })

  it('narrows sources from the popover', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({}, onChange)

    await user.click(screen.getByRole('button', { name: 'Sources' }))
    const remoteOk = await screen.findByRole('switch', { name: 'RemoteOK' })
    expect(remoteOk).toBeChecked()
    await user.click(remoteOk)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: ['ba', 'arbeitnow'] })
  })

  it('drops the sources filter once every source is re-enabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ sources: ['ba', 'arbeitnow'] }, onChange)

    // The trigger badge shows the active count while filtered.
    await user.click(screen.getByRole('button', { name: /Sources 2/ }))
    const remoteOk = await screen.findByRole('switch', { name: 'RemoteOK' })
    expect(remoteOk).not.toBeChecked()
    await user.click(remoteOk)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: undefined })
  })

  it('resets via the All sources item', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ sources: ['ba'] }, onChange)

    await user.click(screen.getByRole('button', { name: /Sources 1/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'All sources' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: undefined })
  })
})

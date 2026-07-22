import type { SourceInfo } from '@data'
import type { FeedFilters } from '@sources/shared'
import { render, screen, userEvent } from '@test-utils'
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

  it('has no search field', () => {
    renderBar()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('toggles the salary switch inside the filters popover', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({}, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('switch', { name: 'Has salary' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ hasSalary: true })
  })

  it('clears hasSalary when switched back off', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ hasSalary: true }, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const toggle = await screen.findByRole('switch', { name: 'Has salary' })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ hasSalary: undefined })
  })

  it('narrows sources from the filters popover', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({}, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const remoteOk = await screen.findByRole('switch', { name: 'RemoteOK' })
    expect(remoteOk).toBeChecked()
    await user.click(remoteOk)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: ['ba', 'arbeitnow'] })
  })

  it('drops the sources filter once every source is re-enabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ sources: ['ba', 'arbeitnow'] }, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const remoteOk = await screen.findByRole('switch', { name: 'RemoteOK' })
    expect(remoteOk).not.toBeChecked()
    await user.click(remoteOk)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: undefined })
  })

  it('filters to inbox-agent jobs from the origin control', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({}, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('button', { name: 'Inbox' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ origin: 'agent' })
  })

  it('clears the origin filter via All', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ origin: 'agent' }, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ origin: undefined })
  })

  it('resets via the All sources item', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ sources: ['ba'] }, onChange)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('menuitem', { name: 'All sources' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ sources: undefined })
  })
})

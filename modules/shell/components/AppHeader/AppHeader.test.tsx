import { render, screen, userEvent } from '@test-utils'
import { AppHeader } from './AppHeader'

const NOOP = (): void => {}

describe('AppHeader', () => {
  it('renders the page title as a heading on a glass draggable bar', () => {
    render(
      <AppHeader title="Feed" syncing={false} onSyncNow={NOOP} theme="dark" onCycleTheme={NOOP} />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('glass', 'app-drag')
  })

  it('spins the sync icon only while syncing', () => {
    const { rerender } = render(
      <AppHeader title="Feed" syncing={false} onSyncNow={NOOP} theme="dark" onCycleTheme={NOOP} />,
    )
    const icon = (): SVGElement | null =>
      screen.getByRole('button', { name: 'Sync now' }).querySelector('svg')
    expect(icon()).not.toHaveClass('animate-spin-slow')

    rerender(<AppHeader title="Feed" syncing onSyncNow={NOOP} theme="dark" onCycleTheme={NOOP} />)
    expect(icon()).toHaveClass('animate-spin-slow')
  })

  it('fires onSyncNow and onCycleTheme from the action buttons', async () => {
    const onSyncNow = vi.fn()
    const onCycleTheme = vi.fn()
    const user = userEvent.setup()
    render(
      <AppHeader
        title="Feed"
        syncing={false}
        onSyncNow={onSyncNow}
        theme="dark"
        onCycleTheme={onCycleTheme}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(onSyncNow).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(onCycleTheme).toHaveBeenCalledTimes(1)
  })

  it('shows the icon matching the active theme variant', () => {
    const { rerender } = render(
      <AppHeader title="Feed" syncing={false} onSyncNow={NOOP} theme="dark" onCycleTheme={NOOP} />,
    )
    const icon = (): SVGElement | null =>
      screen.getByRole('button', { name: 'Toggle theme' }).querySelector('svg')
    expect(icon()).toHaveClass('lucide-moon')

    rerender(
      <AppHeader title="Feed" syncing={false} onSyncNow={NOOP} theme="light" onCycleTheme={NOOP} />,
    )
    expect(icon()).toHaveClass('lucide-sun')

    rerender(
      <AppHeader
        title="Feed"
        syncing={false}
        onSyncNow={NOOP}
        theme="system"
        onCycleTheme={NOOP}
      />,
    )
    expect(icon()).toHaveClass('lucide-monitor')
  })

  it('renders extra actions in the no-drag cluster', () => {
    render(
      <AppHeader title="Feed" syncing={false} onSyncNow={NOOP} theme="dark" onCycleTheme={NOOP}>
        <button type="button">Filter</button>
      </AppHeader>,
    )
    const extra = screen.getByRole('button', { name: 'Filter' })
    expect(extra.closest('.app-no-drag')).not.toBeNull()
  })
})

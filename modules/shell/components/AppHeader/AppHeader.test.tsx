import type { ThemeVariant } from '@data'
import { render, screen, userEvent } from '@test-utils'
import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'

const NOOP = (): void => {}

function renderHeader(
  props: { theme?: ThemeVariant; onCycleTheme?: () => void; children?: ReactNode } = {},
): ReturnType<typeof render> {
  const { theme = 'dark', onCycleTheme = NOOP, children } = props
  return render(
    <AppHeader title="Feed" theme={theme} onCycleTheme={onCycleTheme}>
      {children}
    </AppHeader>,
  )
}

describe('AppHeader', () => {
  it('renders the page title as a heading on a glass draggable bar', () => {
    renderHeader()
    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('glass', 'app-drag')
  })

  it('cycles the theme from the toggle', async () => {
    const onCycleTheme = vi.fn()
    renderHeader({ onCycleTheme })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(onCycleTheme).toHaveBeenCalledTimes(1)
  })

  it('shows the icon matching the active theme variant', () => {
    const icon = (): SVGElement | null =>
      screen.getByRole('button', { name: 'Toggle theme' }).querySelector('svg')

    const dark = renderHeader({ theme: 'dark' })
    expect(icon()).toHaveClass('lucide-moon')
    dark.unmount()

    const light = renderHeader({ theme: 'light' })
    expect(icon()).toHaveClass('lucide-sun')
    light.unmount()

    renderHeader({ theme: 'system' })
    expect(icon()).toHaveClass('lucide-monitor')
  })

  // The agent transport arrives as a child from @app, which decides whether the
  // header or the pipeline panel shows it — never both.
  it('renders extra actions in the no-drag cluster', () => {
    renderHeader({ children: <button type="button">Filter</button> })
    const extra = screen.getByRole('button', { name: 'Filter' })
    expect(extra.closest('.app-no-drag')).not.toBeNull()
  })
})

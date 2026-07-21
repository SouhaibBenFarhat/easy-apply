import { render, screen, userEvent } from '@test-utils'
import { ClipboardList, Rss } from 'lucide-react'
import type { SidebarNavItem } from './Sidebar'
import { Sidebar } from './Sidebar'

const ITEMS: SidebarNavItem[] = [
  { to: '/feed', label: 'Feed', icon: <Rss /> },
  { to: '/tracker', label: 'Tracker', icon: <ClipboardList /> },
]

describe('Sidebar', () => {
  it('renders every nav item plus the app name and version', () => {
    render(<Sidebar items={ITEMS} currentPath="/feed" onNavigate={() => {}} />)
    expect(screen.getByRole('menuitem', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Tracker' })).toBeInTheDocument()
    expect(screen.getByText('EasyApply')).toHaveClass('label-caps')
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
  })

  it('fires onNavigate with the item path on click', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar items={ITEMS} currentPath="/feed" onNavigate={onNavigate} />)
    await user.click(screen.getByRole('menuitem', { name: 'Tracker' }))
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/tracker')
  })

  it('marks the item matching the current path as selected', () => {
    render(<Sidebar items={ITEMS} currentPath="/tracker" onNavigate={() => {}} />)
    expect(screen.getByRole('menuitem', { name: 'Tracker' })).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(screen.getByRole('menuitem', { name: 'Feed' })).toHaveAttribute('data-selected', 'false')
  })

  it('treats sub-paths of an item as selected', () => {
    render(<Sidebar items={ITEMS} currentPath="/feed/123" onNavigate={() => {}} />)
    expect(screen.getByRole('menuitem', { name: 'Feed' })).toHaveAttribute('data-selected', 'true')
  })

  it('renders a custom version when provided', () => {
    render(<Sidebar items={ITEMS} currentPath="/feed" onNavigate={() => {}} version="1.2.3" />)
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
  })
})

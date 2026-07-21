import { ListMenu, ListMenuItem } from '@ui-kit'
import type { ReactElement, ReactNode } from 'react'

export interface SidebarNavItem {
  to: string
  label: string
  icon: ReactNode
}

export interface SidebarProps {
  items: SidebarNavItem[]
  currentPath: string
  onNavigate: (to: string) => void
  version?: string
}

export function Sidebar({
  items,
  currentPath,
  onNavigate,
  version = '0.1.0',
}: SidebarProps): ReactElement {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border-subtle bg-surface">
      {/* Traffic-light zone: draggable spacer under the hiddenInset controls. */}
      <div className="app-drag h-12 shrink-0" />
      <nav className="min-h-0 flex-1 overflow-y-auto px-2">
        <ListMenu className="gap-0.5">
          {items.map((item) => (
            <ListMenuItem
              key={item.to}
              selected={currentPath.startsWith(item.to)}
              className="data-[selected=true]:text-primary"
              onClick={() => onNavigate(item.to)}
            >
              <span className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:shrink-0">
                {item.icon}
                {item.label}
              </span>
            </ListMenuItem>
          ))}
        </ListMenu>
      </nav>
      <footer className="flex items-baseline justify-between border-t border-border-subtle px-4 py-3">
        <span className="label-caps">EasyApply</span>
        <span className="text-xs text-foreground-ghost">v{version}</span>
      </footer>
    </aside>
  )
}

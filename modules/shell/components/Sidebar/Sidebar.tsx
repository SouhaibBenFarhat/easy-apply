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
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
      {/* Traffic-light zone = the LEFT half of the window's glass header bar:
          the SAME `.glass` material as the app header (§sidebars), so the top
          chrome row is one unified band — neither half outranks the other. */}
      <div className="glass app-drag h-12 shrink-0" />
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pt-1">
        <ListMenu className="gap-1">
          {items.map((item) => (
            <ListMenuItem
              key={item.to}
              selected={currentPath.startsWith(item.to)}
              // Equal 6px inset inside the highlight (over the base px-3/py-2):
              // compact and balanced, not squished vertically.
              className="px-1.5 py-1.5 data-[selected=true]:text-primary"
              onClick={() => onNavigate(item.to)}
            >
              <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
                {item.icon}
                {item.label}
              </span>
            </ListMenuItem>
          ))}
        </ListMenu>
      </nav>
      {/* Solid tone that matches the glass header strip's RENDERED elevation
          (~0.21), so header and footer read at the same level — not solid
          `header` (0.25), which reads higher than the glass above (§sidebars). */}
      <footer className="flex items-baseline justify-between border-t border-border bg-surface-hover px-4 py-2.5">
        <span className="label-caps">EasyApply</span>
        <span className="text-xs text-foreground-ghost">v{version}</span>
      </footer>
    </aside>
  )
}

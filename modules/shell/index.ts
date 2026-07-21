// L3 — presentational app chrome. Router-free by design: @app supplies the
// current path and navigation handlers as props, which keeps this module
// L3-pure (no @app import) and trivially testable.
export type { AppHeaderProps } from './components/AppHeader'
export { AppHeader } from './components/AppHeader'
export type { SidebarNavItem, SidebarProps } from './components/Sidebar'
export { Sidebar } from './components/Sidebar'

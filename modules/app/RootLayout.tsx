import type { ThemeVariant } from '@data'
import { useSetTheme, useTheme } from '@data'
import type { SidebarNavItem } from '@shell'
import { AppHeader, Sidebar } from '@shell'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { Toaster, TooltipProvider } from '@ui-kit'
import { ClipboardList, Plug, Rss, Settings } from 'lucide-react'
import type { ReactElement } from 'react'
import { useSyncControls } from './hooks/use-sync-controls'
import { useAppKeyboard } from './keyboard'

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/feed', label: 'Feed', icon: <Rss /> },
  { to: '/tracker', label: 'Tracker', icon: <ClipboardList /> },
  { to: '/sources', label: 'Sources', icon: <Plug /> },
  { to: '/settings', label: 'Settings', icon: <Settings /> },
]

const NEXT_THEME: Record<ThemeVariant, ThemeVariant> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

export function RootLayout(): ReactElement {
  const router = useRouter()
  const currentPath = useRouterState({ select: (state) => state.location.pathname })
  const title = useRouterState({
    select: (state) => state.matches.at(-1)?.staticData.title ?? 'EasyApply',
  })
  const theme = useTheme().data ?? 'dark'
  const setTheme = useSetTheme()
  const { syncing, onSyncNow } = useSyncControls()
  useAppKeyboard(router)

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar
          items={NAV_ITEMS}
          currentPath={currentPath}
          onNavigate={(to) => {
            void router.navigate({ to })
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            title={title}
            syncing={syncing}
            onSyncNow={onSyncNow}
            theme={theme}
            onCycleTheme={() => setTheme.mutate(NEXT_THEME[theme])}
          />
          <div className="min-h-0 flex-1">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

import type { ThemeVariant } from '@data'
import { useAgentTraceCollector, useResizablePanel, useSetTheme, useTheme } from '@data'
import type { SidebarNavItem } from '@shell'
import { AppHeader, Sidebar } from '@shell'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { ResizeHandle, Toaster, TooltipProvider, TransportControl } from '@ui-kit'
import { ClipboardList, Plug, Rss, Settings } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { AgentMonitorButton } from './AgentMonitorButton'
import { AgentTimeline } from './AgentTimeline'
import { AiToggle } from './AiToggle'
import { useSyncControls } from './hooks/use-sync-controls'
import { useAppKeyboard } from './keyboard'
import { ModelBanner } from './ModelBanner'

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
  const transport = useSyncControls()
  const [monitorOpen, setMonitorOpen] = useState(false)
  const activityPanel = useResizablePanel('activity', { min: 260, max: 520, grows: 'left' })
  useAgentTraceCollector() // stream agent:trace events into the cache
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
            theme={theme}
            onCycleTheme={() => setTheme.mutate(NEXT_THEME[theme])}
          >
            {/* Exactly one transport on screen: the pipeline panel owns it
                whenever it's open (it sits with the progress and counts it
                controls), and the header carries it only while that panel is
                closed. Two identical clusters is not a mirror, it's a
                duplicate. */}
            {monitorOpen ? null : (
              <TransportControl
                compact
                state={transport.state}
                onPause={transport.onPause}
                onResume={transport.onResume}
                onStop={transport.onStop}
              />
            )}
            <AiToggle />
            <AgentMonitorButton
              open={monitorOpen}
              onToggle={() => setMonitorOpen((open) => !open)}
            />
          </AppHeader>
          <ModelBanner onOpen={() => void router.navigate({ to: '/settings' })} />
          {/* The activity panel pushes the content (not an overlay) and is
              resizable via the handle on its left edge. */}
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
            {monitorOpen ? (
              <>
                <ResizeHandle
                  aria-label="Resize activity panel"
                  value={activityPanel.width}
                  min={activityPanel.min}
                  max={activityPanel.max}
                  onResizeStart={activityPanel.onResizeStart}
                  onResize={activityPanel.onResize}
                  onResizeEnd={activityPanel.onResizeEnd}
                />
                <AgentTimeline
                  width={activityPanel.width}
                  onStart={transport.onSyncNow}
                  onClose={() => setMonitorOpen(false)}
                />
              </>
            ) : null}
          </div>
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

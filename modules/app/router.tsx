import { FeedPage } from '@feed'
import { SettingsPage } from '@settings'
import type { AnyRouter } from '@tanstack/react-router'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TrackerPage } from '@tracker'
import { EmptyState } from '@ui-kit'
import { Plug } from 'lucide-react'
import type { ReactElement } from 'react'
import { RootLayout } from './RootLayout'

// Every route carries its header title.
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    title: string
  }
}

const rootRoute = createRootRoute({
  component: RootLayout,
  staticData: { title: 'EasyApply' },
})

// Placeholder page — replaced by the real feature in PR 14.
function SourcesPage(): ReactElement {
  return (
    <EmptyState
      className="h-full"
      icon={<Plug className="size-5" />}
      title="Coming soon"
      description="Sources lands in PR 14."
    />
  )
}

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  component: FeedPage,
  staticData: { title: 'Feed' },
})

const trackerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tracker',
  component: TrackerPage,
  staticData: { title: 'Tracker' },
})

const sourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sources',
  component: SourcesPage,
  staticData: { title: 'Sources' },
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
  staticData: { title: 'Settings' },
})

const routeTree = rootRoute.addChildren([feedRoute, trackerRoute, sourcesRoute, settingsRoute])

// A fresh router per call: memory history is stateful, and tests need
// isolated instances. Typed as AnyRouter (no Register augmentation): nav is
// deliberately string-based so @shell stays router-free — typed route
// registration can come with the real pages.
export function createAppRouter(): AnyRouter {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/feed'] }),
  })
}

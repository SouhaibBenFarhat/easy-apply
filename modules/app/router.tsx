import { SettingsPage } from '@settings'
import type { AnyRouter } from '@tanstack/react-router'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { EmptyState } from '@ui-kit'
import { ClipboardList, Plug, Rss } from 'lucide-react'
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

// Placeholder pages — replaced by the real features in PRs 12–14.
function FeedPage(): ReactElement {
  return (
    <EmptyState
      className="h-full"
      icon={<Rss className="size-5" />}
      title="Coming soon"
      description="Feed lands in PR 12."
    />
  )
}

function TrackerPage(): ReactElement {
  return (
    <EmptyState
      className="h-full"
      icon={<ClipboardList className="size-5" />}
      title="Coming soon"
      description="Tracker lands in PR 13."
    />
  )
}

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

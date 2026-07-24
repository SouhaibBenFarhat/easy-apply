import { FeedPage } from '@feed'
import { SettingsPage } from '@settings'
import { SourcesPage } from '@sources-page'
import type { AnyRouter } from '@tanstack/react-router'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TrackerPage } from '@tracker'
import { RootLayout } from './RootLayout'
import { RunsPage } from './RunsPage'

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

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
  staticData: { title: 'Runs' },
})

const routeTree = rootRoute.addChildren([
  feedRoute,
  trackerRoute,
  sourcesRoute,
  runsRoute,
  settingsRoute,
])

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

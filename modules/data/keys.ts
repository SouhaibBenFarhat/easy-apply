import type { FeedFilters } from '@sources/shared'

// Single hierarchical key object (PLAN.md §4.7). Invalidation relies on
// prefix matching: invalidating keys.jobs.all hits every feed and detail
// query; the first segment is the namespace the persister filters on
// (client.ts persists only 'settings' and 'local').
export interface QueryKeys {
  readonly jobs: {
    readonly all: readonly ['jobs']
    readonly feed: (filters: FeedFilters) => readonly ['jobs', 'feed', FeedFilters]
    readonly detail: (id: string) => readonly ['jobs', 'detail', string]
  }
  readonly sources: {
    readonly list: readonly ['sources', 'list']
  }
  readonly sync: {
    readonly status: readonly ['sync', 'status']
  }
  readonly settings: {
    readonly app: readonly ['settings', 'app']
    readonly theme: readonly ['settings', 'theme']
  }
  readonly local: {
    readonly feedFilters: readonly ['local', 'feedFilters']
    readonly lastFeedVisit: readonly ['local', 'lastFeedVisit']
  }
}

export const keys: QueryKeys = {
  jobs: {
    all: ['jobs'],
    feed: (filters) => ['jobs', 'feed', filters],
    detail: (id) => ['jobs', 'detail', id],
  },
  sources: {
    list: ['sources', 'list'],
  },
  sync: {
    status: ['sync', 'status'],
  },
  settings: {
    app: ['settings', 'app'],
    theme: ['settings', 'theme'],
  },
  local: {
    feedFilters: ['local', 'feedFilters'],
    lastFeedVisit: ['local', 'lastFeedVisit'],
  },
}

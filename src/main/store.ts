import type { SearchProfile } from '@sources/shared'
import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import Store from 'electron-store'

interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

interface StoreSchema {
  windowBounds: WindowBounds
  searchProfile: SearchProfile
  syncIntervalHours: number
}

export const store: Store<StoreSchema> = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    searchProfile: DEFAULT_SEARCH_PROFILE,
    syncIntervalHours: 3,
  },
})

export type { StoreSchema, WindowBounds }

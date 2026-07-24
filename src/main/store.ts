import type { MailScanConfig, SearchProfile } from '@sources/shared'
import { DEFAULT_MAIL_SCAN_CONFIG, DEFAULT_SEARCH_PROFILE } from '@sources/shared'
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
  aiEnabled: boolean
  modelId: string
  // Message-ids the mailbox agent has already scanned — so a sync only runs the
  // LLM on NEW mail. Capped (most-recent-wins) to bound growth.
  processedMailIds: string[]
  // First-sweep filters for the inbox agent (editable on the Sources page):
  // which sender domains and subject keywords mark job mail, and which domains
  // are turned off (hard-excluded).
  mailScan: MailScanConfig
}

export const store: Store<StoreSchema> = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    searchProfile: DEFAULT_SEARCH_PROFILE,
    syncIntervalHours: 3,
    aiEnabled: true,
    // The selected local model — the fast instruct model by default.
    modelId: 'llama-3.1-8b-instruct-q4',
    processedMailIds: [],
    mailScan: DEFAULT_MAIL_SCAN_CONFIG,
  },
})

export type { StoreSchema, WindowBounds }

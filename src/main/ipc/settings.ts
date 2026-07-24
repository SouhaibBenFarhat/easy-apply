import type { IpcResult, MailScanConfig, SearchProfile } from '@sources/shared'
import {
  fail,
  ok,
  resolveMailScanConfig,
  resolveSearchProfile,
  validateMailScanConfig,
  validateSearchProfile,
} from '@sources/shared'
import { ipcMain } from 'electron'
import { store } from '../store'

export interface AppSettings {
  searchProfile: SearchProfile
  syncIntervalHours: number
  mailScan: MailScanConfig
}

function currentSettings(): AppSettings {
  return {
    searchProfile: resolveSearchProfile(store.get('searchProfile')),
    syncIntervalHours: store.get('syncIntervalHours'),
    mailScan: resolveMailScanConfig(store.get('mailScan')),
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): IpcResult<AppSettings> => {
    try {
      return ok(currentSettings())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('settings:set', (_event, update: unknown): IpcResult<AppSettings> => {
    try {
      const record = update as Partial<AppSettings>
      if (record.searchProfile !== undefined) {
        const parsed = validateSearchProfile(record.searchProfile)
        if ('error' in parsed) return fail(`invalid searchProfile — ${parsed.error}`)
        store.set('searchProfile', parsed.data)
      }
      if (record.syncIntervalHours !== undefined) {
        const hours = Number(record.syncIntervalHours)
        if (!Number.isInteger(hours) || hours < 1 || hours > 24)
          return fail('syncIntervalHours must be an integer between 1 and 24')
        store.set('syncIntervalHours', hours)
      }
      if (record.mailScan !== undefined) {
        const parsed = validateMailScanConfig(record.mailScan)
        if ('error' in parsed) return fail(`invalid mailScan — ${parsed.error}`)
        store.set('mailScan', parsed.data)
      }
      return ok(currentSettings())
    } catch (error) {
      return fail(error)
    }
  })
}

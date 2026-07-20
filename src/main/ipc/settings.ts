import type { IpcResult, SearchProfile } from '@sources/shared'
import { fail, ok, resolveSearchProfile, validateSearchProfile } from '@sources/shared'
import { ipcMain } from 'electron'
import { store } from '../store'

export interface AppSettings {
  searchProfile: SearchProfile
  syncIntervalHours: number
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): IpcResult<AppSettings> => {
    try {
      return ok({
        searchProfile: resolveSearchProfile(store.get('searchProfile')),
        syncIntervalHours: store.get('syncIntervalHours'),
      })
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
      return ok({
        searchProfile: resolveSearchProfile(store.get('searchProfile')),
        syncIntervalHours: store.get('syncIntervalHours'),
      })
    } catch (error) {
      return fail(error)
    }
  })
}

import type { AppDatabase } from '@persistence/main'
import { getProviderStates, setProviderEnabled, upsertProviderState } from '@persistence/main'
import { getProvider, listProviderMeta } from '@sources/main'
import type { IpcResult, SourceId } from '@sources/shared'
import { fail, ok, SOURCE_IDS } from '@sources/shared'
import { ipcMain } from 'electron'
import { saveProviderConfig } from '../provider-config'

// sources:* channels — the per-provider management surface the Sources page
// (PR 14) consumes: registry meta joined with provider_state, plus the
// safeStorage key flow (PLAN.md §4.9). Same conventions as db.ts/settings.ts:
// every handler resolves to an IpcResult; errors are values, never thrown
// across the bridge. hasKey is a boolean on purpose — decrypted key material
// never crosses the bridge in either direction except on save.

// Mirrored in src/preload/electron-api.d.ts — duplicated there because
// renderer-side compilation units never include main-process code.
export interface SourceInfo {
  sourceId: SourceId
  displayName: string
  homepage: string
  enabledByDefault: boolean
  enabled: boolean
  lastSyncAt: string | null
  hasKey: boolean
  requiresKey?: { fields: ReadonlyArray<{ id: string; label: string; hint: string }> }
  attribution: { label: string; required: boolean }
}

function isSourceId(value: unknown): value is SourceId {
  return typeof value === 'string' && (SOURCE_IDS as readonly string[]).includes(value)
}

async function listSourceInfos(db: AppDatabase): Promise<SourceInfo[]> {
  const states = await getProviderStates(db)
  const byId = new Map(states.map((state) => [state.sourceId, state]))
  return listProviderMeta().map((meta) => {
    // No provider_state row yet (first run) → the meta default decides.
    const state = byId.get(meta.id)
    const info: SourceInfo = {
      sourceId: meta.id,
      displayName: meta.displayName,
      homepage: meta.homepage,
      enabledByDefault: meta.enabledByDefault,
      enabled: state?.enabled ?? meta.enabledByDefault,
      lastSyncAt: state?.lastSyncAt ?? null,
      hasKey: (state?.configJson ?? null) !== null,
      attribution: meta.attribution,
    }
    if (meta.requiresKey !== undefined) info.requiresKey = meta.requiresKey
    return info
  })
}

async function getSourceInfo(db: AppDatabase, sourceId: SourceId): Promise<SourceInfo> {
  const info = (await listSourceInfos(db)).find((entry) => entry.sourceId === sourceId)
  if (info === undefined) throw new Error(`no provider registered for ${sourceId}`)
  return info
}

export function registerSourcesIpc(db: AppDatabase): void {
  ipcMain.handle('sources:list', async (): Promise<IpcResult<SourceInfo[]>> => {
    try {
      return ok(await listSourceInfos(db))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'sources:set-enabled',
    async (_event, payload: unknown): Promise<IpcResult<SourceInfo>> => {
      try {
        const { sourceId, enabled } = (payload ?? {}) as Record<string, unknown>
        if (!isSourceId(sourceId) || getProvider(sourceId) === undefined)
          return fail('sourceId must name a registered provider')
        if (typeof enabled !== 'boolean') return fail('enabled must be a boolean')
        await setProviderEnabled(db, sourceId, enabled)
        return ok(await getSourceInfo(db, sourceId))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'sources:set-key',
    async (_event, payload: unknown): Promise<IpcResult<SourceInfo>> => {
      try {
        const { sourceId, values } = (payload ?? {}) as Record<string, unknown>
        if (!isSourceId(sourceId)) return fail('sourceId must name a registered provider')
        const provider = getProvider(sourceId)
        if (provider === undefined) return fail('sourceId must name a registered provider')
        const requiresKey = provider.meta.requiresKey
        if (requiresKey === undefined) return fail(`${sourceId} does not take an API key`)
        if (typeof values !== 'object' || values === null || Array.isArray(values))
          return fail('values must be an object of key fields')
        const record = values as Record<string, unknown>
        // Only the declared fields are stored — extras are dropped, and every
        // declared field must be a non-empty string.
        const config: Record<string, string> = {}
        for (const field of requiresKey.fields) {
          const value = record[field.id]
          if (typeof value !== 'string' || value.trim() === '')
            return fail(`${field.label} is required`)
          config[field.id] = value.trim()
        }
        await saveProviderConfig(db, sourceId, config)
        // Pasting a key is intent to use the source — enable it in one step.
        await setProviderEnabled(db, sourceId, true)
        return ok(await getSourceInfo(db, sourceId))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'sources:clear-key',
    async (_event, payload: unknown): Promise<IpcResult<SourceInfo>> => {
      try {
        const { sourceId } = (payload ?? {}) as Record<string, unknown>
        if (!isSourceId(sourceId) || getProvider(sourceId) === undefined)
          return fail('sourceId must name a registered provider')
        await upsertProviderState(db, sourceId, { configJson: null })
        return ok(await getSourceInfo(db, sourceId))
      } catch (error) {
        return fail(error)
      }
    },
  )
}

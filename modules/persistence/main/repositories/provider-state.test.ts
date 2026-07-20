// @vitest-environment node
import { fileURLToPath } from 'node:url'
import type { AppDatabase } from '@persistence/main'
import {
  createDatabase,
  getProviderStates,
  providerState,
  setProviderEnabled,
  upsertProviderState,
} from '@persistence/main'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('../../../../drizzle', import.meta.url))

let db: AppDatabase

beforeAll(async () => {
  db = await createDatabase({ migrationsFolder })
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.drizzle.delete(providerState)
})

describe('provider state', () => {
  it('starts empty', async () => {
    expect(await getProviderStates(db)).toEqual([])
  })

  it('setProviderEnabled inserts on first call and toggles afterwards', async () => {
    const created = await setProviderEnabled(db, 'adzuna', false)
    expect(created).toEqual({
      sourceId: 'adzuna',
      enabled: false,
      lastSyncAt: null,
      configJson: null,
    })

    const toggled = await setProviderEnabled(db, 'adzuna', true)
    expect(toggled.enabled).toBe(true)
    expect(await getProviderStates(db)).toHaveLength(1)
  })

  it('upsertProviderState creates an enabled-by-default row with the patch applied', async () => {
    const state = await upsertProviderState(db, 'ba', {
      lastSyncAt: '2026-07-20T12:00:00.000Z',
      configJson: '{"encrypted":"abc"}',
    })
    expect(state).toEqual({
      sourceId: 'ba',
      enabled: true,
      lastSyncAt: '2026-07-20T12:00:00.000Z',
      configJson: '{"encrypted":"abc"}',
    })
  })

  it('upsertProviderState patches only the provided fields and preserves enabled', async () => {
    await setProviderEnabled(db, 'ba', false)
    await upsertProviderState(db, 'ba', { configJson: '{"encrypted":"abc"}' })
    const patched = await upsertProviderState(db, 'ba', { lastSyncAt: '2026-07-21T09:00:00.000Z' })
    expect(patched).toEqual({
      sourceId: 'ba',
      enabled: false, // preserved — patch never flips the toggle
      lastSyncAt: '2026-07-21T09:00:00.000Z',
      configJson: '{"encrypted":"abc"}', // preserved from the earlier patch
    })
  })

  it('upsertProviderState can clear configJson with an explicit null', async () => {
    await upsertProviderState(db, 'ba', { configJson: '{"encrypted":"abc"}' })
    const cleared = await upsertProviderState(db, 'ba', { configJson: null })
    expect(cleared.configJson).toBeNull()
  })

  it('upsertProviderState with an empty patch returns the row untouched', async () => {
    await setProviderEnabled(db, 'ba', false)
    const untouched = await upsertProviderState(db, 'ba', {})
    expect(untouched).toEqual({
      sourceId: 'ba',
      enabled: false,
      lastSyncAt: null,
      configJson: null,
    })
  })

  it('lists states ordered by sourceId', async () => {
    await setProviderEnabled(db, 'wwr', true)
    await setProviderEnabled(db, 'adzuna', false)
    await setProviderEnabled(db, 'ba', true)
    expect((await getProviderStates(db)).map((state) => state.sourceId)).toEqual([
      'adzuna',
      'ba',
      'wwr',
    ])
  })
})

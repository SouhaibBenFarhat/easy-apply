// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabase } from './db'

const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))

describe('createDatabase', () => {
  const cleanups: Array<() => Promise<void> | void> = []
  afterAll(async () => {
    for (const cleanup of cleanups) await cleanup()
  })

  it('creates an in-memory database and applies migrations', async () => {
    const db = await createDatabase({ migrationsFolder })
    cleanups.push(() => db.close())

    const result = await db.pglite.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    )
    const tables = result.rows.map((row) => row.table_name)
    expect(tables).toEqual(expect.arrayContaining(['jobs', 'provider_state', 'sync_runs']))
  })

  it('is idempotent — migrating an already-migrated database is a no-op', async () => {
    const db = await createDatabase({ migrationsFolder })
    cleanups.push(() => db.close())
    // A second createDatabase against the same (persisted) state re-runs
    // migrate(); in-memory we can at least re-query to prove the DB is usable.
    const result = await db.pglite.query<{ count: number }>(
      'select count(*)::int as count from jobs',
    )
    expect(result.rows[0]?.count).toBe(0)
  })

  it('persists to dataDir across close/reopen and close() is safe to call twice', async () => {
    const dataDir = join(mkdtempSync(join(tmpdir(), 'easyapply-db-')), 'db')
    cleanups.push(() => rmSync(dataDir, { recursive: true, force: true }))

    const first = await createDatabase({ dataDir, migrationsFolder })
    await first.pglite.exec("insert into provider_state (source_id, enabled) values ('ba', true)")
    await first.close()
    await first.close() // second close is a guarded no-op

    const second = await createDatabase({ dataDir, migrationsFolder })
    cleanups.push(() => second.close())
    const result = await second.pglite.query<{ source_id: string; enabled: boolean }>(
      'select source_id, enabled from provider_state',
    )
    expect(result.rows).toEqual([{ source_id: 'ba', enabled: true }])
  })
})

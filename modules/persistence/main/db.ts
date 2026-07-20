import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

// PGlite (WASM Postgres) deliberately replaces better-sqlite3: no native ABI
// to rebuild per Electron version, and vitest runs the very same engine
// in-memory — main-process code and tests share one implementation.

export type DrizzleDb = PgliteDatabase<typeof schema>

export interface AppDatabase {
  drizzle: DrizzleDb
  pglite: PGlite
  close: () => Promise<void>
}

export interface CreateDatabaseOptions {
  // Filesystem directory for the PGlite data files; omit for in-memory (tests).
  dataDir?: string
  // Folder holding drizzle-kit SQL migrations. Callers resolve it per
  // environment (packaged: process.resourcesPath/drizzle, dev: <repo>/drizzle,
  // tests: <repo>/drizzle) — PLAN.md §4.5.
  migrationsFolder: string
}

export async function createDatabase(options: CreateDatabaseOptions): Promise<AppDatabase> {
  const pglite = options.dataDir === undefined ? new PGlite() : new PGlite(options.dataDir)
  const db = drizzle(pglite, { schema })
  await migrate(db, { migrationsFolder: options.migrationsFolder })
  return {
    drizzle: db,
    pglite,
    close: async (): Promise<void> => {
      if (!pglite.closed) await pglite.close()
    },
  }
}

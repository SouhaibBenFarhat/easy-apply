import { defineConfig } from 'drizzle-kit'

// drizzle-kit is only used at dev time to generate SQL migrations under
// ./drizzle — they ship with the app (electron-builder extraResources) and are
// applied at runtime by modules/persistence/main/db.ts.
export default defineConfig({
  dialect: 'postgresql',
  driver: 'pglite',
  schema: './modules/persistence/main/schema.ts',
  out: './drizzle',
})

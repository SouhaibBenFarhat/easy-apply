import type { AppDatabase } from '@persistence/main'
import { getProviderStates, upsertProviderState } from '@persistence/main'
import { decodeProviderConfig, encodeProviderConfig } from '@sources/main'
import type { SourceId } from '@sources/shared'
import { safeStorage } from 'electron'

// safeStorage-encrypted provider API keys (PLAN.md §4.9). Keys are encrypted
// with the OS-keychain-backed safeStorage and stored base64 in
// provider_state.configJson — never plaintext on disk, never logged. All
// callers run after app `ready` (handlers register inside whenReady), which is
// the safeStorage gate. Electron glue: excluded from vitest coverage; the pure
// codec half lives in @sources/main (provider-config-codec) where it IS
// covered.

export async function saveProviderConfig(
  db: AppDatabase,
  sourceId: SourceId,
  values: Record<string, string>,
): Promise<void> {
  // Refuse to persist anything when the OS cannot encrypt (§4.9) — a
  // plaintext fallback would silently write API keys to disk. The Sources
  // card surfaces this error to the user.
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('Encryption is not available on this system')
  const encrypted = safeStorage.encryptString(encodeProviderConfig(values)).toString('base64')
  await upsertProviderState(db, sourceId, { configJson: encrypted })
}

export async function readProviderConfig(
  db: AppDatabase,
  sourceId: SourceId,
): Promise<Record<string, string>> {
  // Any failure — no row, a foreign keychain, corrupted base64 — reads as "no
  // config" ({}): the provider then behaves as unkeyed, and nothing throws.
  try {
    const states = await getProviderStates(db)
    const configJson = states.find((state) => state.sourceId === sourceId)?.configJson ?? null
    if (configJson === null) return {}
    const decrypted = safeStorage.decryptString(Buffer.from(configJson, 'base64'))
    return decodeProviderConfig(decrypted)
  } catch {
    return {}
  }
}

export async function hasProviderConfig(db: AppDatabase, sourceId: SourceId): Promise<boolean> {
  const states = await getProviderStates(db)
  return states.some((state) => state.sourceId === sourceId && state.configJson !== null)
}

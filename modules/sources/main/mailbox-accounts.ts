// Pure helpers for the mailbox source's multi-account list. Accounts are stored
// inside the mailbox provider_state config (safeStorage-encrypted) as a JSON
// array under the `accounts` key, reusing the flat-string provider-config codec.
// Everything here is pure and unit-tested; the encrypted read/write glue lives
// in src/main/ipc/mailbox.ts.

const ACCOUNTS_KEY = 'accounts'

export interface MailboxAccount {
  email: string
  appPassword: string
}

function isAccount(value: unknown): value is MailboxAccount {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { email?: unknown }).email === 'string' &&
    typeof (value as { appPassword?: unknown }).appPassword === 'string'
  )
}

// Read the account list out of a decrypted config map. Anything that is not a
// well-formed array of {email, appPassword} degrades to [] — the config may be
// stale, corrupted, or from another machine's keychain, and must never throw.
// Duplicates (same address, case-insensitive) collapse to the first seen.
export function parseAccounts(config: Record<string, string>): MailboxAccount[] {
  const raw = config[ACCOUNTS_KEY]
  if (raw === undefined) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const accounts: MailboxAccount[] = []
  const seen = new Set<string>()
  for (const entry of parsed) {
    if (!isAccount(entry)) continue
    const email = entry.email.trim()
    const key = email.toLowerCase()
    if (email === '' || entry.appPassword === '' || seen.has(key)) continue
    seen.add(key)
    accounts.push({ email, appPassword: entry.appPassword })
  }
  return accounts
}

export function serializeAccounts(accounts: MailboxAccount[]): Record<string, string> {
  return { [ACCOUNTS_KEY]: JSON.stringify(accounts) }
}

// Add or replace an account (match by email, case-insensitive) — re-adding an
// address updates its app password rather than duplicating the row.
export function addAccount(accounts: MailboxAccount[], account: MailboxAccount): MailboxAccount[] {
  const email = account.email.trim()
  const key = email.toLowerCase()
  const rest = accounts.filter((entry) => entry.email.toLowerCase() !== key)
  return [...rest, { email, appPassword: account.appPassword }]
}

export function removeAccount(accounts: MailboxAccount[], email: string): MailboxAccount[] {
  const key = email.trim().toLowerCase()
  return accounts.filter((entry) => entry.email.toLowerCase() !== key)
}

export function listAccountEmails(accounts: MailboxAccount[]): string[] {
  return accounts.map((account) => account.email)
}

// IMAP transport for the email-ingestion source — reads recent messages from
// the user's own inbox and hands them to the LLM extractor. Built
// driver-injected and fake-tested, the same transport-first approach as
// PoliteHttpClient (§4.3). The real driver (an imapflow adapter) is a thin
// layer added when going live; the engine and tests drive everything through
// the MailDriver interface, so no network or real mailbox is needed to
// exercise the read/close logic.

// One decoded message pulled from the inbox. `html`/`text` are the decoded
// body parts; parsers prefer `html` and fall back to `text`.
export interface MailMessage {
  uid: number
  from: string // sender address (as received; matching is case-insensitive)
  subject: string
  date: string // ISO; the fetchedAt fallback when a posting has no date
  html: string | null
  text: string | null
  messageId: string | null // RFC822 Message-ID header — used to deep-link Gmail
}

// The mailbox search window — constrained by mailbox + date only. We no longer
// filter by sender: every recent email is handed to the LLM, which decides
// whether it holds job postings (the "read everything" mode).
export interface MailSearchQuery {
  mailbox: string // e.g. the 'Jobs' label the user filters alerts into
  since: Date
}

// The seam between this module and the outside world: the real implementation
// wraps imapflow, tests pass a fake. Lifecycle is connect → search → close,
// and readRecentMessages guarantees close() runs even when search() throws.
export interface MailDriver {
  connect(): Promise<void>
  search(query: MailSearchQuery): Promise<MailMessage[]>
  close(): Promise<void>
}

// The encrypted mail-connection config (stored via safeStorage, never
// plaintext — the same at-rest treatment as Adzuna's key). Gmail:
// host 'imap.gmail.com', port 993, secure true, user the address, password the
// 16-char App Password.
export interface MailAccount {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

export interface ReadRecentOptions {
  mailbox: string
  since: Date
}

// Connect, search the window, return every message, and always close the
// connection. Pure orchestration over the injected driver — no imapflow import
// here, so it unit-tests against a fake with zero I/O. No sender filtering: the
// LLM sees every recent email and decides what holds jobs.
export async function readRecentMessages(
  driver: MailDriver,
  options: ReadRecentOptions,
): Promise<MailMessage[]> {
  await driver.connect()
  try {
    return await driver.search({ mailbox: options.mailbox, since: options.since })
  } finally {
    await driver.close()
  }
}

// imapflow throws a bare `Error('Command failed')` for EVERY IMAP NO/BAD
// response and hangs the actual reason off the error object instead
// (`responseText` — the server's own text, e.g. "Invalid credentials
// (Failure)" — plus a `serverResponseCode` like AUTHENTICATIONFAILED). Reading
// only `.message` therefore reports "Command failed" for a wrong app password,
// a locked mailbox and a rate-limit alike. Prefer the server's text, keep the
// code, and fall back to the message for non-IMAP failures (DNS, TLS, socket
// timeouts), which carry a useful `.message` of their own.
export function describeMailError(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error)
  const record = error as {
    message?: unknown
    responseText?: unknown
    serverResponseCode?: unknown
  }
  const fallback = typeof record.message === 'string' && record.message !== '' ? record.message : ''
  const detail = typeof record.responseText === 'string' ? record.responseText.trim() : ''
  const code = typeof record.serverResponseCode === 'string' ? record.serverResponseCode.trim() : ''
  const reason = detail !== '' ? detail : fallback
  if (reason === '') return code !== '' ? code : 'mail read failed'
  return code !== '' && !reason.includes(code) ? `${reason} (${code})` : reason
}

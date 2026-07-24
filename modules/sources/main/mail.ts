// IMAP transport for the email-ingestion source — reads recent messages from
// the user's own inbox and hands them to the LLM extractor. Built
// driver-injected and fake-tested, the same transport-first approach as
// PoliteHttpClient (§4.3). The real driver (an imapflow adapter) is a thin
// layer added when going live; the engine and tests drive everything through
// the MailDriver interface, so no network or real mailbox is needed to
// exercise the read/close logic.

// Message headers only — cheap to fetch (no body, no attachments, no inline
// images). Enough to decide whether a message is worth downloading at all.
export interface MailEnvelope {
  uid: number
  from: string // sender address (as received; matching is case-insensitive)
  subject: string
  date: string // ISO; the fetchedAt fallback when a posting has no date
  messageId: string | null // RFC822 Message-ID header — used to deep-link Gmail
}

// One decoded message pulled from the inbox: its envelope plus the decoded
// body parts. Parsers prefer `html` and fall back to `text`.
export interface MailMessage extends MailEnvelope {
  html: string | null
  text: string | null
}

// The mailbox search window — constrained by mailbox + date only. We no longer
// filter by sender: every recent email is handed to the LLM, which decides
// whether it holds job postings (the "read everything" mode).
export interface MailSearchQuery {
  mailbox: string // e.g. the 'Jobs' label the user filters alerts into
  since: Date
}

// Fetch bodies for an explicit set of messages, in one mailbox.
export interface MailFetchRequest {
  mailbox: string
  uids: number[]
}

// The seam between this module and the outside world: the real implementation
// wraps imapflow, tests pass a fake.
//
// The read is deliberately TWO-PHASE. Downloading every message in the window
// and discarding the already-scanned ones afterwards meant re-downloading the
// full 30-day archive on every sync — ~100 s and tens of MB to discover there
// was nothing new. `listEnvelopes` fetches headers only (cheap); the caller
// filters those against its scanned-message memory and then asks for the
// bodies of the survivors alone.
export interface MailDriver {
  connect(): Promise<void>
  listEnvelopes(query: MailSearchQuery): Promise<MailEnvelope[]>
  fetchMessages(request: MailFetchRequest): Promise<MailMessage[]>
  close(): Promise<void>
}

// The encrypted mail-connection config (stored via safeStorage, never
// plaintext — the safeStorage-encrypted at-rest treatment). Gmail:
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

// Phase 1: headers for everything in the window. No sender filtering — the LLM
// decides what holds jobs; this only decides what is worth downloading.
export async function readRecentEnvelopes(
  driver: MailDriver,
  options: ReadRecentOptions,
): Promise<MailEnvelope[]> {
  await driver.connect()
  try {
    return await driver.listEnvelopes({ mailbox: options.mailbox, since: options.since })
  } finally {
    await driver.close()
  }
}

// Phase 2: full bodies, for the chosen messages only. Both helpers are pure
// orchestration over the injected driver — no imapflow import here, so they
// unit-test against a fake with zero I/O — and both guarantee close() runs
// even when the driver throws.
export async function readMessages(
  driver: MailDriver,
  request: MailFetchRequest,
): Promise<MailMessage[]> {
  if (request.uids.length === 0) return []
  await driver.connect()
  try {
    return await driver.fetchMessages(request)
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

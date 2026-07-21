// IMAP transport for the email-ingestion source (LinkedIn/Indeed/StepStone/
// Xing job-alert emails from the user's own inbox). Built driver-injected and
// fake-tested BEFORE the per-sender parsers need it — the same transport-first
// approach as PoliteHttpClient (§4.3). The real driver (an imapflow adapter)
// is a thin layer added when going live; the engine and tests drive everything
// through the MailDriver interface, so no network or real mailbox is needed to
// exercise the read/filter/close logic.

// One decoded message pulled from the inbox. `html`/`text` are the decoded
// body parts; parsers prefer `html` and fall back to `text`.
export interface MailMessage {
  uid: number
  from: string // sender address (as received; matching is case-insensitive)
  subject: string
  date: string // ISO; the fetchedAt fallback when a posting has no date
  html: string | null
  text: string | null
}

// The mailbox search window. Server-side we constrain by mailbox + date; the
// sender filter is re-applied client-side (below) so a loose server never
// leaks unrelated mail into the parsers.
export interface MailSearchQuery {
  mailbox: string // e.g. the 'Jobs' label the user filters alerts into
  since: Date
}

// The seam between this module and the outside world: the real implementation
// wraps imapflow, tests pass a fake. Lifecycle is connect → search → close,
// and readAlertMessages guarantees close() runs even when search() throws.
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

export interface ReadAlertOptions {
  mailbox: string
  // Sender fragments to keep, matched case-insensitively as substrings of the
  // From address (e.g. 'linkedin.com', 'indeed.com') so sub-addressing and
  // display-name noise never break the match.
  senderPatterns: string[]
  since: Date
}

// Connect, search the window, keep only messages from the wanted senders, and
// always close the connection. Pure orchestration over the injected driver —
// no imapflow import here, so it unit-tests against a fake with zero I/O.
export async function readAlertMessages(
  driver: MailDriver,
  options: ReadAlertOptions,
): Promise<MailMessage[]> {
  const patterns = options.senderPatterns.map((pattern) => pattern.toLowerCase())
  await driver.connect()
  try {
    const messages = await driver.search({ mailbox: options.mailbox, since: options.since })
    // Defensive re-filter: never trust the server applied the sender constraint
    // exactly — one stray newsletter must not reach a parser.
    return messages.filter((message) => {
      const from = message.from.toLowerCase()
      return patterns.some((pattern) => from.includes(pattern))
    })
  } finally {
    await driver.close()
  }
}

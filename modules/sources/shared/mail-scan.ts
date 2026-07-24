import { z } from 'zod'

// User-controlled first-sweep filters for the inbox agent — the deterministic
// triage that decides which emails are worth scanning, BEFORE the LLM. Editable
// on the Sources page; persisted in electron-store; read by the mailbox
// provider each pass. Zod stays module-internal (isolatedDeclarations);
// consumers use the exported types + helpers.

export interface MailScanDomain {
  // A substring matched (case-insensitively) against the From header — both
  // "jobs@linkedin.com" and "LinkedIn <n@e.linkedin.com>" hit "linkedin.".
  domain: string
  // enabled → its emails are scanned (deterministic include).
  // disabled → its emails are HARD-EXCLUDED: never triaged, downloaded, or
  //   extracted, so no new jobs come from that sender (already-found jobs stay).
  enabled: boolean
}

export interface MailScanConfig {
  domains: MailScanDomain[]
  // Subject keywords (include-only): a subject containing one marks the email
  // as job mail. Keywords never exclude — an email can still match a domain.
  keywords: string[]
}

// The recognized job-board and job-signal senders, all enabled by default. The
// user turns off the ones they don't want and adds their own.
const DEFAULT_DOMAINS: readonly string[] = [
  'linkedin.',
  'indeed.',
  'stepstone.',
  'xing.',
  'glassdoor.',
  'instaffo.',
  'arbeitnow.',
  'himalayas.',
  'weworkremotely.',
  'remoteok.',
  'join.com',
  'jobs.',
  'jobalert',
  'jobagent',
  'karriere',
  'recruit',
  'talent',
  'hiring',
]

// Subject words that mark job mail across the languages this inbox sees.
const DEFAULT_KEYWORDS: readonly string[] = [
  'job',
  'jobs',
  'stelle',
  'stellen',
  'stellenangebot',
  'position',
  'vacancy',
  'vacancies',
  'karriere',
  'career',
  'hiring',
  'recruiter',
  'opportunity',
  'opportunities',
  'bewerbung',
  'apply',
  'application',
  'opening',
  'role',
  'developer',
  'engineer',
  'praktikum',
  'internship',
]

export const DEFAULT_MAIL_SCAN_CONFIG: MailScanConfig = {
  domains: DEFAULT_DOMAINS.map((domain) => ({ domain, enabled: true })),
  keywords: [...DEFAULT_KEYWORDS],
}

// The shape is validated loosely — empties/duplicates/casing are cleaned in the
// fold below, not rejected, so a slightly-off UI submission still applies.
const mailScanSchema = z.object({
  domains: z
    .array(
      z.object({
        domain: z.string().max(120),
        enabled: z.boolean(),
      }),
    )
    .max(200),
  keywords: z.array(z.string().max(60)).max(200),
}) satisfies z.ZodType<MailScanConfig>

export type ValidationResult<T> = { data: T } | { error: string }

export function validateMailScanConfig(input: unknown): ValidationResult<MailScanConfig> {
  const parsed = mailScanSchema.safeParse(input)
  if (parsed.success) {
    // Fold case + trim, drop empty/duplicate domains — a UI can't guarantee it.
    const seen = new Set<string>()
    const domains: MailScanDomain[] = []
    for (const entry of parsed.data.domains) {
      const domain = entry.domain.trim().toLowerCase()
      if (domain === '' || seen.has(domain)) continue
      seen.add(domain)
      domains.push({ domain, enabled: entry.enabled })
    }
    const keywords = [
      ...new Set(parsed.data.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k !== '')),
    ]
    return { data: { domains, keywords } }
  }
  const issue = parsed.error.issues[0]
  return { error: `${issue?.path.join('.') ?? 'mailScan'}: ${issue?.message ?? 'invalid'}` }
}

// Stored config may be stale/partial — fall back to defaults so a bad shape
// never breaks the scan.
export function resolveMailScanConfig(stored: unknown): MailScanConfig {
  const result = validateMailScanConfig(stored)
  return 'data' in result ? result.data : DEFAULT_MAIL_SCAN_CONFIG
}

// --- matching (pure, shared by triage and tests) ---

function senderMatches(from: string, domain: string): boolean {
  return from.toLowerCase().includes(domain.toLowerCase())
}

// The sender is on a DISABLED domain → hard-excluded from the scan entirely.
export function isExcludedSender(from: string, config: MailScanConfig): boolean {
  return config.domains.some((d) => !d.enabled && senderMatches(from, d.domain))
}

// The sender is on an ENABLED domain → deterministically included.
export function isIncludedSender(from: string, config: MailScanConfig): boolean {
  return config.domains.some((d) => d.enabled && senderMatches(from, d.domain))
}

// Escape a keyword for use inside a word-bounded regex.
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The subject contains one of the (word-bounded) keywords.
export function subjectMatchesKeywords(subject: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const pattern = new RegExp(`\\b(?:${keywords.map(escapeRegex).join('|')})\\b`, 'i')
  return pattern.test(subject)
}

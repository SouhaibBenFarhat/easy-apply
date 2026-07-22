import type { NormalizedJob, SourceId, WorkMode } from '@sources/shared'
import { z } from 'zod'
import { classifyWorkMode } from './classify'
import type { MailMessage } from './mail'
import { buildDedupeKey, cleanText, stripHtmlKeepingLinks, toIsoOrNull } from './normalize'

// The agentic core: turn an arbitrary email into normalized jobs via an
// on-device LLM. The model sits behind the LlmClient seam (Phase 2 wraps
// node-llama-cpp), so all of this extraction logic is unit-tested against a
// fake — no model needed. Reliability comes from the harness, not the model:
// the completion is parsed leniently, validated with zod, and every job is
// anchored on a real http(s) applyUrl so a hallucinated posting never reaches
// the feed. The board a job belongs to is inferred from its apply URL, so this
// works on any inbox email — not just known job-alert senders.

export interface LlmCompleteOptions {
  // Abort the generation mid-stream (the Stop button / AI-off), so a slow call
  // halts immediately instead of only between emails.
  signal?: AbortSignal
}

export interface LlmClient {
  complete(prompt: string, options?: LlmCompleteOptions): Promise<string>
}

// The outcome of running one email through the model + harness — the numbers
// the pipeline monitor funnels on.
export interface ExtractionResult {
  jobs: NormalizedJob[] // items that survived the keep-harness
  proposed: number // rows the model returned before the harness
}

// apply-URL host fragment → the board it belongs to. Anything unrecognized is
// tagged `mailbox` (the generic email source) so it still reaches the feed.
const URL_SOURCES: ReadonlyArray<{ pattern: string; sourceId: SourceId }> = [
  { pattern: 'linkedin.', sourceId: 'linkedin' },
  { pattern: 'indeed.', sourceId: 'indeed' },
  { pattern: 'stepstone.', sourceId: 'stepstone' },
  { pattern: 'xing.', sourceId: 'xing' },
]

function sourceFromUrl(url: string): SourceId {
  const lower = url.toLowerCase()
  for (const { pattern, sourceId } of URL_SOURCES) if (lower.includes(pattern)) return sourceId
  return 'mailbox'
}

// Once the CSS/script noise is stripped, a job digest's real text is small, so
// this comfortably holds a large "see all jobs" digest. Sized against the 8192
// context window (src/main/llm.ts): ~10k chars is ~3.5–4.5k tokens once
// tracking URLs are counted, leaving real room for instructions + up to 25
// jobs of JSON output; raise the model context too if you raise this further.
const MAX_EMAIL_CHARS = 10_000
const MAX_JOBS_PER_EMAIL = 25

// zod stays module-internal (house rule); everything optional so one odd row
// never sinks the batch.
const extractedJobSchema = z.looseObject({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  workMode: z.string().optional(),
  applyUrl: z.string().optional(),
})

// The email is stripped to text and truncated so a long digest stays inside the
// model's context window.
export function buildExtractionPrompt(emailText: string): string {
  return [
    'Extract every job posting from this email as a JSON array.',
    'Each item: {"title","company","location","workMode","applyUrl"}.',
    'workMode is one of: remote, hybrid, onsite, unknown.',
    'applyUrl is the posting link. Return ONLY the JSON array, nothing else.',
    'If the email contains no job postings, return an empty array: [].',
    '',
    emailText.slice(0, MAX_EMAIL_CHARS),
  ].join('\n')
}

// Pull the first JSON array out of a completion that may be wrapped in prose or
// a ```json fence. Returns [] on anything unparseable — never throws.
function parseJsonArray(completion: string): unknown[] {
  const start = completion.indexOf('[')
  const end = completion.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  try {
    const parsed: unknown = JSON.parse(completion.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function resolveWorkMode(value: string | undefined, haystack: string): WorkMode {
  const mode = value?.toLowerCase()
  if (mode === 'remote' || mode === 'hybrid' || mode === 'onsite') return mode
  // The model omitted or garbled it — fall back to the shared text heuristic.
  return classifyWorkMode({ title: '', description: haystack, locationRaw: '' })
}

function slugifyUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function extractJobsFromEmail(
  message: MailMessage,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  // Keep link URLs — the apply link lives in the <a href>, so the model needs
  // it to produce a valid applyUrl (else every job is dropped by the harness).
  const text = stripHtmlKeepingLinks(message.html ?? message.text ?? '')
  if (text.trim() === '') return { jobs: [], proposed: 0 }

  let completion: string
  try {
    completion = await llm.complete(buildExtractionPrompt(text), { signal })
  } catch {
    return { jobs: [], proposed: 0 } // one email failing the model never sinks the sync
  }

  const rows = parseJsonArray(completion).slice(0, MAX_JOBS_PER_EMAIL)
  const jobs: NormalizedJob[] = []
  const seen = new Set<string>()
  const postedAt = toIsoOrNull(message.date)

  for (const row of rows) {
    const parsed = extractedJobSchema.safeParse(row)
    if (!parsed.success) continue
    const entry = parsed.data
    const title = cleanText(entry.title ?? '')
    const company = cleanText(entry.company ?? '')
    const applyUrl = (entry.applyUrl ?? '').trim()
    // Anchor on a real link: no title/company/http(s) URL → drop it.
    if (title === '' || company === '' || !/^https?:\/\//i.test(applyUrl)) continue
    // The board is inferred from the apply link, not the sender.
    const sourceId = sourceFromUrl(applyUrl)
    const id = `${sourceId}:${slugifyUrl(applyUrl)}`
    if (seen.has(id)) continue
    seen.add(id)
    const location = cleanText(entry.location ?? '')
    jobs.push({
      id,
      sourceId,
      url: applyUrl,
      applyUrl,
      title,
      company,
      locationRaw: location,
      city: location === '' ? null : location,
      country: null,
      workMode: resolveWorkMode(entry.workMode, `${title} ${location}`),
      remoteScope: null,
      salary: { min: null, max: null, currency: null, period: null, isEstimated: false, raw: null },
      postedAt,
      descriptionHtml: null,
      tags: [],
      dedupeKey: buildDedupeKey(company, title, location === '' ? null : location),
    })
  }
  return { jobs, proposed: rows.length }
}

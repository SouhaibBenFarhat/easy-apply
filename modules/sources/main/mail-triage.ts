import type { MailScanConfig } from '@sources/shared'
import { isIncludedSender, subjectMatchesKeywords } from '@sources/shared'
import type { MailEnvelope } from './mail'
import type { LlmClient } from './mail-extract'

// Triage: decide which emails are worth the (expensive) extraction call, from
// HEADERS ALONE — no bodies downloaded yet.
//
// Extraction costs one full LLM generation per email, and that cost is flat
// whether the email is a 25-job digest or a furniture newsletter: the model
// still reasons its way to "no jobs". Scanning 200 emails that way takes hours,
// and most of them were never job mail. Triage spends a few cheap batched calls
// to skip the ones that obviously aren't.
//
// Two stages, in order of cost:
//   1. deterministic — the user's ENABLED job-sender domains and subject
//      keywords (mail-scan.ts). Free, instant, certain on the easy cases.
//   2. the model — one batched call per chunk over whatever stage 1 could not
//      decide, judging sender + subject.
//
// HARD EXCLUSION happens BEFORE triage (in the mailbox provider): an email from
// a DISABLED domain is dropped and never reaches here. Among what remains, an
// enabled sender may only include, never exclude — an unrecognized sender is not
// dropped; it goes to the model.

export type TriageDecision = 'sender' | 'subject' | 'model' | 'skipped'

export interface TriageResult {
  // Envelopes worth downloading and extracting, in the order given.
  selected: MailEnvelope[]
  // How each selected envelope earned its place (uid → reason), plus the
  // count that the deterministic pass alone resolved.
  decisions: Map<number, TriageDecision>
  // Envelopes the model was asked about (the ones stage 1 could not decide).
  askedModel: number
}

// Stage 1. Returns true when the envelope is job mail beyond doubt, per the
// user's enabled domains + keywords.
export function isObviousJobMail(envelope: MailEnvelope, config: MailScanConfig): boolean {
  return (
    isIncludedSender(envelope.from, config) ||
    subjectMatchesKeywords(envelope.subject, config.keywords)
  )
}

// One line per undecided email, numbered so the model answers with numbers
// instead of echoing subjects back (fewer tokens, nothing to mis-transcribe).
export function buildTriagePrompt(envelopes: MailEnvelope[]): string {
  const rows = envelopes.map(
    (envelope, index) =>
      `${index + 1} | ${envelope.from.slice(0, 60)} | ${envelope.subject.slice(0, 90)}`,
  )
  return [
    'Below is a numbered list of emails (number | sender | subject).',
    'Decide which ones might contain job postings or job alerts.',
    'Include anything plausibly job-related — a missed job is worse than a wasted check.',
    'Answer with ONLY a JSON array of the numbers, e.g. [1,4,7]. No other text.',
    'If none qualify, answer [].',
    '',
    ...rows,
  ].join('\n')
}

// Parse the model's number list. Anything unreadable returns null, which the
// caller treats as "keep them all" — this filter may never silently drop mail.
export function parseTriageAnswer(completion: string, count: number): number[] | null {
  const start = completion.indexOf('[')
  const end = completion.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(completion.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const picked = new Set<number>()
  for (const entry of parsed) {
    const value = typeof entry === 'number' ? entry : Number(entry)
    if (Number.isInteger(value) && value >= 1 && value <= count) picked.add(value)
  }
  return [...picked]
}

export interface TriageOptions {
  // The user's enabled domains + subject keywords for the deterministic pass.
  config: MailScanConfig
  llm?: LlmClient
  signal?: AbortSignal
  // Emails per model call. Small enough that one malformed answer costs a
  // chunk rather than the run, and that the list stays well inside the context.
  chunkSize?: number
  // Progress for the timeline: called once per model chunk.
  onChunk?: (done: number, total: number) => void
}

// Emails per model call. Exported so callers can size their progress total the
// same way triage does, instead of guessing.
export const TRIAGE_CHUNK_SIZE = 40
// The answer is a list of numbers; nothing legitimate needs more than this.
const MAX_TRIAGE_TOKENS = 300

export async function triageEnvelopes(
  envelopes: MailEnvelope[],
  options: TriageOptions,
): Promise<TriageResult> {
  const { config } = options
  const decisions = new Map<number, TriageDecision>()
  const undecided: MailEnvelope[] = []

  for (const envelope of envelopes) {
    if (isObviousJobMail(envelope, config)) {
      decisions.set(envelope.uid, isIncludedSender(envelope.from, config) ? 'sender' : 'subject')
    } else {
      undecided.push(envelope)
    }
  }

  // No model (not installed / AI off) means no second opinion — scan the
  // undecided rather than discard them. Fail open, always.
  const { llm, signal } = options
  if (llm === undefined) {
    for (const envelope of undecided) decisions.set(envelope.uid, 'model')
    return {
      selected: envelopes.filter((envelope) => decisions.has(envelope.uid)),
      decisions,
      askedModel: 0,
    }
  }

  const chunkSize = options.chunkSize ?? TRIAGE_CHUNK_SIZE
  const chunks: MailEnvelope[][] = []
  for (let i = 0; i < undecided.length; i += chunkSize)
    chunks.push(undecided.slice(i, i + chunkSize))

  for (const [index, chunk] of chunks.entries()) {
    if (signal?.aborted) break
    let picked: number[] | null = null
    try {
      const completion = await llm.complete(buildTriagePrompt(chunk), {
        signal,
        maxTokens: MAX_TRIAGE_TOKENS,
      })
      picked = parseTriageAnswer(completion, chunk.length)
    } catch {
      picked = null // a failed call must not drop a whole chunk of mail
    }
    // null = unreadable answer or a failed call → keep the whole chunk.
    const keep = picked === null ? chunk : picked.flatMap((number) => chunk[number - 1] ?? [])
    for (const envelope of keep) decisions.set(envelope.uid, 'model')
    options.onChunk?.(index + 1, chunks.length)
  }

  // Aborted mid-triage: whatever the model never saw is kept, not lost.
  if (signal?.aborted) {
    for (const envelope of undecided)
      if (!decisions.has(envelope.uid)) decisions.set(envelope.uid, 'model')
  }

  return {
    selected: envelopes.filter((envelope) => decisions.has(envelope.uid)),
    decisions,
    askedModel: undecided.length,
  }
}

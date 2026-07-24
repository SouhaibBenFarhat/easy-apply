// @vitest-environment node
import { DEFAULT_MAIL_SCAN_CONFIG } from '@sources/shared'
import { describe, expect, it, vi } from 'vitest'
import type { MailEnvelope } from './mail'
import type { LlmClient } from './mail-extract'
import {
  buildTriagePrompt,
  isObviousJobMail,
  parseTriageAnswer,
  triageEnvelopes,
} from './mail-triage'

const CONFIG = DEFAULT_MAIL_SCAN_CONFIG

function env(uid: number, from: string, subject: string): MailEnvelope {
  return { uid, from, subject, date: '2026-07-21T09:00:00.000Z', messageId: `<m-${uid}@x>` }
}

function fakeLlm(answer: string | Error, seen?: string[]): LlmClient {
  return {
    complete: async (prompt) => {
      seen?.push(prompt)
      if (answer instanceof Error) throw answer
      return answer
    },
  }
}

describe('isObviousJobMail', () => {
  it.each([
    ['jobs-noreply@linkedin.com', 'Weekly update'],
    ['"Instaffo" <noreply@trk.instaffo.com>', 'Verpasse deine Chance nicht'],
    ['noreply@glassdoor.de', 'Neues für dich'],
    ['hello@random.io', '3 neue Stellen in München'],
    ['news@medium.com', 'Senior Engineer opening at Acme'],
  ])('flags %s / %s', (from, subject) => {
    expect(isObviousJobMail(env(1, from, subject), CONFIG)).toBe(true)
  })

  it.each([
    ['news@medium.com', 'Your weekly digest'],
    ['billing@stripe.com', 'Your receipt'],
  ])('leaves %s / %s undecided', (from, subject) => {
    expect(isObviousJobMail(env(1, from, subject), CONFIG)).toBe(false)
  })
})

describe('parseTriageAnswer', () => {
  it('reads a plain list and ignores out-of-range or duplicate numbers', () => {
    expect(parseTriageAnswer('[1,3,3,9,0,-2]', 4)).toEqual([1, 3])
  })

  it('tolerates prose and fences around the list', () => {
    expect(parseTriageAnswer('Sure:\n```json\n[2]\n```', 3)).toEqual([2])
  })

  // null means "unreadable" — the caller keeps the whole chunk rather than
  // dropping mail on a bad answer.
  it.each(['no json here', '{"a":1}', ''])('returns null for %s', (completion) => {
    expect(parseTriageAnswer(completion, 3)).toBeNull()
  })
})

describe('buildTriagePrompt', () => {
  it('numbers the rows and carries sender + subject', () => {
    const prompt = buildTriagePrompt([
      env(7, 'jobs@xing.com', '3 neue Jobs'),
      env(8, 'news@medium.com', 'Weekly digest'),
    ])
    expect(prompt).toContain('1 | jobs@xing.com | 3 neue Jobs')
    expect(prompt).toContain('2 | news@medium.com | Weekly digest')
    // Numbers back, not subjects — cheap to generate, nothing to mis-transcribe.
    expect(prompt).toContain('JSON array of the numbers')
  })
})

describe('triageEnvelopes', () => {
  const jobMail = env(1, 'jobs-noreply@linkedin.com', 'Your job alert')
  const newsletter = env(2, 'news@medium.com', 'Your weekly digest')
  const receipt = env(3, 'billing@stripe.com', 'Your receipt')

  it('resolves obvious mail deterministically and only asks about the rest', async () => {
    const prompts: string[] = []
    const result = await triageEnvelopes([jobMail, newsletter, receipt], {
      config: CONFIG,
      llm: fakeLlm('[1]', prompts),
    })

    // The LinkedIn mail never reached the model.
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain('linkedin')
    expect(result.askedModel).toBe(2)
    expect(result.selected.map((e) => e.uid)).toEqual([1, 2]) // newsletter picked as #1
    expect(result.decisions.get(1)).toBe('sender')
    expect(result.decisions.get(2)).toBe('model')
  })

  it('chunks the model calls and reports progress', async () => {
    const envelopes = Array.from({ length: 5 }, (_, i) => env(i + 1, 'a@unknown.io', 'hello there'))
    const onChunk = vi.fn()
    await triageEnvelopes(envelopes, { config: CONFIG, llm: fakeLlm('[]'), chunkSize: 2, onChunk })
    expect(onChunk.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  // This filter can lose jobs, so every failure mode keeps mail rather than
  // dropping it.
  it('keeps the whole chunk when the model answer is unreadable', async () => {
    const result = await triageEnvelopes([newsletter, receipt], {
      config: CONFIG,
      llm: fakeLlm('I think none'),
    })
    expect(result.selected.map((e) => e.uid)).toEqual([2, 3])
  })

  it('keeps the whole chunk when the model call throws', async () => {
    const result = await triageEnvelopes([newsletter, receipt], {
      config: CONFIG,
      llm: fakeLlm(new Error('out of memory')),
    })
    expect(result.selected.map((e) => e.uid)).toEqual([2, 3])
  })

  it('scans everything when no model is available', async () => {
    const result = await triageEnvelopes([newsletter, receipt], { config: CONFIG })
    expect(result.selected.map((e) => e.uid)).toEqual([2, 3])
    expect(result.askedModel).toBe(0)
  })

  it('keeps the un-judged remainder when triage is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await triageEnvelopes([newsletter, receipt], {
      config: CONFIG,
      llm: fakeLlm('[]'),
      signal: controller.signal,
    })
    expect(result.selected.map((e) => e.uid)).toEqual([2, 3])
  })

  it('drops nothing that the model picked, and nothing it did not', async () => {
    const envelopes = [newsletter, receipt, env(4, 'a@unknown.io', 'hello')]
    const result = await triageEnvelopes(envelopes, { config: CONFIG, llm: fakeLlm('[2]') })
    expect(result.selected.map((e) => e.uid)).toEqual([3])
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { MailMessage } from './mail'
import { extractJobsFromEmail, type LlmClient } from './mail-extract'

function email(html: string): MailMessage {
  return {
    uid: 1,
    from: 'jobalerts-noreply@linkedin.com',
    subject: 'Your job alerts',
    date: '2026-07-21T09:00:00.000Z',
    html,
    text: null,
    messageId: '<alert@mail>',
  }
}

function fakeLlm(response: string | Error): LlmClient {
  return {
    complete: async () => {
      if (response instanceof Error) throw response
      return response
    },
  }
}

describe('extractJobsFromEmail', () => {
  it('maps a JSON array of jobs onto NormalizedJob, inferring the board from the URL', async () => {
    const llm = fakeLlm(
      JSON.stringify([
        {
          title: 'Backend Engineer',
          company: 'Isar GmbH',
          location: 'München',
          workMode: 'hybrid',
          applyUrl: 'https://linkedin.com/jobs/view/123',
        },
      ]),
    )
    const { jobs, proposed } = await extractJobsFromEmail(email('<p>whatever</p>'), llm)
    expect(proposed).toBe(1)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      id: 'linkedin:linkedin-com-jobs-view-123',
      sourceId: 'linkedin',
      title: 'Backend Engineer',
      company: 'Isar GmbH',
      workMode: 'hybrid',
      url: 'https://linkedin.com/jobs/view/123',
      postedAt: '2026-07-21T09:00:00.000Z',
    })
    expect(jobs[0]?.dedupeKey).toBe('isar|backend engineer|münchen')
  })

  it('tags an unrecognized board URL as the generic mailbox source', async () => {
    const llm = fakeLlm(
      JSON.stringify([
        { title: 'Dev', company: 'A', applyUrl: 'https://careers.acme.io/1' },
        { title: 'Ops', company: 'B', applyUrl: 'https://stepstone.de/2' },
      ]),
    )
    const { jobs } = await extractJobsFromEmail(email('<p>x</p>'), llm)
    expect(jobs.map((job) => job.sourceId)).toEqual(['mailbox', 'stepstone'])
  })

  // Instaffo's apply links live on its tracking host, and Glassdoor mail was
  // landing in the generic bucket — both now get their own chip.
  it('recognizes glassdoor and instaffo apply links', async () => {
    const llm = fakeLlm(
      JSON.stringify([
        { title: 'Dev', company: 'A', applyUrl: 'https://www.glassdoor.de/job/1' },
        { title: 'Staff', company: 'B', applyUrl: 'https://trk.instaffo.com/ls/click?upn=abc' },
      ]),
    )
    const { jobs } = await extractJobsFromEmail(email('<p>x</p>'), llm)
    expect(jobs.map((job) => job.sourceId)).toEqual(['glassdoor', 'instaffo'])
  })

  it('handles a completion wrapped in prose/fence and dedupes by URL', async () => {
    const llm = fakeLlm(
      'Sure:\n```json\n[' +
        '{"title":"Dev","company":"A","applyUrl":"https://x.com/1"},' +
        '{"title":"Dev","company":"A","applyUrl":"https://x.com/1"}]\n```',
    )
    const { jobs, proposed } = await extractJobsFromEmail(email('<p>x</p>'), llm)
    expect(proposed).toBe(2)
    expect(jobs).toHaveLength(1)
  })

  it('drops rows missing a title, company, or valid http apply URL', async () => {
    const llm = fakeLlm(
      JSON.stringify([
        { title: 'No URL', company: 'A' },
        { title: '', company: 'A', applyUrl: 'https://x.com/1' },
        { title: 'A', company: '', applyUrl: 'https://x.com/2' },
        { title: 'XSS', company: 'A', applyUrl: 'javascript:alert(1)' },
      ]),
    )
    const { jobs } = await extractJobsFromEmail(email('<p>x</p>'), llm)
    expect(jobs).toEqual([])
  })

  it('returns no jobs on a model error or an empty email without throwing', async () => {
    expect((await extractJobsFromEmail(email('<p>x</p>'), fakeLlm(new Error('oom')))).jobs).toEqual(
      [],
    )
    expect((await extractJobsFromEmail(email(''), fakeLlm('[]'))).jobs).toEqual([])
    expect((await extractJobsFromEmail(email('<p>x</p>'), fakeLlm('not json'))).jobs).toEqual([])
  })

  // The sanitizer round-trip: tracking URLs never reach the prompt (the model
  // cites a short [LINK-n] tag instead of hand-copying 1,500 chars of tracking
  // garbage), and the harness expands the cited tag back to the real URL.
  it('prompts with [LINK-n] tags instead of raw URLs and expands the cited tag', async () => {
    const trackingUrl = `https://trk.instaffo.com/ls/click?upn=${'x'.repeat(1_500)}`
    const prompts: string[] = []
    const llm: LlmClient = {
      complete: async (prompt) => {
        prompts.push(prompt)
        return JSON.stringify([
          { title: 'Staff Engineer', company: 'Peter Park', applyUrl: '[LINK-1]' },
        ])
      },
    }
    const { jobs } = await extractJobsFromEmail(
      email(`<p>Staff Engineer at <a href="${trackingUrl}">Peter Park</a></p>`),
      llm,
    )
    expect(prompts[0]).not.toContain('trk.instaffo.com')
    expect(prompts[0]).toContain('[LINK-1]')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.applyUrl).toBe(trackingUrl)
  })

  // Generation is serial, so an uncapped answer is an uncapped stall — this is
  // the guard that turns a model repeating itself into a bounded cost.
  it('caps the generated answer length', async () => {
    let seen: { maxTokens?: number } | undefined
    const llm: LlmClient = {
      complete: async (_prompt, options) => {
        seen = options
        return '[]'
      },
    }
    await extractJobsFromEmail(email('<p>x</p>'), llm)
    expect(seen?.maxTokens).toBe(1_200)
  })

  // Stronger than the old raw-URL check: a tag that is not in the email's link
  // table cannot be expanded, so the invented job never reaches the feed.
  it('drops a job citing a link tag that does not exist in the email', async () => {
    const llm = fakeLlm(JSON.stringify([{ title: 'Ghost', company: 'A', applyUrl: '[LINK-9]' }]))
    const { jobs } = await extractJobsFromEmail(email('<p>no links here</p>'), llm)
    expect(jobs).toEqual([])
  })

  it('classifies work mode from the text when the model omits it', async () => {
    const llm = fakeLlm(
      JSON.stringify([
        {
          title: 'Remote Engineer',
          company: 'A',
          location: 'Anywhere',
          applyUrl: 'https://x.com/1',
        },
      ]),
    )
    const { jobs } = await extractJobsFromEmail(email('<p>fully remote role</p>'), llm)
    expect(jobs[0]?.workMode).toBe('remote')
  })
})

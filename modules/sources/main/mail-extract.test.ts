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
  it('maps a JSON array of jobs onto NormalizedJob, stripping legal suffixes', async () => {
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
    const jobs = await extractJobsFromEmail(email('<p>whatever</p>'), 'linkedin', llm)
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

  it('handles a completion wrapped in prose/fence and dedupes by URL', async () => {
    const llm = fakeLlm(
      'Sure:\n```json\n[' +
        '{"title":"Dev","company":"A","applyUrl":"https://x.com/1"},' +
        '{"title":"Dev","company":"A","applyUrl":"https://x.com/1"}]\n```',
    )
    const jobs = await extractJobsFromEmail(email('<p>x</p>'), 'indeed', llm)
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
    expect(await extractJobsFromEmail(email('<p>x</p>'), 'xing', llm)).toEqual([])
  })

  it('returns [] on a model error or an empty email without throwing', async () => {
    expect(
      await extractJobsFromEmail(email('<p>x</p>'), 'linkedin', fakeLlm(new Error('oom'))),
    ).toEqual([])
    expect(await extractJobsFromEmail(email(''), 'linkedin', fakeLlm('[]'))).toEqual([])
    expect(await extractJobsFromEmail(email('<p>x</p>'), 'linkedin', fakeLlm('not json'))).toEqual(
      [],
    )
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
    const [job] = await extractJobsFromEmail(email('<p>fully remote role</p>'), 'linkedin', llm)
    expect(job?.workMode).toBe('remote')
  })
})

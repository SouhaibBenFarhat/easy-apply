// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { wwrProvider } from './wwr'

// Fixture is a real captured live all-jobs feed — ground truth over any docs.
// 96 <item> elements; 71 carry region 'Anywhere in the World', the other 25
// are region-restricted (US states, provinces, …).
const WWR = readFileSync(new URL('../../../test-utils/fixtures/wwr.rss', import.meta.url), 'utf8')

// The first real <item> of the capture (LawnStarter), reused to simulate the
// programming feed overlapping with the all-jobs feed.
const FIRST_ITEM = WWR.match(/<item>[\s\S]*?<\/item>/)?.[0] ?? ''

const feedOf = (items: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>WWR</title>${items}</channel></rss>`

const CDATA_ITEM = [
  '<item>',
  '<title>Acme Labs: Rust Engineer</title>',
  '<region>Anywhere in the World</region>',
  '<category>Programming</category>',
  '<type>Full-Time</type>',
  '<description><![CDATA[<p>Build <strong>fast</strong> things &amp; ship.</p>]]></description>',
  '<pubDate>Mon, 20 Jul 2026 08:00:00 +0000</pubDate>',
  '<link>https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer</link>',
  '<guid>https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer</guid>',
  '</item>',
].join('')

interface Harness {
  ctx: FetchContext
  requests: string[]
}

const noopLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

function makeCtx(bodies: string[] = [], profile: Partial<SearchProfile> = {}): Harness {
  const requests: string[] = []
  const queue = [...bodies]
  const http = {
    getText: (url: string): Promise<string> => {
      requests.push(url)
      const next = queue.shift()
      if (next === undefined) return Promise.reject(new Error('stub http exhausted'))
      return Promise.resolve(next)
    },
  } as unknown as PoliteHttpClient
  const ctx: FetchContext = {
    http,
    config: {},
    searchProfile: { ...DEFAULT_SEARCH_PROFILE, ...profile },
    logger: noopLogger,
  }
  return { ctx, requests }
}

describe('wwrProvider.meta', () => {
  it('describes the WeWorkRemotely source', () => {
    expect(wwrProvider.meta.id).toBe('wwr')
    expect(wwrProvider.meta.displayName).toBe('WeWorkRemotely')
    expect(wwrProvider.meta.homepage).toBe('https://weworkremotely.com')
    expect(wwrProvider.meta.enabledByDefault).toBe(true)
    expect(wwrProvider.meta.attribution).toEqual({ label: 'We Work Remotely', required: false })
    expect(wwrProvider.meta.politeness).toEqual({ minIntervalMinutes: 120, maxRequestsPerSync: 2 })
  })
})

describe('wwrProvider.fetch', () => {
  it('fetches the programming category feed and the all-jobs feed', async () => {
    const { ctx, requests } = makeCtx([WWR, WWR])
    const payloads = await wwrProvider.fetch(ctx)
    expect(payloads).toHaveLength(2)
    expect(payloads.every((payload) => payload.kind === 'rss')).toBe(true)
    expect(requests).toEqual([
      'https://weworkremotely.com/categories/remote-programming-jobs.rss',
      'https://weworkremotely.com/remote-jobs.rss',
    ])
  })

  it('skips the network entirely when the profile wants no remote scopes', async () => {
    const { ctx, requests } = makeCtx([WWR, WWR], { remoteScopes: [] })
    await expect(wwrProvider.fetch(ctx)).resolves.toEqual([])
    expect(requests).toHaveLength(0)
  })
})

// NOTE: each test builds a fresh ctx — the provider dedupes ids across the two
// feed payloads of one sync run by keying its seen-set on the FetchContext.
describe('wwrProvider.parse', () => {
  it('keeps the 71 Anywhere-in-the-World items of the 96 in the capture', () => {
    const { ctx } = makeCtx()
    const jobs = wwrProvider.parse({ kind: 'rss', body: WWR }, ctx)
    // Hand-verified against the fixture: 71 of 96 items carry region
    // 'Anywhere in the World'; the rest are region-restricted and dropped.
    expect(jobs).toHaveLength(71)
    expect(jobs.every((job) => job.remoteScope === 'worldwide')).toBe(true)
    expect(jobs.every((job) => job.id.startsWith('wwr:'))).toBe(true)
    // region 'California' → unmappable → dropped
    expect(
      jobs.some(
        (job) =>
          job.id ===
          'wwr:https://weworkremotely.com/remote-jobs/first-american-crm-campaign-manager',
      ),
    ).toBe(false)
  })

  it('maps a fixture item onto NormalizedJob, splitting Company: Role', () => {
    const { ctx } = makeCtx()
    const [job] = wwrProvider.parse({ kind: 'rss', body: WWR }, ctx)
    expect(job).toMatchObject({
      id: 'wwr:https://weworkremotely.com/remote-jobs/lawnstarter-senior-product-manager-pricing',
      sourceId: 'wwr',
      url: 'https://weworkremotely.com/remote-jobs/lawnstarter-senior-product-manager-pricing',
      applyUrl: null,
      title: 'Senior Product Manager, Pricing', // role keeps its own commas
      company: 'LawnStarter',
      locationRaw: 'Anywhere in the World',
      city: null,
      country: null,
      workMode: 'remote',
      remoteScope: 'worldwide',
      postedAt: '2026-07-20T10:55:05.000Z', // RFC 822 pubDate
      tags: ['Product', 'Full-Time'], // <category> + <type>
      dedupeKey: 'lawnstarter|senior product manager pricing|',
    })
    expect(job?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
  })

  it('extracts the entity-encoded HTML description non-empty', () => {
    const { ctx } = makeCtx()
    const [job] = wwrProvider.parse({ kind: 'rss', body: WWR }, ctx)
    // The feed entity-encodes the HTML (&lt;p&gt;…) — decoded back to markup.
    expect(job?.descriptionHtml).toContain('<p>')
    expect(job?.descriptionHtml).toContain('<strong>Headquarters:</strong>')
  })

  it('decodes XML entities in titles', () => {
    const { ctx } = makeCtx()
    const jobs = wwrProvider.parse({ kind: 'rss', body: WWR }, ctx)
    // Capture title: 'LawnStarter: Data Governance &amp; Platform Manager'
    const job = jobs.find(
      (candidate) =>
        candidate.id ===
        'wwr:https://weworkremotely.com/remote-jobs/lawnstarter-data-governance-platform-manager',
    )
    expect(job?.title).toBe('Data Governance & Platform Manager')
  })

  it('takes CDATA description content verbatim', () => {
    const { ctx } = makeCtx()
    const jobs = wwrProvider.parse({ kind: 'rss', body: feedOf(CDATA_ITEM) }, ctx)
    expect(jobs).toHaveLength(1)
    // CDATA inner text is already raw HTML — no entity decoding on top.
    expect(jobs[0]?.descriptionHtml).toBe('<p>Build <strong>fast</strong> things &amp; ship.</p>')
    expect(jobs[0]?.company).toBe('Acme Labs')
    expect(jobs[0]?.title).toBe('Rust Engineer')
  })

  it('dedupes guids across the two feed payloads of one sync run', () => {
    const { ctx } = makeCtx()
    const programming = wwrProvider.parse(
      { kind: 'rss', body: feedOf(FIRST_ITEM + CDATA_ITEM) },
      ctx,
    )
    expect(programming).toHaveLength(2)
    // The all-jobs feed repeats the LawnStarter item → only truly new items
    // survive the second parse under the same ctx.
    const allJobs = wwrProvider.parse({ kind: 'rss', body: WWR }, ctx)
    expect(allJobs).toHaveLength(70)
    expect(
      allJobs.some(
        (job) =>
          job.id ===
          'wwr:https://weworkremotely.com/remote-jobs/lawnstarter-senior-product-manager-pricing',
      ),
    ).toBe(false)
  })

  it('starts a fresh dedupe set for a fresh sync run context', () => {
    const first = makeCtx().ctx
    const second = makeCtx().ctx
    expect(wwrProvider.parse({ kind: 'rss', body: feedOf(FIRST_ITEM) }, first)).toHaveLength(1)
    // A different ctx (next sync run) sees the same item again.
    expect(wwrProvider.parse({ kind: 'rss', body: feedOf(FIRST_ITEM) }, second)).toHaveLength(1)
  })

  it('narrows kept scopes to the profile remoteScopes', () => {
    const germanyOnly = makeCtx([], { remoteScopes: ['germany'] }).ctx
    // Every scope-resolvable capture item is worldwide → all dropped.
    expect(wwrProvider.parse({ kind: 'rss', body: WWR }, germanyOnly)).toEqual([])
    // A Germany-region item is the only survivor under the narrowed profile.
    const germanItem = CDATA_ITEM.replace(
      '<region>Anywhere in the World</region>',
      '<region>Germany</region>',
    )
    const jobs = wwrProvider.parse(
      { kind: 'rss', body: feedOf(FIRST_ITEM + germanItem) },
      germanyOnly,
    )
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.remoteScope).toBe('germany')
  })

  it('keeps separator-less titles as company-less jobs', () => {
    const { ctx } = makeCtx()
    const item = CDATA_ITEM.replace(
      '<title>Acme Labs: Rust Engineer</title>',
      '<title>Standalone Role</title>',
    )
    const [job] = wwrProvider.parse({ kind: 'rss', body: feedOf(item) }, ctx)
    expect(job?.company).toBe('')
    expect(job?.title).toBe('Standalone Role')
    expect(job?.dedupeKey).toBe('|standalone role|')
  })

  it('falls back to the link as id and skips unlinkable or unmapped items', () => {
    const { ctx } = makeCtx()
    const noGuid = CDATA_ITEM.replace(
      '<guid>https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer</guid>',
      '',
    )
    const noGuidNoLink = noGuid.replace(
      '<link>https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer</link>',
      '',
    )
    const noTitle = CDATA_ITEM.replace('<title>Acme Labs: Rust Engineer</title>', '')
    const noRegion = CDATA_ITEM.replace('<region>Anywhere in the World</region>', '')
    const jobs = wwrProvider.parse(
      { kind: 'rss', body: feedOf(noGuid + noGuidNoLink + noTitle + noRegion) },
      ctx,
    )
    expect(jobs).toHaveLength(1) // only the guid-less (but linked) item survives
    expect(jobs[0]?.id).toBe('wwr:https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer')
    expect(jobs[0]?.url).toBe('https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer')
  })

  it('uses the guid as url when the link element is missing', () => {
    const { ctx } = makeCtx()
    const item = CDATA_ITEM.replace(
      '<link>https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer</link>',
      '',
    )
    const [job] = wwrProvider.parse({ kind: 'rss', body: feedOf(item) }, ctx)
    expect(job?.url).toBe('https://weworkremotely.com/remote-jobs/acme-labs-rust-engineer')
  })

  it('nulls the description when the element is missing or blank', () => {
    const { ctx } = makeCtx()
    const blank = CDATA_ITEM.replace(
      '<description><![CDATA[<p>Build <strong>fast</strong> things &amp; ship.</p>]]></description>',
      '<description>  </description>',
    )
    const [job] = wwrProvider.parse({ kind: 'rss', body: feedOf(blank) }, ctx)
    expect(job?.descriptionHtml).toBeNull()
    const missing = CDATA_ITEM.replace(
      '<description><![CDATA[<p>Build <strong>fast</strong> things &amp; ship.</p>]]></description>',
      '',
    )
    const other = makeCtx().ctx // fresh run — same guid parses again
    const [job2] = wwrProvider.parse({ kind: 'rss', body: feedOf(missing) }, other)
    expect(job2?.descriptionHtml).toBeNull()
  })

  it('tolerates items missing category, type, and pubDate', () => {
    const { ctx } = makeCtx()
    const item = CDATA_ITEM.replace('<category>Programming</category>', '')
      .replace('<type>Full-Time</type>', '')
      .replace('<pubDate>Mon, 20 Jul 2026 08:00:00 +0000</pubDate>', '')
    const [job] = wwrProvider.parse({ kind: 'rss', body: feedOf(item) }, ctx)
    expect(job?.tags).toEqual([])
    expect(job?.postedAt).toBeNull()
  })

  it('returns [] for malformed bodies without throwing', () => {
    const { ctx } = makeCtx()
    expect(wwrProvider.parse({ kind: 'rss', body: 'not xml at all' }, ctx)).toEqual([])
    expect(wwrProvider.parse({ kind: 'rss', body: '' }, ctx)).toEqual([])
    expect(wwrProvider.parse({ kind: 'rss', body: '{"data":[]}' }, ctx)).toEqual([])
    expect(wwrProvider.parse({ kind: 'rss', body: feedOf('') }, ctx)).toEqual([])
    expect(wwrProvider.parse({ kind: 'rss', body: '<item>broken' }, ctx)).toEqual([])
  })
})

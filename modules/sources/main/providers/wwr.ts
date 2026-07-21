import type { NormalizedJob } from '@sources/shared'
import { classifyRemoteScope } from '../classify'
import { buildDedupeKey, cleanText, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// WeWorkRemotely RSS feeds (PLAN.md §4.3, live-verified in
// planning/research/research-jobSources.json). Two feeds per sync: the
// programming category (the profile's core) plus the all-jobs feed — they
// overlap, so ids are deduped across payloads below. Item quirks: title is
// 'Company: Role', the custom <region> element is the only scope signal
// ('Anywhere in the World' is the usable bucket; the rest are mostly US-state
// restrictions), and the HTML description arrives XML-entity-encoded rather
// than CDATA-wrapped. Parsing is a small sync extractor over the XML instead
// of rss-parser: JobSourceProvider.parse is synchronous and rss-parser's
// parseString is not — and six regexes beat an async adapter layer.

const WWR_FEEDS: readonly string[] = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/remote-jobs.rss',
]
const MAX_TAGS = 10

const meta: ProviderMeta = {
  id: 'wwr',
  displayName: 'WeWorkRemotely',
  homepage: 'https://weworkremotely.com',
  enabledByDefault: true,
  attribution: { label: 'We Work Remotely', required: false },
  politeness: { minIntervalMinutes: 120, maxRequestsPerSync: 2 },
}

const ITEM_BLOCK_RE = /<item>([\s\S]*?)<\/item>/g
const CDATA_RE = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/

// Decode exactly the XML-entity layer (WWR entity-encodes the HTML description
// instead of CDATA-wrapping it). &amp; goes last so double-encoded text stays
// single-encoded instead of collapsing to raw markup.
function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// Text content of one child element within an <item> block: CDATA inner text
// verbatim, plain content entity-decoded. WWR's elements are attribute-free
// (<guid>, not <guid isPermaLink=…>) — verified against the live capture.
function readTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block)
  if (match === null) return null
  const inner = match[1] ?? ''
  const cdata = CDATA_RE.exec(inner)
  return cdata === null ? decodeXmlEntities(inner) : (cdata[1] ?? '')
}

// The programming feed is a subset of the all-jobs feed, but parse() runs once
// per payload — so the seen-set is keyed on the per-sync FetchContext: the
// same ctx (one sync run) dedupes across both feeds, the next sync starts
// clean, and the WeakMap never outlives a run.
const seenByRun = new WeakMap<FetchContext, Set<string>>()

export const wwrProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    // Remote board: skip the requests entirely when the profile asks for no
    // remote scope (parse would drop every item anyway).
    if (ctx.searchProfile.remoteScopes.length === 0) return []
    const payloads: RawPayload[] = []
    for (const feed of WWR_FEEDS) {
      const body = await ctx.http.getText(feed)
      payloads.push({ kind: 'rss', body })
    }
    return payloads
  },

  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[] {
    const seen = seenByRun.get(ctx) ?? new Set<string>()
    seenByRun.set(ctx, seen)
    const jobs: NormalizedJob[] = []
    for (const match of raw.body.matchAll(ITEM_BLOCK_RE)) {
      const block = match[1] ?? ''
      const fullTitle = cleanText(readTag(block, 'title') ?? '')
      if (fullTitle === '') continue // unusable
      const guid = readTag(block, 'guid')?.trim() ?? ''
      const link = readTag(block, 'link')?.trim() ?? ''
      const sourceKey = guid !== '' ? guid : link
      if (sourceKey === '') continue // no guid, no link → unlinkable
      // The only scope signal is <region>; an unmappable region (US states,
      // provinces, …) is not provably open to Germany → skip. Then the search
      // profile narrows the kept scopes.
      const region = readTag(block, 'region')
      const remoteScope = classifyRemoteScope(region)
      if (remoteScope === null) continue
      if (!ctx.searchProfile.remoteScopes.includes(remoteScope)) continue
      const id = `wwr:${sourceKey}`
      if (seen.has(id)) continue // dedupe by id across the two feed payloads
      seen.add(id)
      // Title format 'Company: Role', split on the first ': ' (roles may
      // contain further colons). A separator-less title keeps the job with an
      // unknown company rather than losing it.
      const separator = fullTitle.indexOf(': ')
      const company = separator === -1 ? '' : fullTitle.slice(0, separator)
      const title = separator === -1 ? fullTitle : fullTitle.slice(separator + 2)
      const description = readTag(block, 'description') ?? ''
      jobs.push({
        id,
        sourceId: 'wwr',
        url: link !== '' ? link : guid, // guid doubles as the permalink
        applyUrl: null, // the feed exposes a single link — no separate apply URL
        title,
        company,
        locationRaw: cleanText(region ?? ''),
        city: null,
        country: null,
        workMode: 'remote', // WWR lists remote jobs exclusively
        remoteScope,
        // Salary is essentially never structured on WWR (research: 1 of 16
        // sampled items, and only inside the description text) — all-null.
        salary: {
          min: null,
          max: null,
          currency: null,
          period: null,
          isEstimated: false,
          raw: null,
        },
        postedAt: toIsoOrNull(readTag(block, 'pubDate')), // RFC 822
        descriptionHtml: description.trim() === '' ? null : description,
        tags: [readTag(block, 'category') ?? '', readTag(block, 'type') ?? '']
          .map(cleanText)
          .filter((tag) => tag !== '')
          .slice(0, MAX_TAGS),
        dedupeKey: buildDedupeKey(company, title, null),
      })
    }
    return jobs
  },
}

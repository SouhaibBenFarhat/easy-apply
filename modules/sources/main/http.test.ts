// @vitest-environment node
import { HttpError, PoliteHttpClient, type PoliteHttpClientOptions } from './http'

// Injected fakes: fetchImpl serves queued results, sleepImpl records the ms it
// was asked to wait instead of waiting — no fake timers needed anywhere.

interface RecordedCall {
  url: string
  init: RequestInit | undefined
}

interface Harness {
  calls: RecordedCall[]
  sleeps: number[]
  client: PoliteHttpClient
}

function makeHarness(
  results: Array<(() => Response) | Error>,
  overrides: PoliteHttpClientOptions = {},
): Harness {
  const calls: RecordedCall[] = []
  const sleeps: number[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    const next = results.shift()
    if (next === undefined) throw new Error('fake fetch exhausted')
    if (next instanceof Error) throw next
    return next()
  }) as typeof fetch
  const sleepImpl = (ms: number): Promise<void> => {
    sleeps.push(ms)
    return Promise.resolve()
  }
  const client = new PoliteHttpClient({
    fetchImpl,
    sleepImpl,
    minRequestGapMs: 0, // gap behaviour has its own dedicated test below
    ...overrides,
  })
  return { calls, sleeps, client }
}

const URL_ = 'https://example.com/api'

const ok = (body: string): (() => Response) => {
  return () => new Response(body, { status: 200 })
}
const status = (code: number): (() => Response) => {
  return () => new Response('error body', { status: code })
}

describe('PoliteHttpClient', () => {
  it('getJson returns the parsed body on success', async () => {
    const { client, calls } = makeHarness([ok('{"jobs":[1,2]}')])
    await expect(client.getJson<{ jobs: number[] }>(URL_)).resolves.toEqual({ jobs: [1, 2] })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(URL_)
  })

  it('getText returns the raw body on success', async () => {
    const { client } = makeHarness([ok('<rss>feed</rss>')])
    await expect(client.getText(URL_)).resolves.toBe('<rss>feed</rss>')
  })

  it('sends a Chrome-like User-Agent and an Accept header by default', async () => {
    const { client, calls } = makeHarness([ok('{}')])
    await client.getJson(URL_)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('user-agent')).toMatch(/Chrome/)
    expect(headers.get('accept')).toBe('application/json')
  })

  it('lets per-request headers extend and override the defaults', async () => {
    const { client, calls } = makeHarness([ok('{}')], { userAgent: 'EasyApply/1.0' })
    await client.getJson(URL_, { headers: { 'X-API-Key': 'jobboerse-jobsuche' } })
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('user-agent')).toBe('EasyApply/1.0')
    expect(headers.get('x-api-key')).toBe('jobboerse-jobsuche')
  })

  it('passes an abort signal for the timeout to fetchImpl', async () => {
    const { client, calls } = makeHarness([ok('{}')], { timeoutMs: 5000 })
    await client.getJson(URL_)
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries a 500 with backoff, then succeeds', async () => {
    const { client, calls, sleeps } = makeHarness([status(500), ok('"recovered"')])
    await expect(client.getJson(URL_)).resolves.toBe('recovered')
    expect(calls).toHaveLength(2)
    expect(sleeps).toEqual([500]) // 500ms * 2^0
  })

  it('retries a 429 (rate limited) the same way', async () => {
    const { client, sleeps } = makeHarness([status(429), ok('"ok"')])
    await expect(client.getJson(URL_)).resolves.toBe('ok')
    expect(sleeps).toEqual([500])
  })

  it('gives up after maxRetries with an HttpError carrying status and url', async () => {
    const { client, calls, sleeps } = makeHarness([status(500), status(502), status(503)], {
      maxRetries: 2,
    })
    const error: unknown = await client.getJson(URL_).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(HttpError)
    if (!(error instanceof HttpError)) return
    expect(error.status).toBe(503)
    expect(error.url).toBe(URL_)
    expect(error.message).toContain('503')
    expect(calls).toHaveLength(3) // initial + 2 retries
    expect(sleeps).toEqual([500, 1000]) // exponential backoff
  })

  it('fails a 404 immediately without retrying (4xx except 429 are permanent)', async () => {
    const { client, calls, sleeps } = makeHarness([status(404)])
    const error: unknown = await client.getText(URL_).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(HttpError)
    if (!(error instanceof HttpError)) return
    expect(error.status).toBe(404)
    expect(calls).toHaveLength(1)
    expect(sleeps).toEqual([])
  })

  it('retries network errors, then succeeds', async () => {
    const { client, sleeps } = makeHarness([new TypeError('fetch failed'), ok('"back"')])
    await expect(client.getJson(URL_)).resolves.toBe('back')
    expect(sleeps).toEqual([500])
  })

  it('wraps a final network failure in an HttpError with null status', async () => {
    const { client } = makeHarness([new TypeError('fetch failed')], { maxRetries: 0 })
    const error: unknown = await client.getJson(URL_).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(HttpError)
    if (!(error instanceof HttpError)) return
    expect(error.status).toBeNull()
    expect(error.message).toContain('fetch failed')
    expect(error.url).toBe(URL_)
  })

  it('wraps non-Error rejection reasons too', async () => {
    const fetchImpl = (() => Promise.reject('boom')) as unknown as typeof fetch
    const client = new PoliteHttpClient({
      fetchImpl,
      sleepImpl: () => Promise.resolve(),
      maxRetries: 0,
      minRequestGapMs: 0,
    })
    const error: unknown = await client.getText(URL_).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(HttpError)
    if (!(error instanceof HttpError)) return
    expect(error.status).toBeNull()
    expect(error.message).toContain('boom')
  })

  it('sleeps to keep the minimum gap between two rapid requests', async () => {
    const { client, sleeps } = makeHarness([ok('{}'), ok('{}')], { minRequestGapMs: 1000 })
    await client.getJson(URL_) // first request: no gap to respect yet
    await client.getJson(URL_) // immediate second request: must wait
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]).toBeGreaterThan(0)
    expect(sleeps[0]).toBeLessThanOrEqual(1000)
  })

  it('uses a real timer sleep by default', async () => {
    let served = 0
    const fetchImpl = (async () => {
      served += 1
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const client = new PoliteHttpClient({ fetchImpl, minRequestGapMs: 2 })
    await client.getJson(URL_)
    await client.getJson(URL_) // waits ~2ms through the default sleep
    expect(served).toBe(2)
  })
})

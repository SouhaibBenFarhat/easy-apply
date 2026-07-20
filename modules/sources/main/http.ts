// Polite HTTP client for all provider fetching (PLAN.md §2 politeness rules,
// §4.3). Browser-like User-Agent by default (RemoteOK/WWR historically 403'd
// non-browser UAs — kept defensively), request spacing, timeout, retry with
// exponential backoff. Node 22's global fetch IS undici — no explicit import.

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_MIN_REQUEST_GAP_MS = 1_000
const BACKOFF_BASE_MS = 500

const JSON_ACCEPT = 'application/json'
const TEXT_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

export interface PoliteHttpClientOptions {
  userAgent?: string
  timeoutMs?: number
  maxRetries?: number
  minRequestGapMs?: number
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
}

export interface HttpRequestInit {
  headers?: Record<string, string>
}

export class HttpError extends Error {
  readonly status: number | null // null = network-level failure (no response)
  readonly url: string

  constructor(message: string, url: string, status: number | null) {
    super(message)
    this.name = 'HttpError'
    this.url = url
    this.status = status
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class PoliteHttpClient {
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly minRequestGapMs: number
  private readonly fetchImpl: typeof fetch
  private readonly sleepImpl: (ms: number) => Promise<void>
  private nextRequestAt: number = 0

  constructor(options: PoliteHttpClientOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.minRequestGapMs = options.minRequestGapMs ?? DEFAULT_MIN_REQUEST_GAP_MS
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.sleepImpl = options.sleepImpl ?? defaultSleep
  }

  async getText(url: string, init?: HttpRequestInit): Promise<string> {
    const response = await this.request(url, TEXT_ACCEPT, init)
    return response.text()
  }

  async getJson<T = unknown>(url: string, init?: HttpRequestInit): Promise<T> {
    const response = await this.request(url, JSON_ACCEPT, init)
    return (await response.json()) as T
  }

  private buildHeaders(accept: string, init?: HttpRequestInit): Headers {
    const headers = new Headers({ accept, 'user-agent': this.userAgent })
    for (const [name, value] of Object.entries(init?.headers ?? {})) headers.set(name, value)
    return headers
  }

  // Politeness spacing: a minimum gap between consecutive requests through
  // this client instance — applied per attempt, so retries stay spaced too.
  private async waitForGap(): Promise<void> {
    const wait = this.nextRequestAt - Date.now()
    if (wait > 0) await this.sleepImpl(wait)
    this.nextRequestAt = Date.now() + this.minRequestGapMs
  }

  private backoff(attempt: number): Promise<void> {
    return this.sleepImpl(BACKOFF_BASE_MS * 2 ** attempt)
  }

  private async request(url: string, accept: string, init?: HttpRequestInit): Promise<Response> {
    const headers = this.buildHeaders(accept, init)
    for (let attempt = 0; ; attempt++) {
      await this.waitForGap()
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        })
      } catch (error) {
        // Network / timeout failures are transient — retry with backoff.
        if (attempt < this.maxRetries) {
          await this.backoff(attempt)
          continue
        }
        const reason = error instanceof Error ? error.message : String(error)
        throw new HttpError(`Network failure for ${url}: ${reason}`, url, null)
      }
      if (response.ok) return response
      // 429 and 5xx are transient; every other 4xx is permanent — fail fast.
      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < this.maxRetries) {
        await this.backoff(attempt)
        continue
      }
      throw new HttpError(`HTTP ${response.status} for ${url}`, url, response.status)
    }
  }
}

// @sources/main — main-process source cores (tsconfig.node.json only).
// Providers (PRs 6–8) and the sync engine (PR 9) build on these.

export { type ClassificationInput, classifyRemoteScope, classifyWorkMode } from './classify'
export {
  HttpError,
  type HttpRequestInit,
  PoliteHttpClient,
  type PoliteHttpClientOptions,
} from './http'
export { buildDedupeKey, cleanText, stripHtml, toIsoOrNull } from './normalize'
export { getProvider, listProviderMeta, PROVIDERS } from './registry'
export type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from './types'

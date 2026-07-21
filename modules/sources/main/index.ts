// @sources/main — main-process source cores (tsconfig.node.json only).
// Providers (PRs 6–8) and the sync engine (PR 9) build on these.

export { type ClassificationInput, classifyRemoteScope, classifyWorkMode } from './classify'
export {
  runSync,
  type SyncDeps,
  type SyncEvent,
  type SyncSummary,
  summarizeNewJobs,
} from './engine'
export {
  HttpError,
  type HttpRequestInit,
  PoliteHttpClient,
  type PoliteHttpClientOptions,
} from './http'
export {
  type MailAccount,
  type MailDriver,
  type MailMessage,
  type MailSearchQuery,
  type ReadAlertOptions,
  readAlertMessages,
} from './mail'
export {
  buildExtractionPrompt,
  extractJobsFromEmail,
  type LlmClient,
} from './mail-extract'
export {
  addAccount,
  listAccountEmails,
  type MailboxAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
} from './mailbox-accounts'
export { buildDedupeKey, cleanText, stripHtml, toIsoOrNull } from './normalize'
export { decodeProviderConfig, encodeProviderConfig } from './provider-config-codec'
export { getProvider, listProviderMeta, PROVIDERS } from './registry'
export type {
  AgentTraceInput,
  FetchContext,
  JobSourceProvider,
  ProviderMeta,
  RawPayload,
  TraceFn,
} from './types'

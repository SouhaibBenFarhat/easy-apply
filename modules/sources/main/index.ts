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
  type MailEnvelope,
  type MailFetchRequest,
  type MailMessage,
  type MailSearchQuery,
  type ReadRecentOptions,
  readMessages,
  readRecentEnvelopes,
} from './mail'
export {
  buildExtractionPrompt,
  type ExtractionResult,
  extractJobsFromEmail,
  type LlmClient,
  type LlmCompleteOptions,
} from './mail-extract'
export {
  addAccount,
  listAccountEmails,
  type MailboxAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
} from './mailbox-accounts'
export {
  buildDedupeKey,
  cleanText,
  stripHtml,
  stripHtmlKeepingLinks,
  toIsoOrNull,
} from './normalize'
export { decodeProviderConfig, encodeProviderConfig } from './provider-config-codec'
export { getProvider, listProviderMeta, PROVIDERS } from './registry'
export { type SplitThinking, splitThinking } from './thinking'
export type {
  AgentPipelineStats,
  AgentTraceInput,
  AgentTraceJob,
  FetchContext,
  JobSourceProvider,
  ProcessedMessages,
  ProviderMeta,
  RawPayload,
  TraceFn,
} from './types'

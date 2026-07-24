import type { SourceId } from '@sources/shared'
import { arbeitnowProvider } from './providers/arbeitnow'
import { baProvider } from './providers/ba'
import { himalayasProvider } from './providers/himalayas'
import { mailboxProvider } from './providers/mailbox'
import { remoteokProvider } from './providers/remoteok'
import { wwrProvider } from './providers/wwr'
import type { JobSourceProvider, ProviderMeta } from './types'

// The provider registry. Adding a source touches exactly: its provider file,
// its schema, this array, one fixture, one test (PLAN.md §4.3). The German
// anchors (BA, Arbeitnow), the remote boards (Himalayas, RemoteOK, WWR), and the
// on-device inbox agent (mailbox).
export const PROVIDERS: readonly JobSourceProvider[] = [
  baProvider,
  arbeitnowProvider,
  himalayasProvider,
  remoteokProvider,
  wwrProvider,
  mailboxProvider,
]

export function getProvider(id: SourceId): JobSourceProvider | undefined {
  for (const provider of PROVIDERS) if (provider.meta.id === id) return provider
  return undefined
}

export function listProviderMeta(): ProviderMeta[] {
  const meta: ProviderMeta[] = []
  for (const provider of PROVIDERS) meta.push(provider.meta)
  return meta
}

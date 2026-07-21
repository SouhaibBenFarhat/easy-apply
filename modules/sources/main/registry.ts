import type { SourceId } from '@sources/shared'
import { adzunaProvider } from './providers/adzuna'
import { arbeitnowProvider } from './providers/arbeitnow'
import { baProvider } from './providers/ba'
import { himalayasProvider } from './providers/himalayas'
import { remoteokProvider } from './providers/remoteok'
import { wwrProvider } from './providers/wwr'
import type { JobSourceProvider, ProviderMeta } from './types'

// The provider registry. Adding a source touches exactly: its provider file,
// its schema, this array, one fixture, one test (PLAN.md §4.3). PR 6 landed the
// German anchors (BA, Arbeitnow), PR 7 the remote boards (Himalayas, RemoteOK,
// WWR), PR 8 Adzuna (the keyed Munich salary source).
export const PROVIDERS: readonly JobSourceProvider[] = [
  baProvider,
  arbeitnowProvider,
  himalayasProvider,
  remoteokProvider,
  wwrProvider,
  adzunaProvider,
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

import type { SourceId } from '@sources/shared'
import type { JobSourceProvider, ProviderMeta } from './types'

// The provider registry. Adding a source touches exactly: its provider file,
// its schema, this array, one fixture, one test (PLAN.md §4.3). Filled by
// PRs 6–8 (BA, Adzuna, Arbeitnow, Himalayas, RemoteOK, WWR).
export const PROVIDERS: readonly JobSourceProvider[] = []

export function getProvider(id: SourceId): JobSourceProvider | undefined {
  for (const provider of PROVIDERS) if (provider.meta.id === id) return provider
  return undefined
}

export function listProviderMeta(): ProviderMeta[] {
  const meta: ProviderMeta[] = []
  for (const provider of PROVIDERS) meta.push(provider.meta)
  return meta
}

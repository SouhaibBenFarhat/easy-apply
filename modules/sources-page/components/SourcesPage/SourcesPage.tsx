import type { SourceId, SourceInfo, SyncRun } from '@data'
import {
  useAddMailboxAccount,
  useAppSettings,
  useClearSourceKey,
  useMailboxAccounts,
  useRemoveMailboxAccount,
  useSetAppSettings,
  useSetSourceEnabled,
  useSetSourceKey,
  useSources,
  useSyncStatus,
} from '@data'
import { Button, EmptyState, ScrollArea, useDeferredLoading, useToast } from '@ui-kit'
import { Unplug } from 'lucide-react'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { MailboxCard } from '../MailboxCard'
import { MailFilterCard } from '../MailFilterCard'
import { SourceCard } from '../SourceCard'
import { SourcesSkeleton } from './SourcesSkeleton'

// The sources orchestrator — the only sources-page component that touches
// @data. Cards stay presentational; every mutation (and its toast) lives here.
export function SourcesPage(): ReactElement {
  const sources = useSources()
  const syncStatus = useSyncStatus()
  const setEnabled = useSetSourceEnabled()
  const setKey = useSetSourceKey()
  const clearKey = useClearSourceKey()
  const mailboxAccounts = useMailboxAccounts()
  const addMailboxAccount = useAddMailboxAccount()
  const removeMailboxAccount = useRemoveMailboxAccount()
  const settings = useAppSettings()
  const setSettings = useSetAppSettings()
  const { toast } = useToast()
  const loading = useDeferredLoading(sources.isPending)

  // recentRuns arrive newest-first (listRecentSyncRuns orders by started_at
  // desc, id desc), so the first run seen per source is its latest.
  const lastRuns = useMemo(() => {
    const bySource = new Map<SourceId, SyncRun>()
    for (const run of syncStatus.data?.recentRuns ?? []) {
      if (!bySource.has(run.sourceId)) bySource.set(run.sourceId, run)
    }
    return bySource
  }, [syncStatus.data])

  const saveKey = (source: SourceInfo, values: Record<string, string>): void => {
    setKey.mutate(
      { sourceId: source.sourceId, values },
      {
        onSuccess: (info) => {
          // Saving a key implies intent to use the source, so the main
          // process enables it in the same step — confirm both effects.
          toast({ title: `Key saved — ${info.displayName} enabled` })
        },
        onError: (error) => {
          toast({ title: 'Could not save key', description: error.message, variant: 'destructive' })
        },
      },
    )
  }

  const addAccount = (values: Record<string, string>): void => {
    addMailboxAccount.mutate(
      { email: values.email ?? '', appPassword: values.app_password ?? '' },
      {
        onSuccess: () => toast({ title: 'Inbox connected' }),
        onError: (error) => {
          toast({
            title: 'Could not connect inbox',
            description: error.message,
            variant: 'destructive',
          })
        },
      },
    )
  }

  const removeAccount = (email: string): void => {
    removeMailboxAccount.mutate(email, {
      onError: (error) => {
        toast({
          title: 'Could not remove inbox',
          description: error.message,
          variant: 'destructive',
        })
      },
    })
  }

  if (sources.isError) {
    return (
      <EmptyState
        // EmptyState owns its description styling; the arbitrary variant
        // tints just that paragraph destructive for this error surface.
        className="h-full [&>p]:text-destructive"
        icon={<Unplug className="size-5" />}
        title="Could not load sources"
        description={sources.error.message}
        action={
          <Button variant="outline" onClick={() => void sources.refetch()}>
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {sources.data === undefined ? (
          // Anti-flash: sub-150ms loads render nothing rather than a blink.
          loading === 'skeleton' ? (
            <SourcesSkeleton />
          ) : null
        ) : (
          <>
            <p className="text-sm text-foreground-muted">
              Sources sync sequentially and respect each provider's rate limits.
            </p>
            {sources.data.map((source) =>
              source.sourceId === 'mailbox' ? (
                <MailboxCard
                  key={source.sourceId}
                  source={source}
                  accounts={mailboxAccounts.data ?? []}
                  onToggle={(enabled) => setEnabled.mutate({ sourceId: source.sourceId, enabled })}
                  onAddAccount={addAccount}
                  onRemoveAccount={removeAccount}
                />
              ) : (
                <SourceCard
                  key={source.sourceId}
                  source={source}
                  lastRun={lastRuns.get(source.sourceId) ?? null}
                  onToggle={(enabled) => setEnabled.mutate({ sourceId: source.sourceId, enabled })}
                  onSaveKey={(values) => saveKey(source, values)}
                  onClearKey={() => clearKey.mutate({ sourceId: source.sourceId })}
                />
              ),
            )}
            {settings.data !== undefined ? (
              <MailFilterCard
                config={settings.data.mailScan}
                onChange={(next) => setSettings.mutate({ mailScan: next })}
              />
            ) : null}
          </>
        )}
      </div>
    </ScrollArea>
  )
}

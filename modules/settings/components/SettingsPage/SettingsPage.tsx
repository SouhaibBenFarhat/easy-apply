import type { AppSettings } from '@data'
import { useAppSettings, useSetAppSettings } from '@data'
import { ScrollArea, useDeferredLoading, useToast } from '@ui-kit'
import type { ReactElement } from 'react'
import { AppearanceCard } from './AppearanceCard'
import { SearchProfileCard } from './SearchProfileCard'
import { SettingsSkeleton } from './SettingsSkeleton'
import { SyncCard } from './SyncCard'

export function SettingsPage(): ReactElement {
  const settings = useAppSettings()
  const setSettings = useSetAppSettings()
  const { toast } = useToast()
  const loading = useDeferredLoading(settings.isPending)

  // One mutation for both cards: profile saves via the Save button, the sync
  // interval saves immediately on change.
  const save = (update: Partial<AppSettings>): void => {
    setSettings.mutate(update, {
      onSuccess: () => {
        toast({ title: 'Settings saved' })
      },
      onError: (error) => {
        toast({
          title: 'Could not save settings',
          description: error.message,
          variant: 'destructive',
        })
      },
    })
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        {settings.data === undefined ? (
          loading === 'skeleton' ? (
            <SettingsSkeleton />
          ) : null
        ) : (
          <>
            <AppearanceCard />
            <SearchProfileCard
              profile={settings.data.searchProfile}
              saving={setSettings.isPending}
              onSave={(profile) => save({ searchProfile: profile })}
            />
            <SyncCard
              intervalHours={settings.data.syncIntervalHours}
              onChange={(hours) => save({ syncIntervalHours: hours })}
            />
          </>
        )}
      </div>
    </ScrollArea>
  )
}

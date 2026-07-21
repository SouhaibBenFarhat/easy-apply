import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { AppSettings } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useAppSettings(): UseQueryResult<AppSettings, Error> {
  return useQuery({
    queryKey: keys.settings.app,
    queryFn: async () => unwrap(await window.electron.settings.get()),
  })
}

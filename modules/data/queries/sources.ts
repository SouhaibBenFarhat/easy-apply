import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { SourceInfo } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export function useSources(): UseQueryResult<SourceInfo[], Error> {
  return useQuery({
    queryKey: keys.sources.list,
    queryFn: async () => unwrap(await window.electron.sources.list()),
  })
}

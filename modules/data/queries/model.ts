import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ModelStatus } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

// The local-LLM model state (absent / downloading / ready / error). Live
// download progress is pushed into this cache by useModelProgress.
export function useModelStatus(): UseQueryResult<ModelStatus, Error> {
  return useQuery({
    queryKey: keys.model.status,
    queryFn: async () => unwrap(await window.electron.model.status()),
  })
}

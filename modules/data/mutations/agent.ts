import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { unwrap } from '../ipc'

// Interrupts the running agent pass (the email scan). Resolves true if a run was
// actually aborted; the funnel/trace update through the agent:trace stream.
export function useStopAgent(): UseMutationResult<boolean, Error, void> {
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.agent.stop()),
  })
}

// Holds the running scan between emails; the funnel reflects it via the paused
// flag on the next pipeline event.
export function usePauseAgent(): UseMutationResult<boolean, Error, void> {
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.agent.pause()),
  })
}

// Resumes a paused scan from exactly where it held.
export function useResumeAgent(): UseMutationResult<boolean, Error, void> {
  return useMutation({
    mutationFn: async () => unwrap(await window.electron.agent.resume()),
  })
}

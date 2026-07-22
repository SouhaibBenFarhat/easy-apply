import { act, renderHook, waitFor } from '@test-utils'
import { usePauseAgent, useResumeAgent, useStopAgent } from './agent'

describe('agent run controls', () => {
  it('stops the running agent over IPC', async () => {
    const stop = vi.spyOn(window.electron.agent, 'stop')
    const { result } = renderHook(() => useStopAgent())

    act(() => {
      result.current.mutate()
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(result.current.data).toBe(false) // mock: nothing was running
  })

  it('pauses and resumes over IPC', async () => {
    const pause = vi.spyOn(window.electron.agent, 'pause')
    const resume = vi.spyOn(window.electron.agent, 'resume')
    const { result } = renderHook(() => ({ pause: usePauseAgent(), resume: useResumeAgent() }))

    act(() => {
      result.current.pause.mutate()
    })
    await waitFor(() => expect(result.current.pause.isSuccess).toBe(true))

    act(() => {
      result.current.resume.mutate()
    })
    await waitFor(() => expect(result.current.resume.isSuccess).toBe(true))

    expect(pause).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledTimes(1)
  })
})

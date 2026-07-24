import type { AgentTraceEvent, TraceStatus } from '@data'
import { render, screen } from '@test-utils'
import { TraceDot, TraceLegend, traceDotState } from './TraceDot'

function ev(label: string, status?: TraceStatus): AgentTraceEvent {
  return { seq: 0, at: '2026-07-21T09:00:00.000Z', channel: 'mailbox', label, status }
}

describe('traceDotState', () => {
  // The newest row of a running pass is in progress, whatever it says.
  it('is in-progress for the active row', () => {
    expect(traceDotState(ev('Analyzing "x"'), true)).toBe('in-progress')
    // Active wins even over a stated outcome.
    expect(traceDotState(ev('Inbox read failed', 'failed'), true)).toBe('in-progress')
  })

  // Otherwise the dot is the outcome the emitter STATED — never guessed from
  // the label. "0 skipped" in a done row must stay done.
  it('uses the stated status for a settled row', () => {
    expect(traceDotState(ev('Triage kept 70 of 70 — 0 skipped'), false)).toBe('done')
    expect(traceDotState(ev('Inbox read failed — a@b.com', 'failed'), false)).toBe('failed')
    expect(traceDotState(ev('Skipped — model not installed', 'skipped'), false)).toBe('skipped')
  })

  it('defaults an unstated status to done', () => {
    expect(traceDotState(ev('Found 313 email(s)'), false)).toBe('done')
  })
})

describe('TraceDot', () => {
  const dot = (container: HTMLElement): Element | null => container.querySelector('span > span')

  it('spins only while that checkpoint is the one being worked on', () => {
    const { rerender } = render(<TraceDot event={ev('Prompt')} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<TraceDot event={ev('Prompt')} active />)
    expect(screen.getByRole('status', { name: 'Running' })).toBeInTheDocument()
  })

  it.each([
    ['done', undefined, 'bg-success'],
    ['failed', 'failed', 'bg-destructive'],
    ['skipped', 'skipped', 'bg-foreground-ghost'],
  ] as const)('paints a settled %s row %s', (_name, status, className) => {
    const { container } = render(<TraceDot event={ev('step', status)} />)
    expect(dot(container)?.className).toContain(className)
  })

  it('paints the active row yellow', () => {
    const { container } = render(<TraceDot event={ev('Analyzing "x"')} active />)
    // The inner dot is the LAST span (the spinner ring is a sibling before it).
    const inner = container.querySelectorAll('span > span')
    expect(inner[inner.length - 1]?.className).toContain('bg-warning')
  })
})

describe('TraceLegend', () => {
  it('names every dot state', () => {
    render(<TraceLegend />)
    for (const label of ['in progress', 'done', 'failed', 'skipped']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})

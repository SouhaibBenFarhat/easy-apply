import type { AgentTraceEvent } from '@data'
import { render, screen } from '@test-utils'
import { isCompletedStep, TraceDot, TraceLegend, traceTone } from './TraceDot'

function ev(
  channel: AgentTraceEvent['channel'],
  label: string,
  durationMs?: number,
): AgentTraceEvent {
  return { seq: 0, at: '2026-07-21T09:00:00.000Z', channel, label, durationMs }
}

describe('traceTone', () => {
  // The verdict per email, which the funnel only ever showed as a running
  // total — you could see "3 accepted" without knowing WHICH three.
  it('separates accepted from rejected emails', () => {
    expect(traceTone(ev('pipeline', 'Backend roles · 2 job(s)'))).toBe('accepted')
    expect(traceTone(ev('pipeline', 'Newsletter · no jobs'))).toBe('rejected')
  })

  it('keeps non-verdict pipeline rows neutral', () => {
    expect(traceTone(ev('pipeline', 'Scanning 200 new email(s)'))).toBe('step')
    expect(traceTone(ev('pipeline', 'Paused · 4/200 scanned'))).toBe('step')
  })

  it('marks model work and failures', () => {
    expect(traceTone(ev('llm', 'Prompt · 42 chars'))).toBe('model')
    expect(traceTone(ev('thinking', 'Thinking · 10 chars'))).toBe('model')
    expect(traceTone(ev('mailbox', 'Inbox read failed — a@b.com'))).toBe('failed')
    expect(traceTone(ev('mailbox', 'Skipped — model not installed'))).toBe('failed')
  })

  it('reads a failure verdict ahead of the channel', () => {
    expect(traceTone(ev('pipeline', 'Extraction failed · no jobs'))).toBe('failed')
  })
})

// Colour says what a row is; fill says whether its step finished. Only rows
// that closed a step carry a main-stamped duration.
describe('isCompletedStep', () => {
  it('treats a row with a measured duration as finished', () => {
    expect(isCompletedStep(ev('mailbox', 'Found 313 email(s)', 1_600))).toBe(true)
    expect(isCompletedStep(ev('llm', 'Response · 96 chars', 842))).toBe(true)
  })

  it('treats an opening row as unfinished', () => {
    expect(isCompletedStep(ev('mailbox', 'Connecting to a@b.com…'))).toBe(false)
    expect(isCompletedStep(ev('pipeline', 'Analyzing "Backend roles"'))).toBe(false)
    expect(isCompletedStep(ev('llm', 'Prompt · 42 chars'))).toBe(false)
  })

  // Reasoning is emitted after generation ends; its time rides on the Response
  // row that follows, so it must not read as still-running.
  it('counts a reasoning row as finished despite carrying no duration', () => {
    expect(isCompletedStep(ev('thinking', 'Thinking · 10 chars'))).toBe(true)
  })
})

describe('TraceDot', () => {
  it('spins only while that checkpoint is the one being worked on', () => {
    const { rerender } = render(<TraceDot event={ev('llm', 'Prompt')} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<TraceDot event={ev('llm', 'Prompt')} active />)
    expect(screen.getByRole('status', { name: 'Running' })).toBeInTheDocument()
  })

  // The silent-crash tell: a step that opened and never closed stays hollow,
  // so it can't pass for a completed one.
  it('draws an unfinished step hollow and a finished one solid', () => {
    const { container, rerender } = render(<TraceDot event={ev('pipeline', 'Analyzing "x"')} />)
    const dot = (): Element | null => container.querySelector('span > span')
    expect(dot()?.className).toContain('bg-transparent')

    rerender(<TraceDot event={ev('pipeline', 'x · 2 job(s)', 12_400)} />)
    expect(dot()?.className).toContain('bg-success')
    expect(dot()?.className).not.toContain('bg-transparent')
  })
})

describe('TraceLegend', () => {
  it('names every dot colour and explains the hollow dot', () => {
    render(<TraceLegend />)
    for (const label of ['in progress', 'jobs found', 'no jobs', 'step', 'model', 'failed']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})

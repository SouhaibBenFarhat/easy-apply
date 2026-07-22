import type { AgentTraceEvent } from '@data'
import { render, screen } from '@test-utils'
import { TraceDot, TraceLegend, traceTone } from './TraceDot'

function ev(channel: AgentTraceEvent['channel'], label: string): AgentTraceEvent {
  return { seq: 0, at: '2026-07-21T09:00:00.000Z', channel, label }
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

describe('TraceDot', () => {
  it('spins only while that checkpoint is the one being worked on', () => {
    const { rerender } = render(<TraceDot event={ev('llm', 'Prompt')} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<TraceDot event={ev('llm', 'Prompt')} active />)
    expect(screen.getByRole('status', { name: 'Running' })).toBeInTheDocument()
  })
})

describe('TraceLegend', () => {
  it('names every dot colour', () => {
    render(<TraceLegend />)
    for (const label of ['jobs found', 'no jobs', 'step', 'model', 'failed']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})

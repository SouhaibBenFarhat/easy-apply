// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { splitThinking } from './thinking'

describe('splitThinking', () => {
  it('returns the whole text as the answer when there is no think block', () => {
    expect(splitThinking('[{"title":"Dev"}]')).toEqual({
      thinking: '',
      answer: '[{"title":"Dev"}]',
    })
  })

  it('pulls the reasoning out and leaves clean answer JSON', () => {
    const raw = '<think>Let me scan for postings. I see one role.</think>\n[{"title":"Dev"}]'
    expect(splitThinking(raw)).toEqual({
      thinking: 'Let me scan for postings. I see one role.',
      answer: '[{"title":"Dev"}]',
    })
  })

  it('strips a think block even when it contains brackets', () => {
    const raw = '<think>the array [1,2] looks relevant</think>[{"title":"A"}]'
    expect(splitThinking(raw).answer).toBe('[{"title":"A"}]')
  })

  it('treats an unterminated block as all-thinking with no answer yet', () => {
    expect(splitThinking('<think>still reasoning about the email')).toEqual({
      thinking: 'still reasoning about the email',
      answer: '',
    })
  })

  it('splits on a lone closing tag when the template injected the opener', () => {
    // DeepSeek-R1 templates emit the opening <think> themselves, so the raw
    // output starts with reasoning and only carries </think>.
    expect(splitThinking('Let me look at the postings.</think>[{"title":"Dev"}]')).toEqual({
      thinking: 'Let me look at the postings.',
      answer: '[{"title":"Dev"}]',
    })
  })
})

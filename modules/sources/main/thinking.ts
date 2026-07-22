// Reasoning models (DeepSeek-R1, Qwen3, …) prepend their chain-of-thought in a
// <think>…</think> block before the actual answer. We split it out so the
// activity panel can show the reasoning AND the extractor parses clean output
// (a think block full of prose/brackets would otherwise confuse JSON parsing).

export interface SplitThinking {
  thinking: string // the reasoning block ('' when the model didn't think)
  answer: string // everything else — what the extractor should parse
}

const OPEN = '<think>'
const CLOSE = '</think>'

export function splitThinking(text: string): SplitThinking {
  const open = text.indexOf(OPEN)
  if (open === -1) {
    // Some reasoning templates inject the opening <think> themselves, so the raw
    // output carries only the closing </think>: treat everything before it as
    // reasoning.
    const loneClose = text.indexOf(CLOSE)
    if (loneClose !== -1) {
      return {
        thinking: text.slice(0, loneClose).trim(),
        answer: text.slice(loneClose + CLOSE.length).trim(),
      }
    }
    return { thinking: '', answer: text.trim() }
  }
  const close = text.indexOf(CLOSE, open)
  if (close === -1) {
    // Unterminated block (truncated / still streaming): the whole tail is
    // reasoning and there is no answer yet.
    return { thinking: text.slice(open + OPEN.length).trim(), answer: '' }
  }
  const thinking = text.slice(open + OPEN.length, close).trim()
  const answer = (text.slice(0, open) + text.slice(close + CLOSE.length)).trim()
  return { thinking, answer }
}

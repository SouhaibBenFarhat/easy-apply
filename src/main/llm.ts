import type { LlmClient, LlmCompleteOptions } from '@sources/main'
import {
  getLlama,
  type Llama,
  LlamaChatSession,
  type LlamaContext,
  type LlamaModel,
} from 'node-llama-cpp'

// Real on-device LLM (node-llama-cpp) behind the LlmClient seam. Loads the GGUF
// model lazily on first use and reuses the model AND its context across calls.
// `dispose()` unloads everything to free the RAM (the several GB the user can
// turn off). Electron glue — coverage-excluded and unverifiable in my sandbox
// (needs the model + Metal).

// Memory cap. Left to itself, node-llama-cpp auto-sizes the context (KV cache)
// to whatever RAM is free — grabbing gigabytes. A bounded context keeps runtime
// memory in check WITHOUT touching the weights (so no loss of intelligence,
// just a shorter working window). With mmap'd weights, the 8B model then sits
// around ~6 GB. This bounds the *context*, not the weights — a 14B's weights
// alone exceed 6 GB, so it inherently needs more.
// 8192, not 4096: a 10k-char German digest is ~3.5–4.5k tokens once tracking
// URLs are counted, and 25 extracted jobs can be another 1.5–3k of JSON output
// — which overflowed 4096 and truncated the answer into unparseable JSON.
// Costs ~0.5 GB more KV cache on the 8B (~0.75 GB on the 14B); weights are
// untouched, and it's all freed on dispose().
const CONTEXT_SIZE = 8192

// Generation is strictly serial — one full pass over the weights per token —
// so an unbounded answer is an unbounded stall. Both budgets exist to make the
// worst case finite:
//
// - `maxTokens`: nothing capped the answer, so a model that started repeating
//   itself generated until the context filled.
// - `thoughtTokens`: node-llama-cpp allows a reasoning model 75% of the context
//   for its chain-of-thought by default — 6,144 tokens here. At local speeds
//   that alone is several minutes per email, before a single word of the actual
//   answer. Extraction is transcription, not reasoning; a short budget is
//   plenty, and it applies only to models that think at all.
const DEFAULT_MAX_TOKENS = 1_200
const MAX_THOUGHT_TOKENS = 384

export interface DisposableLlm extends LlmClient {
  dispose(): Promise<void>
}

export function createLlamaClient(modelPath: string): DisposableLlm {
  let loaded: Promise<{ llama: Llama; model: LlamaModel }> | null = null
  // The context (KV cache) is reused across calls: allocating and freeing one
  // per email meant 200 allocations per run, which is pure overhead — and the
  // most expensive kind when the machine is already short on memory.
  let live: { context: LlamaContext; session: LlamaChatSession } | null = null

  const load = (): Promise<{ llama: Llama; model: LlamaModel }> => {
    if (loaded === null) {
      loaded = (async () => {
        const llama = await getLlama()
        // mmap: stream weights from disk (OS pages them in/out) rather than
        // locking them; mlock off so the OS can reclaim pages under pressure.
        const model = await llama.loadModel({ modelPath, useMmap: true, useMlock: false })
        return { llama, model }
      })()
    }
    return loaded
  }

  const getLive = async (): Promise<{ context: LlamaContext; session: LlamaChatSession }> => {
    if (live === null) {
      const { model } = await load()
      const context = await model.createContext({ contextSize: CONTEXT_SIZE })
      live = { context, session: new LlamaChatSession({ contextSequence: context.getSequence() }) }
    }
    return live
  }

  const releaseContext = async (): Promise<void> => {
    const current = live
    live = null
    if (current !== null) await current.context.dispose()
  }

  return {
    complete: async (prompt: string, options?: LlmCompleteOptions): Promise<string> => {
      const { session } = await getLive()
      // Each email is an independent extraction — the previous one must not
      // leak into this one's context.
      session.resetChatHistory()
      try {
        // Reasoning models (DeepSeek-R1, …) emit their chain-of-thought as a
        // separate "thought" segment — node-llama-cpp keeps it OUT of the value
        // prompt() returns. Collect it via onResponseChunk and re-wrap it as a
        // <think>…</think> block so the trace layer's splitThinking() can surface
        // it while the extractor still receives clean JSON.
        // `signal` + stopOnAbortSignal makes Stop halt generation mid-stream
        // (returning whatever was produced) rather than waiting for the email.
        let thought = ''
        const answer = await session.prompt(prompt, {
          signal: options?.signal,
          stopOnAbortSignal: true,
          maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
          budgets: { thoughtTokens: MAX_THOUGHT_TOKENS },
          onResponseChunk: (chunk) => {
            if (chunk.type === 'segment' && chunk.segmentType === 'thought') thought += chunk.text
          },
        })
        const trimmed = thought.trim()
        return trimmed === '' ? answer : `<think>${trimmed}</think>${answer}`
      } catch (error) {
        // An aborted or failed generation can leave the sequence mid-state.
        // Drop the context so the next call starts from a clean one rather than
        // wedging every remaining email in the run.
        await releaseContext()
        throw error
      }
    },
    dispose: async (): Promise<void> => {
      await releaseContext()
      if (loaded === null) return
      const { model } = await loaded
      await model.dispose() // frees the model weights held in RAM
      loaded = null
    },
  }
}

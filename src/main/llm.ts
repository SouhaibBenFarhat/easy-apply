import type { LlmClient } from '@sources/main'
import { getLlama, type Llama, LlamaChatSession, type LlamaModel } from 'node-llama-cpp'

// Real on-device LLM (node-llama-cpp) behind the LlmClient seam. Loads the GGUF
// model lazily on first use and reuses it across calls; a fresh context per
// prompt keeps extractions independent. `dispose()` unloads the model to free
// its RAM (the several GB the user can turn off). Electron glue —
// coverage-excluded and unverifiable in my sandbox (needs the model + Metal).

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

export interface DisposableLlm extends LlmClient {
  dispose(): Promise<void>
}

export function createLlamaClient(modelPath: string): DisposableLlm {
  let loaded: Promise<{ llama: Llama; model: LlamaModel }> | null = null

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

  return {
    complete: async (prompt: string, options?: { signal?: AbortSignal }): Promise<string> => {
      const { model } = await load()
      const context = await model.createContext({ contextSize: CONTEXT_SIZE })
      try {
        const session = new LlamaChatSession({ contextSequence: context.getSequence() })
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
          onResponseChunk: (chunk) => {
            if (chunk.type === 'segment' && chunk.segmentType === 'thought') thought += chunk.text
          },
        })
        const trimmed = thought.trim()
        return trimmed === '' ? answer : `<think>${trimmed}</think>${answer}`
      } finally {
        await context.dispose()
      }
    },
    dispose: async (): Promise<void> => {
      if (loaded === null) return
      const { model } = await loaded
      await model.dispose() // frees the model weights held in RAM
      loaded = null
    },
  }
}

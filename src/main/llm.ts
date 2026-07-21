import type { LlmClient } from '@sources/main'
import { getLlama, type Llama, LlamaChatSession, type LlamaModel } from 'node-llama-cpp'

// Real on-device LLM (node-llama-cpp) behind the LlmClient seam. Loads the GGUF
// model lazily on first use and reuses it across calls; a fresh context per
// prompt keeps extractions independent. `dispose()` unloads the model to free
// its RAM (the several GB the user can turn off). Electron glue —
// coverage-excluded and unverifiable in my sandbox (needs the model + Metal).

export interface DisposableLlm extends LlmClient {
  dispose(): Promise<void>
}

export function createLlamaClient(modelPath: string): DisposableLlm {
  let loaded: Promise<{ llama: Llama; model: LlamaModel }> | null = null

  const load = (): Promise<{ llama: Llama; model: LlamaModel }> => {
    if (loaded === null) {
      loaded = (async () => {
        const llama = await getLlama()
        const model = await llama.loadModel({ modelPath })
        return { llama, model }
      })()
    }
    return loaded
  }

  return {
    complete: async (prompt: string): Promise<string> => {
      const { model } = await load()
      const context = await model.createContext()
      try {
        const session = new LlamaChatSession({ contextSequence: context.getSequence() })
        return await session.prompt(prompt)
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

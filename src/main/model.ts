import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger } from '@logger/main'
import { app } from 'electron'
import type { DisposableLlm } from './llm'

// Local LLM model manager (Phase 1 of the on-device agentic route). Resolves
// the model file in userData, reports whether it's present, and downloads it
// with live progress. The model runs fully on-device later (Phase 2,
// node-llama-cpp); nothing here reaches the network except the one-time model
// fetch. Electron glue — coverage-excluded like all of src/main; the renderer
// data/UI that drives it IS covered.

export interface ModelInfo {
  id: string
  displayName: string
  url: string
  sizeBytes: number
  filename: string
}

// Llama 3.1 8B Instruct, GGUF Q4_K_M (~4.9 GB) — the reliable-enough local
// model for job-email extraction. Verify url/size against the live file on the
// first real download.
export const DEFAULT_MODEL: ModelInfo = {
  id: 'llama-3.1-8b-instruct-q4',
  displayName: 'Llama 3.1 8B Instruct (Q4)',
  url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
  sizeBytes: 4_920_000_000,
  filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
}

export type ModelState = 'absent' | 'downloading' | 'ready' | 'error'

export interface ModelStatus {
  state: ModelState
  modelId: string
  displayName: string
  totalBytes: number
  downloadedBytes: number
  error: string | null
  enabled: boolean // when off, the model stays unloaded to free RAM
}

export interface ModelProgress {
  modelId: string
  downloadedBytes: number
  totalBytes: number
}

export class ModelManager {
  private readonly model: ModelInfo
  private readonly logger = createLogger('llm')
  private readonly dir: string
  private controller: AbortController | null = null
  private lastError: string | null = null
  private aiEnabled = true
  private llmHandle: DisposableLlm | null = null

  constructor(model: ModelInfo = DEFAULT_MODEL) {
    this.model = model
    this.dir = join(app.getPath('userData'), 'models')
  }

  private get filePath(): string {
    return join(this.dir, this.model.filename)
  }

  get downloading(): boolean {
    return this.controller !== null
  }

  async getStatus(): Promise<ModelStatus> {
    const base = {
      modelId: this.model.id,
      displayName: this.model.displayName,
      totalBytes: this.model.sizeBytes,
      enabled: this.aiEnabled,
    }
    if (this.controller !== null) {
      return {
        ...base,
        state: 'downloading',
        downloadedBytes: await this.partialBytes(),
        error: null,
      }
    }
    try {
      const info = await stat(this.filePath)
      return {
        ...base,
        state: 'ready',
        totalBytes: info.size,
        downloadedBytes: info.size,
        error: null,
      }
    } catch {
      return {
        ...base,
        state: this.lastError === null ? 'absent' : 'error',
        downloadedBytes: 0,
        error: this.lastError,
      }
    }
  }

  private async partialBytes(): Promise<number> {
    try {
      return (await stat(`${this.filePath}.part`)).size
    } catch {
      return 0
    }
  }

  cancel(): void {
    this.controller?.abort()
  }

  // Delete the installed model (and any partial download) to reclaim disk.
  async remove(): Promise<void> {
    this.cancel()
    await rm(this.filePath, { force: true })
    await rm(`${this.filePath}.part`, { force: true })
    this.lastError = null
    this.logger.info(`model removed: ${this.model.id}`)
  }

  // The on-disk model path when it's fully downloaded, else null — sync uses
  // this to decide whether the email-ingestion LLM is available.
  async getModelPathIfReady(): Promise<string | null> {
    try {
      await stat(this.filePath)
      return this.filePath
    } catch {
      return null
    }
  }

  // ---- LLM lifecycle (RAM control) ----

  isAiEnabled(): boolean {
    return this.aiEnabled
  }

  // Turning AI off unloads the model immediately to free its RAM; turning it on
  // lets the next sync load it lazily.
  async setAiEnabled(enabled: boolean): Promise<void> {
    this.aiEnabled = enabled
    if (!enabled) await this.unloadLlm()
  }

  // The loaded LLM when AI is on and the model is downloaded, else null. Loads
  // once via `create` and reuses it; sync wraps the result for tracing.
  async resolveLlm(create: (modelPath: string) => DisposableLlm): Promise<DisposableLlm | null> {
    if (!this.aiEnabled) return null
    const modelPath = await this.getModelPathIfReady()
    if (modelPath === null) return null
    if (this.llmHandle === null) this.llmHandle = create(modelPath)
    return this.llmHandle
  }

  async unloadLlm(): Promise<void> {
    if (this.llmHandle === null) return
    await this.llmHandle.dispose()
    this.llmHandle = null
    this.logger.info('model unloaded — RAM freed')
  }

  // Streams the model to a .part file, reports progress, then atomically moves
  // it into place on success. onProgress fires per chunk; the caller broadcasts.
  async download(onProgress: (progress: ModelProgress) => void): Promise<void> {
    if (this.controller !== null) return
    this.lastError = null
    this.controller = new AbortController()
    const tmp = `${this.filePath}.part`
    try {
      await mkdir(this.dir, { recursive: true })
      const response = await fetch(this.model.url, { signal: this.controller.signal })
      if (!response.ok || response.body === null)
        throw new Error(`model download failed: HTTP ${response.status}`)
      const total = Number(response.headers.get('content-length')) || this.model.sizeBytes
      const file = createWriteStream(tmp)
      let downloaded = 0
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        // Respect backpressure — a 5 GB stream must not buffer in memory.
        if (!file.write(Buffer.from(value)))
          await new Promise<void>((resolve) => file.once('drain', resolve))
        downloaded += value.length
        onProgress({ modelId: this.model.id, downloadedBytes: downloaded, totalBytes: total })
      }
      await new Promise<void>((resolve, reject) =>
        file.end((error?: Error | null) => (error ? reject(error) : resolve())),
      )
      await rename(tmp, this.filePath)
      this.logger.info(`model ready: ${this.model.id}`)
    } catch (error) {
      await rm(tmp, { force: true }).catch(() => {})
      if (this.controller?.signal.aborted) {
        this.logger.info('model download cancelled')
        return
      }
      this.lastError = error instanceof Error ? error.message : String(error)
      this.logger.error(`model download failed: ${this.lastError}`)
      throw new Error(this.lastError)
    } finally {
      this.controller = null
    }
  }
}

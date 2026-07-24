import type { IpcResult } from '@sources/shared'
import { fail, ok } from '@sources/shared'
import { BrowserWindow, ipcMain } from 'electron'
import type { ModelManager, ModelStatus } from '../model'
import { store } from '../store'

// model:* channels — the local-LLM model manager. status/download/cancel plus a
// 'model:progress' push event (webContents.send, the sync:event pattern). Glue,
// coverage-excluded; the pure download logic lives in ../model.ts and the
// renderer data/UI is covered.

// Mirrored in src/preload/electron-api.d.ts. `done` fires once the pass settles
// (success, cancel, or error) so the renderer refetches model:status.
export interface ModelProgressEvent {
  downloadedBytes: number
  totalBytes: number
  done: boolean
}

export function registerModelIpc(
  manager: ModelManager,
  stopSync?: () => void | Promise<void>,
): void {
  const broadcast = (event: ModelProgressEvent): void => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('model:progress', event)
  }

  ipcMain.handle('model:status', async (): Promise<IpcResult<ModelStatus>> => {
    try {
      return ok(await manager.getStatus())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('model:download', async (): Promise<IpcResult<ModelStatus>> => {
    try {
      if (manager.downloading) return fail('a download is already running')
      // Fire-and-forget: chunk progress streams over 'model:progress'; the
      // terminal { done: true } tells the renderer to refetch the final status.
      void manager
        .download((progress) =>
          broadcast({
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            done: false,
          }),
        )
        .catch(() => {})
        .finally(() => broadcast({ downloadedBytes: 0, totalBytes: 0, done: true }))
      return ok(await manager.getStatus())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('model:cancel', async (): Promise<IpcResult<ModelStatus>> => {
    try {
      manager.cancel()
      return ok(await manager.getStatus())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('model:remove', async (): Promise<IpcResult<ModelStatus>> => {
    try {
      await manager.remove()
      return ok(await manager.getStatus())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'model:set-enabled',
    async (_event, enabled: unknown): Promise<IpcResult<ModelStatus>> => {
      try {
        if (typeof enabled !== 'boolean') return fail('enabled must be a boolean')
        store.set('aiEnabled', enabled)
        // Turning AI off aborts any running scan too, so it stops promptly
        // rather than limping through the rest of the inbox.
        if (!enabled) stopSync?.()
        await manager.setAiEnabled(enabled) // unloads the model now when turning off
        return ok(await manager.getStatus())
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'model:select',
    async (_event, modelId: unknown): Promise<IpcResult<ModelStatus>> => {
      try {
        if (typeof modelId !== 'string') return fail('modelId must be a string')
        await manager.select(modelId) // cancels any download + unloads the old model
        store.set('modelId', manager.selectedModelId())
        return ok(await manager.getStatus())
      } catch (error) {
        return fail(error)
      }
    },
  )
}

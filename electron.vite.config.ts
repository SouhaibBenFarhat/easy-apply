import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Path aliases must stay in sync across: this file, tsconfig.node.json,
// tsconfig.web.json, and vitest.config.ts.
const nodeAliases = {
  // '@logger/main' must precede '@logger': object-form aliases match in
  // insertion order, and the '@logger' prefix would otherwise swallow it.
  '@logger/main': resolve('modules/logger/main.ts'),
  '@logger': resolve('modules/logger/index.ts'),
  '@sources/shared': resolve('modules/sources/shared/index.ts'),
  '@sources/main': resolve('modules/sources/main/index.ts'),
  '@persistence/main': resolve('modules/persistence/main/index.ts'),
}

const rendererAliases = {
  '@': resolve('src/renderer'),
  '@logger': resolve('modules/logger/index.ts'),
  '@ui-kit': resolve('modules/ui-kit/index.ts'),
  '@data': resolve('modules/data/index.ts'),
  '@sources/shared': resolve('modules/sources/shared/index.ts'),
  '@test-utils': resolve('modules/test-utils/index.ts'),
  '@feed': resolve('modules/feed/index.ts'),
  '@tracker': resolve('modules/tracker/index.ts'),
  '@sources-page': resolve('modules/sources-page/index.ts'),
  '@settings': resolve('modules/settings/index.ts'),
  '@shell': resolve('modules/shell/index.ts'),
  '@app': resolve('modules/app/index.ts'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: nodeAliases },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: rendererAliases },
  },
})

import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Aliases kept in sync with electron.vite.config.ts / tsconfig.*.json.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      // '@logger/main' must precede '@logger': object-form aliases match in
      // insertion order, and the '@logger' prefix would otherwise swallow it.
      '@logger/main': resolve('modules/logger/main.ts'),
      '@logger': resolve('modules/logger/index.ts'),
      '@ui-kit': resolve('modules/ui-kit/index.ts'),
      '@data': resolve('modules/data/index.ts'),
      '@sources/shared': resolve('modules/sources/shared/index.ts'),
      '@sources/main': resolve('modules/sources/main/index.ts'),
      '@persistence/main': resolve('modules/persistence/main/index.ts'),
      '@test-utils': resolve('modules/test-utils/index.ts'),
      '@feed': resolve('modules/feed/index.ts'),
      '@tracker': resolve('modules/tracker/index.ts'),
      '@sources-page': resolve('modules/sources-page/index.ts'),
      '@settings': resolve('modules/settings/index.ts'),
      '@shell': resolve('modules/shell/index.ts'),
      '@app': resolve('modules/app/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./modules/test-utils/setup.ts'],
    include: [
      'src/main/**/*.test.ts',
      'src/renderer/**/*.test.{ts,tsx}',
      'modules/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'cobertura', 'html'],
      include: ['src/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/types.ts',
        // Electron glue (BrowserWindow/ipcMain/contextBridge wiring) cannot run
        // under vitest — pure logic lives in modules/** where it IS covered.
        'src/main/**',
        'src/preload/**',
        'src/renderer/main.tsx',
        'modules/test-utils/**',
      ],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
  },
})

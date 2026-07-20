import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Aliases kept in sync with electron.vite.config.ts / tsconfig.*.json.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@logger': resolve('modules/logger/index.ts'),
      '@logger/main': resolve('modules/logger/main.ts'),
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
    // P0 only — removed in PR 1 when the first real tests land.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'cobertura', 'html'],
      include: ['src/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/types.ts',
        'src/main/index.ts',
        'src/preload/index.ts',
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

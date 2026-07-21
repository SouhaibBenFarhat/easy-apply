---
name: testing
description: Write tests the house way — test-utils render/renderHook, electron mock seeding, sync events, fixtures, coverage gates, node-env docblocks.
---

# Testing

Vitest + happy-dom + React Testing Library. Tests are co-located
(`<Name>.test.tsx` beside `<Name>.tsx`); config in `vitest.config.ts`, global
setup in `modules/test-utils/setup.ts`.

## @test-utils

Always import from `@test-utils`, never from RTL directly in feature tests:

- `render(ui, { client? })` — wraps in QueryClientProvider + TooltipProvider.
  No router: shell components are router-free by design; `@app` tests mount
  the real router via `<App />`.
- `renderHook(cb, { client?, wrapper? })` — same providers for hooks.
- `createTestQueryClient()` — no retries, infinite stale/gc time. Pass it in
  via `{ client }` when the test needs to seed or assert on the cache.
- `setupMockElectron(overrides?)` / `createMockElectron(seed?)` — installs
  `window.electron`. The db namespace is a working in-memory fake (feed
  ordering + filters match the real repository); seed it with
  `{ jobs, providers, sources }`. Setup installs a default mock before every
  test — call `setupMockElectron` again inside a test to reseed or override
  single namespaces.
- `createSyncEventEmitter(mock)` — returns an `emit(event)` that drives
  everything registered through the mock's `sync.onEvent`; the test-side
  stand-in for `webContents.send('sync:event', …)`.

Every new IPC channel must be mirrored in
`modules/test-utils/mocks/electron.ts` — the mock surface *is* the
`ElectronAPI` type, so typecheck catches drift.

## Environments

- Default environment is **happy-dom**.
- Main-process-adjacent tests (providers, engine, http, persistence) start
  with `// @vitest-environment node` on line 1 — PGlite and fake-timer HTTP
  tests do not want a DOM.
- Persistence/engine tests run against real in-memory PGlite
  (`createDatabase({ migrationsFolder })` with the repo's `drizzle/` folder)
  — same engine as production, no mocking.
- `setup.ts` carries happy-dom shims that exist for reasons: a
  `ResizeObserver` stub (Radix needs it), a `Node.prototype.nodeName` getter
  fix and a `createNodeIterator` snapshot patch (both keep DOMPurify's
  sanitizer working under happy-dom). Don't remove them; don't re-add
  what's already there.

## Fixtures

`modules/test-utils/fixtures/` — captured live API responses (ground truth
over docs). Read them via
`readFileSync(new URL('../../../test-utils/fixtures/<name>', import.meta.url))`.
Synthetic fixtures are marked in the filename (`*.synthetic.json`).
Re-capture commands live in `docs/SOURCES.md`.

## Patterns

- Providers: table/fixture-driven — fetch URL + header assertions via a
  recording harness, parse assertions against the fixture, malformed input →
  `[]`.
- Timing (useDeferredLoading, PoliteHttpClient): fake timers
  (`vi.useFakeTimers()`), assert the matrix (fast-resolve never shows;
  slow shows ≥ minVisible).
- Hooks: `renderHook` + `waitFor`; error paths by overriding one mock method
  to return `{ success: false, error }`.

## Gates

- 85% global coverage thresholds (branches/functions/lines/statements) in
  `vitest.config.ts`; CI enforces 90% diff-cover on changed lines.
- Electron glue (`src/main/**`, `src/preload/**`) is coverage-excluded —
  logic belongs in `modules/**`, where it is covered. Don't grow logic in the
  glue.
- Husky pre-commit runs `pnpm lint && pnpm typecheck && pnpm test`.

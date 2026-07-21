# EasyApply — working rules

Read `docs/ARCHITECTURE.md` for the map. These are the laws; the skills in
`.claude/skills/` show how to follow them.

## State

- **TanStack Query is the single source of truth** for all renderer state. No
  Redux, no Zustand, no context stores.
- All writes go through `@data` mutations. `setQueryData` is allowed only
  inside `modules/data/` and tests — features never touch the cache directly.
- Query keys come from the `keys` factory (`modules/data/keys.ts`); IPC
  results are unwrapped with `unwrap()` (`modules/data/ipc.ts`) so failures
  throw into react-query's error states.

## Components

- **Never raw HTML when `@ui-kit` has it** — no bare `<button>`, `<input>`,
  `<label>`, ….
- One component per folder: `modules/ui-kit/<name>/<Name>.tsx` + `index.ts`
  barrel + co-located `<Name>.test.tsx`. Same shape for feature components.
- Components are `.tsx`, one component per file, kept small — split at
  roughly 150 lines or one responsibility, extracting sub-components and
  hooks instead of growing files.
- Every `<button>` rendered anywhere gets `type="button"` (the ui-kit Button
  defaults it).

## Types

- `tsconfig.web.json` has `isolatedDeclarations`: **explicit types on every
  export**. Named hooks declare their return types.
- Never `VariantProps<typeof x>` in an exported type — write the variant
  unions out (`export type ButtonVariant = 'default' | 'ghost' | …`).
- zod schemas stay module-internal; export the inferred-equivalent interface
  and validate helpers instead.

## Layers (Biome enforces — see biome.json overrides)

- L0 `logger` → L1 `ui-kit` / `data` / `sources` / `persistence` → L2
  `test-utils` → L3 `feed` / `tracker` / `sources-page` / `settings` /
  `shell` → L4 `app`.
- `ui-kit` and `data` never import each other. Features never import each
  other. Only `@app` composes features.
- Renderer code never imports `@sources/main`, `@persistence/main`, or
  `@logger/main`; main-process code never imports renderer modules.
  `modules/sources/shared/` compiles under both tsconfigs — keep it
  process-agnostic.

## Design

- **Semantic tokens only** — never raw colors, never hex, never
  `text-white`. Tokens come from `theme.config.mjs`; run
  `pnpm generate:theme` after editing it (never edit the GENERATED blocks in
  `globals.css`).
- **Copper is scarce.** It appears in exactly five places: selected job row,
  primary button, active nav item, focus ring, and the salary figure — which
  is plain copper *text*, never a chip. Nothing else.
- **Glass is rarer than you think**: the top app header bar and overlays
  (dialogs, popovers, toasts) — nothing else. Sticky in-content headers use a
  translucent veil of their OWN level (`bg-background/90 backdrop-blur-md`),
  never the header token: stacked glass slabs break the elevation ladder. At
  most 3 backdrop-filter layers on screen; never on rows, cards, or static
  areas.
- Motion communicates a state change: nothing loops idle, nothing bounces,
  background-color transitions only inside scrolling lists, and
  `prefers-reduced-motion` is honored globally.
- No card nesting; a surface sits only on the level directly beneath it.

## IPC

- Every invoke resolves to `IpcResult<T>` — errors are values, never thrown
  across the bridge.
- Every new channel is declared in `src/preload/electron-api.d.ts` **and**
  mirrored in the mock (`modules/test-utils/mocks/electron.ts`).
- **The renderer never fetches the network.** All HTTP lives in the main
  process behind `PoliteHttpClient`; politeness budgets live in each
  provider's `meta.politeness`, not in prose.

## Workflow

- `pnpm lint` (Biome), `pnpm typecheck` (3-tsconfig trio), `pnpm test`
  (Vitest, 85% global coverage; CI adds 90% diff-cover on changed lines).
- Husky pre-commit runs lint + typecheck + test — keep all three green
  locally.
- Main-process-adjacent tests start with `// @vitest-environment node`;
  everything else runs under happy-dom via `modules/test-utils/setup.ts`.
- Conventional-Commit PR titles (squash-merge uses the title).

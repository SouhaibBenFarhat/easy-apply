---
name: data-layer
description: Add a query or mutation in modules/data — keys factory, IpcResult unwrap, optimistic updates, invalidation, and persistence namespaces.
---

# Adding a query or mutation

`modules/data/` is L1 renderer-side: TanStack Query over `window.electron`
IPC. It never imports `@ui-kit` or main-process code. Features call these
hooks; they never touch the cache or the bridge directly.

## Checklist

1. **Key** — extend the typed `keys` object in `modules/data/keys.ts`.
   Hierarchical, prefix-invalidatable: `keys.jobs.all` = `['jobs']` covers
   every `['jobs', …]` key. The first segment is the namespace the persister
   filters on.
2. **IPC** — if the channel is new: implement the `ipcMain.handle` in
   `src/main/ipc/`, expose it in `src/preload/index.ts`, declare it in
   `src/preload/electron-api.d.ts`, and mirror it in
   `modules/test-utils/mocks/electron.ts`. Kebab-case channel names, response
   always `IpcResult<T>`.
3. **Query** — named hook with an explicit return type in
   `modules/data/queries/<domain>.ts`:

   ```ts
   export function useFeed(filters: FeedFilters = {}): UseQueryResult<StoredJob[], Error> {
     return useQuery({
       queryKey: keys.jobs.feed(filters),
       queryFn: async () => unwrap(await window.electron.db.jobs.list(filters)),
       placeholderData: keepPreviousData, // feed never blanks once populated
     })
   }
   ```

   `unwrap` (`modules/data/ipc.ts`) turns `{ success: false, error }` into a
   throw — that is the only place IPC errors become exceptions.
4. **Mutation** — `modules/data/mutations/<domain>.ts`, invalidate on settle.
5. **Test** — co-located `.test.ts` using `@test-utils` `renderHook` +
   `setupMockElectron` seeding.

## The optimistic pattern

Copy `useSetJobStatus` in `modules/data/mutations/jobs.ts` — it is the house
reference:

- `onMutate`: `cancelQueries` on the prefix (stop in-flight refetches from
  clobbering the patch), snapshot `getQueriesData({ queryKey: keys.jobs.all })`,
  patch **every** cached list and detail entry, return the snapshot.
- `onError`: restore the snapshot verbatim.
- `onSettled`: `invalidateQueries` on the prefix — the DB re-read is the
  truth.

Simple mutations (notes, hidden) skip the optimistic step and just invalidate
in `onSuccess`.

`setQueryData` is allowed **only** inside `modules/data/` and tests.

## Persistence namespaces

`modules/data/client.ts` persists **only** the `settings` and `local` key
namespaces to localStorage (`shouldDehydrateQuery`). Job data is never
dehydrated — the local PGlite DB *is* the job cache, and every feed/detail
query re-reads it on startup. If you add a key that should survive restarts,
put it under one of those namespaces; anything else must not be.

`local`-namespace queries (see `queries/local.ts` + `mutations/local.ts`) read
localStorage directly and keep mounted hooks in step via a cache write — the
`lastFeedVisit` pair is the pattern.

## Push events

Sync push events arrive via `window.electron.sync.onEvent`;
`modules/data/hooks/use-sync-events.ts` maps them to invalidations. New event
types: extend `SyncEvent` in `src/preload/electron-api.d.ts` (mirrored from
`modules/sources/main/engine.ts`) and drive them in tests with
`createSyncEventEmitter` from `@test-utils`.

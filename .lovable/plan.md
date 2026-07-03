# Offline resilience: cached reads + queued writes

Goal: when the backend is slow, unreachable, or returning errors, the app keeps rendering the last-known data and any new transactions/edits are stored locally and synced when the backend recovers.

## What the user will see

- App always loads instantly with the last data it saw — no blank screens, no crashes.
- A small status pill in the header: **Online**, **Offline (cached)**, or **Syncing… (N pending)**.
- Add transaction / edit / delete keep working while offline. New rows appear immediately with a subtle "pending sync" dot.
- When connection returns, queued changes flush automatically. Toast on success/failure.
- Manual **Retry sync** button in the status pill.

## How it works

**1. Cached reads (react-query persistence)**

- Persist the react-query cache to `localStorage` under key `finance-cache-v1` scoped by user id.
- On app start, hydrate cache before rendering. Queries still refetch in background — cache is just the fallback.
- If a query fails (network / 5xx), keep serving the cached value instead of erroring.

**2. Backend health signal**

- Lightweight `useBackendStatus` hook: pings `supabase.auth.getSession()` + a cheap `select 1` head request on interval + on `online`/`offline` events.
- Exposes `status: 'online' | 'offline' | 'degraded'`.

**3. Queued writes (outbox pattern)**

- New `src/lib/outbox.ts`: append-only queue in `localStorage` (`finance-outbox-v1`), each entry `{ id, userId, kind: 'insert'|'update'|'delete', table, payload, createdAt, attempts }`.
- Wrap `useCreateTransaction`, `useCreateTransactionsBatch`, `useDeleteTransaction`, `useMarkTransactionDone`, `useCreateCategory`, `useCreateAccount`, `useDeleteAccount` so they:
  1. Optimistically update the react-query cache with a temp id (`local-<uuid>`).
  2. Try the network call. On success → replace temp row with server row.
  3. On failure (offline / 5xx / timeout) → enqueue in outbox, keep the optimistic row, mark it `_pending: true`.
- A `useOutboxFlusher` runs on mount, on `online` event, and every 20s while there are pending items. Retries with exponential backoff, caps attempts, surfaces permanent failures as a toast + keeps the row flagged so the user can retry or discard.

**4. UI touches (small, presentational)**

- New `<BackendStatusPill />` in `AppLayout` header.
- Transaction row shows a muted dot + tooltip "Waiting to sync" when `_pending`.
- Empty-state guards: when offline AND no cache, show "Can't reach the backend — showing nothing yet" instead of a spinner-forever.

**5.Allow write in Transactions** 

Allow write access to the category and amount columns 

## Scope boundaries

- No schema changes, no edge function changes.
- Only transactional writes are queued. Interest accrual (RPC), AI insights, and SMS parse (edge function) still require live backend — they show a friendly "needs connection" message when offline.
- Conflict strategy is last-write-wins — acceptable since each user only writes from one session in practice.

## Files

New:

- `src/lib/outbox.ts` — queue storage + flush logic.
- `src/lib/queryPersister.ts` — localStorage persister for react-query.
- `src/hooks/useBackendStatus.ts`
- `src/hooks/useOutboxFlusher.ts`
- `src/components/BackendStatusPill.tsx`

Edited:

- `src/App.tsx` — wrap QueryClient with persister, mount flusher.
- `src/hooks/useFinance.ts` — route mutations through outbox helper; make queries tolerant of errors (return cached).
- `src/components/AppLayout.tsx` — add status pill.
- `src/pages/Transactions.tsx` — render pending indicator.

## Technical notes

- Use `@tanstack/react-query-persist-client` + `createSyncStoragePersister` (already compatible with installed react-query v5). Add both via `bun add`.
- Persister `maxAge: 7d`, `buster: userId` so switching accounts wipes the cache.
- Outbox key namespaced per user; cleared on sign-out.
- Never queue auth calls or RPCs — only plain table writes.
- `_pending` and `local-*` ids live only in the client cache; nothing extra is sent to the backend.

## Out of scope

- Service worker / true PWA offline (asset caching) — separate effort.
- Multi-device conflict resolution.
- Encrypted local cache.
  &nbsp;
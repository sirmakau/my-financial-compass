# Food & Finance Advisor + Accounts Enhancement

Four independent modules, shipped in one pass.

---

## Module 1 — Pending transactions + "Mark as Done"

### Schema (migration)
Add to `public.transactions`:
- `status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed'))`
- `completed_at timestamptz NULL`

Backfill: existing rows already get `'completed'` via default.

### Balance integrity
Current trigger `tg_apply_txn_to_balance` applies amount on every INSERT. We need pending rows to NOT affect balance until completed. Change:
- INSERT: only apply if `NEW.status = 'completed'`; set `completed_at = now()` when completed at insert.
- UPDATE: handle four transitions
  - pending → completed: add `NEW.amount`, set `completed_at = now()`
  - completed → pending: subtract `OLD.amount`, clear `completed_at`
  - completed → completed: existing delta logic
  - pending → pending: no balance change
- DELETE: only subtract if `OLD.status = 'completed'`

### Hook
`useMarkTransactionDone()` in `useFinance.ts`: updates `{status:'completed', completed_at: new Date().toISOString()}`, invalidates `transactions` + `accounts`.

### UI (`src/pages/Transactions.tsx`)
- Show "Pending" badge on `status='pending'` rows
- Inline "Mark Done" button (with AlertDialog confirm) on those rows
- After confirm → row updates, badge flips to "Done", button disappears

---

## Module 2 — Food page: manual budget + shuffle fix + balance source

In `src/pages/Food.tsx`:
- Replace 25/40/35 split with a single **Daily food limit** number input (default 300).
- Suggester logic: from all combos, filter `cost <= limit`, sort by cost desc, group by `meal_type` and show top items per slot. If limit < cheapest combo, show empty state "Try a smaller snack — no combos under X". If limit ≥ ~250, show one pick per meal_type; otherwise show flat list of best affordable combos regardless of meal slot.
- Shuffle fix: `setDisplayed(prev => [...prev].sort(() => Math.random() - 0.5))`.
- HELB mode badge: change balance source from "cash type accounts" to **sum of accounts whose name matches `M-Pesa` or `KCB` (case-insensitive)**. Thresholds unchanged.

No DB changes.

---

## Module 3 — Smarter M-Pesa parser

Edit `supabase/functions/parse-mpesa/index.ts`:
- Update system prompt so the model extracts: `amount`, `subtype` (expense|income|transfer|loan|receivable|repayment), `source_account_hint`, `dest_account_hint`, `counterparty`, `purpose`, `pending` boolean, `mpesa_ref`, `occurred_at`.
- Output shape: array of `legs` where transfers produce two legs (debit + credit) linked by shared ref; receivables produce a single `pending` leg with no balance impact (status=pending); loans produce inflow leg + note.
- Account routing: resolve `source_account_hint`/`dest_account_hint` against the user's accounts by case-insensitive name match (M-Pesa, KCB, Ziidi, Cash). Fall back to M-Pesa for ambiguous inflows.

Update `src/pages/ImportSMS.tsx`:
- Preview card now shows: amount, subtype, source account, dest account (with arrow for transfers), counterparty, purpose, pending flag.
- Each field editable inline before save.
- On save: insert with `status` (pending|completed) and `metadata` carrying counterparty/purpose/subtype.

---

## Module 4 — Categories: expanded seed + inline create

### Migration
Replace `ensure_user_categories()` body to seed the larger base list:
Food & Drinks, Transport, Rent, Airtime & Data, Savings, Entertainment, Health, Clothing, Education, Business, Loan Repayment, Receivable, Transfer, Salary, Gift, Utilities, Shopping, Fees & Charges, Investment, Miscellaneous.
Uses existing `ON CONFLICT (user_id, name) DO NOTHING` so re-running is safe and existing users get the new ones on next call.

### UI
In `QuickAddTransaction.tsx` category Select: add an "+ Create new…" option that opens an inline input. On Enter → insert into `categories` with chosen `kind`, refresh list, auto-select the new one.

---

## Technical details

### Files touched
- **Migration 1**: alter transactions (status, completed_at) + replace `tg_apply_txn_to_balance`
- **Migration 2**: replace `ensure_user_categories` with expanded seed
- `src/hooks/useFinance.ts` — add `useMarkTransactionDone`
- `src/pages/Transactions.tsx` — pending badge + mark-done button
- `src/pages/Food.tsx` — budget input, shuffle fix, HELB balance source
- `supabase/functions/parse-mpesa/index.ts` — richer extraction prompt + legs
- `src/pages/ImportSMS.tsx` — editable preview, save with status/metadata
- `src/components/QuickAddTransaction.tsx` — inline category create

### Risks / called out
- Changing the balance trigger is invasive. All existing rows are `'completed'` so behavior is identical for current data — only newly-inserted `pending` rows differ. I will keep the trigger SECURITY DEFINER and preserve transfer logic.
- The parser changes are prompt-only on the AI side; legacy single-leg messages still work because transfer detection is opt-in based on the model output.

### Out of scope (deferred)
Meal log analytics, nutrition scoring, AI personalization, loan repayment schedule, counterparty analytics.

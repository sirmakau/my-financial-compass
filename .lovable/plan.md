# Food & Finance Advisor — MVP Plan

A new `/food` module that turns your real Kenyan student spending patterns into a budget-aware meal suggester, with a HELB-mode badge driven by your actual M-Pesa + cash balance.

## What you get

1. **Food database** — seeded with base prices (mandazi 10, chapati 20, egg 20, sukuma 20, beans 40, ndengu 40, chips 130, chicken 300, nyama choma 500, etc.).
2. **Combo engine** — pre-seeded breakfast / lunch / supper combos with cost + category (Survival, Fast, Healthy, Luxury, Street, Gym).
3. **Budget suggester** — "I have X KES for today" → splits budget 25% breakfast / 40% lunch / 35% supper, then returns best top 3 combos per meal slot within its allocated slice, plus remaining balance. A **Shuffle** button per column re-draws from the same filtered pool (random sort, no new logic).
4. **HELB mode badge** — computed from the *sum* of balances across **all** accounts where `type` is `cash` or `mpesa` (never per-account):
  - `> 3000` → **HELB Reflected** (luxury combos surfaced)
  - `800–3000` → **Normal Operation**
  - `200–800` → **End Month** (survival combos prioritized)
  - `< 200` → **Critical Condition** (hard-filter to `category = 'survival'` only — tea + mandazi / ugali + sukuma)
5. **Optional logging** — picking a combo opens a confirm prompt: *"Log this as an expense?"* → if yes, inserts a negative transaction under `Food & Drinks` against a chosen account (defaults to M-Pesa; falls back to first available account if no M-Pesa exists). If no, it's just a suggestion.

## Pages & UI

- New route `/food` → `src/pages/Food.tsx`, added to `AppLayout` nav.
- Top: **HELB mode badge** + total cash+mpesa balance + budget input (defaults to balance).
- Middle: three columns — Breakfast / Lunch / Supper — each shows top 3 combos within its budget slice, with cost, category chip, and a **Pick** + **Shuffle** button.
- Below: **Combo browser** with category filter chips (Survival, Fast, Healthy, Luxury, Street, Gym).
- "Pick" → confirm dialog: *Log as expense?* Yes (account picker, M-Pesa default → fallback to first account) / No / Cancel.

## Data model

Two new tables (user-scoped, RLS owner-only):

- `foods` — `name`, `unit_price` (numeric), `typical_qty`, `actual_cost`, `is_home_cooked` (bool).
- `meal_combos` — `name`, `meal_type` (text, CHECK `IN ('breakfast','lunch','supper')`), `category` (text, CHECK `IN ('survival','fast','healthy','luxury','street','gym')`), `cost` (numeric), `items` (jsonb list of food names).

Seeded globally for the signed-in user on first visit via `ensure_food_seed(p_user_id uuid)` SECURITY DEFINER — mirrors `ensure_user_categories`. Seeding is guarded against double-firing: the function checks `WHERE user_id = p_user_id` before inserting, and the client-side call uses a `hasSeeded` ref so it fires once per mount regardless of navigation.

Logging reuses the existing `transactions` table + existing `Food & Drinks` category; no schema change there.

## Technical details

- Migration adds `foods`, `meal_combos`, RLS policies, and `ensure_food_seed(p_user_id uuid)`. CHECK constraint names are explicit: `meal_combos_meal_type_check`, `meal_combos_category_check`.
- New hook `src/hooks/useFood.ts`: `useFoods()`, `useCombos()`, `useEnsureFoodSeed()`, `useLogMealAsTxn()`.
- Suggester is pure client-side:
  1. Split daily budget → breakfast 25% / lunch 40% / supper 35%.
  2. Filter combos by `cost <= slot_budget`.
  3. If HELB mode is Critical, hard-filter to `category = 'survival'` before step 2.
  4. Sort by cost desc, take top 3. Shuffle re-sorts with `sort(() => Math.random() - 0.5)`.
- HELB mode computed from `useAccounts()` — `sum(balance) WHERE type IN ('cash','mpesa')`.
- `useEnsureFoodSeed()` called once in `Food.tsx` via `useEffect` with a `hasSeeded` ref guard.
- Reuse shadcn `Card`, `Badge`, `Dialog`, `Select`. No new deps.
- No AI calls in MVP. No nutrition tracking yet (deferred to phase 2).

## Out of scope (later phases)

- Meal log history table & weekly analytics dashboard
- Nutrition scoring (protein/carbs/veg, junk frequency nudges)
- AI recommender that personalizes from recent meal history
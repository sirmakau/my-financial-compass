
-- Module 1: pending/completed status on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed'));

-- Backfill completed_at for existing completed rows
UPDATE public.transactions SET completed_at = occurred_at
  WHERE status = 'completed' AND completed_at IS NULL;

-- Replace balance trigger to respect status transitions
CREATE OR REPLACE FUNCTION public.tg_apply_txn_to_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at := now();
      END IF;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- pending -> completed: apply amount
    IF OLD.status = 'pending' AND NEW.status = 'completed' THEN
      UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at := now();
      END IF;
      RETURN NEW;
    END IF;
    -- completed -> pending: reverse old amount
    IF OLD.status = 'completed' AND NEW.status = 'pending' THEN
      UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      NEW.completed_at := NULL;
      RETURN NEW;
    END IF;
    -- completed -> completed: usual delta logic
    IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
      IF NEW.account_id = OLD.account_id THEN
        UPDATE public.accounts SET balance = balance + (NEW.amount - OLD.amount) WHERE id = NEW.account_id;
      ELSE
        UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      END IF;
      RETURN NEW;
    END IF;
    -- pending -> pending: no balance change
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'completed' THEN
      UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $function$;

-- Module 4: expand category seed
CREATE OR REPLACE FUNCTION public.ensure_user_categories(p_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH required(name, kind, color, icon) AS (
    VALUES
      ('Salary','income','#10b981','briefcase'),
      ('Business','income','#22c55e','store'),
      ('Gift','income','#84cc16','gift'),
      ('Food & Drinks','expense','#f59e0b','utensils'),
      ('Transport','expense','#3b82f6','bus'),
      ('Rent','expense','#ef4444','home'),
      ('Utilities','expense','#06b6d4','zap'),
      ('Airtime & Data','expense','#8b5cf6','smartphone'),
      ('Shopping','expense','#ec4899','shopping-bag'),
      ('Clothing','expense','#f472b6','shirt'),
      ('Education','expense','#0ea5e9','graduation-cap'),
      ('Health','expense','#f43f5e','heart-pulse'),
      ('Entertainment','expense','#a855f7','clapperboard'),
      ('Fees & Charges','expense','#94a3b8','receipt'),
      ('Loan Repayment','expense','#dc2626','landmark'),
      ('Savings','transfer','#0d9488','piggy-bank'),
      ('Investment','transfer','#14b8a6','trending-up'),
      ('Transfer','transfer','#64748b','arrow-left-right'),
      ('Receivable','income','#fbbf24','hand-coins'),
      ('Miscellaneous','expense','#6b7280','circle')
  ), ins AS (
    INSERT INTO public.categories(user_id, name, kind, color, icon)
    SELECT p_user_id, r.name, r.kind::category_kind, r.color, r.icon
    FROM required r
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;
  RETURN v_inserted;
END $function$;

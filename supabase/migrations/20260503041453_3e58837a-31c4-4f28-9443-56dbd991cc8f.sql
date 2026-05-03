-- 1. Add credit_limit column for debt accounts (e.g. Fuliza max limit)
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS credit_limit numeric;

-- 2. Per-user ensure function (callable by authenticated client)
CREATE OR REPLACE FUNCTION public.ensure_user_categories(p_user_id uuid DEFAULT auth.uid())
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'No user'; END IF;

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
      ('Health','expense','#f43f5e','heart-pulse'),
      ('Entertainment','expense','#a855f7','clapperboard'),
      ('Fees & Charges','expense','#94a3b8','receipt'),
      ('Loan Repayment','expense','#dc2626','landmark'),
      ('Investment','transfer','#14b8a6','trending-up'),
      ('Transfer','transfer','#64748b','arrow-left-right'),
      ('Other','expense','#6b7280','circle')
  ), ins AS (
    INSERT INTO public.categories(user_id, name, kind, color, icon)
    SELECT p_user_id, r.name, r.kind::category_kind, r.color, r.icon
    FROM required r
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END $$;

-- 3. Backfill all users (used by cron)
CREATE OR REPLACE FUNCTION public.ensure_all_users_categories()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u record;
  total int := 0;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    total := total + public.ensure_user_categories(u.id);
  END LOOP;
  RETURN total;
END $$;

-- 4. Run once now to backfill existing users
SELECT public.ensure_all_users_categories();

-- 5. Schedule daily backfill via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('ensure-user-categories-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ensure-user-categories-daily',
  '0 3 * * *',
  $$ SELECT public.ensure_all_users_categories(); $$
);
-- Restrict ensure_user_categories: only the caller's own user_id allowed
CREATE OR REPLACE FUNCTION public.ensure_user_categories(p_user_id uuid DEFAULT auth.uid())
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.ensure_user_categories(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_categories(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_all_users_categories() FROM PUBLIC, anon, authenticated;
-- only postgres/service_role (cron) can run the all-users variant
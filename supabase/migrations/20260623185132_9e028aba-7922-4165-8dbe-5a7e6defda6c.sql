
-- 1. Trigger function: after a transaction is applied to an Mpesa cash account,
--    rebalance with the Fuliza debt account for the same user.
CREATE OR REPLACE FUNCTION public.tg_auto_fuliza_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mpesa public.accounts%ROWTYPE;
  v_fuliza public.accounts%ROWTYPE;
  v_cat_id uuid;
  v_amount numeric;
  v_ref text;
  v_user uuid;
  v_acct_id uuid;
BEGIN
  -- Determine the user & account in play.
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_acct_id := OLD.account_id;
  ELSE
    v_user := NEW.user_id;
    v_acct_id := NEW.account_id;
    -- Skip rows produced by this trigger to avoid recursion.
    IF NEW.source = 'auto-fuliza' THEN RETURN NEW; END IF;
  END IF;

  -- Locate the user's Mpesa cash account and Fuliza debt account.
  SELECT * INTO v_mpesa FROM public.accounts
    WHERE user_id = v_user AND type = 'cash' AND name ILIKE 'mpesa'
    LIMIT 1;
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Only react when the triggering row touched the Mpesa account.
  IF v_acct_id <> v_mpesa.id THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT * INTO v_fuliza FROM public.accounts
    WHERE user_id = v_user AND type = 'debt' AND name ILIKE 'fuliza'
    LIMIT 1;
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Pick (or create) a category for the audit rows.
  SELECT id INTO v_cat_id FROM public.categories
    WHERE user_id = v_user AND name = 'Loan Repayment' LIMIT 1;
  IF v_cat_id IS NULL THEN
    SELECT id INTO v_cat_id FROM public.categories
      WHERE user_id = v_user AND name = 'Transfer' LIMIT 1;
  END IF;

  -- Case A: Mpesa overdrawn → borrow shortfall from Fuliza.
  IF v_mpesa.balance < 0 THEN
    v_amount := -v_mpesa.balance;       -- positive shortfall
    v_ref := 'AUTO-FULIZA-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

    -- Cash leg: bring Mpesa back to 0.
    INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at,
      description, source, mpesa_ref, status, completed_at)
    VALUES (v_user, v_mpesa.id, v_cat_id, v_amount, now(),
      'Fuliza coverage (auto)', 'auto-fuliza', v_ref, 'completed', now());

    -- Debt leg: deepen Fuliza debt.
    INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at,
      description, source, mpesa_ref, status, completed_at)
    VALUES (v_user, v_fuliza.id, v_cat_id, -v_amount, now(),
      'Fuliza borrow (auto)', 'auto-fuliza', v_ref || '-DEBT', 'completed', now());

  -- Case B: Mpesa positive AND Fuliza has debt → auto-repay up to surplus.
  ELSIF v_mpesa.balance > 0 AND v_fuliza.balance < 0 THEN
    v_amount := LEAST(v_mpesa.balance, -v_fuliza.balance);
    IF v_amount > 0 THEN
      v_ref := 'AUTO-FULIZA-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

      -- Cash leg: reduce Mpesa.
      INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at,
        description, source, mpesa_ref, status, completed_at)
      VALUES (v_user, v_mpesa.id, v_cat_id, -v_amount, now(),
        'Fuliza auto-repay', 'auto-fuliza', v_ref, 'completed', now());

      -- Debt leg: reduce Fuliza debt (positive).
      INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at,
        description, source, mpesa_ref, status, completed_at)
      VALUES (v_user, v_fuliza.id, v_cat_id, v_amount, now(),
        'Fuliza repay (auto)', 'auto-fuliza', v_ref || '-DEBT', 'completed', now());
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_auto_fuliza_balance ON public.transactions;
CREATE TRIGGER trg_auto_fuliza_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_fuliza_balance();

-- 2. One-time correction to your specified state.
UPDATE public.accounts SET balance = 0      WHERE id = 'ac657940-66ab-4b77-a4b8-b1d349ae61fd';
UPDATE public.accounts SET balance = -476.81 WHERE id = '4c6939ff-9c99-49cb-9713-f4d33d15df49';

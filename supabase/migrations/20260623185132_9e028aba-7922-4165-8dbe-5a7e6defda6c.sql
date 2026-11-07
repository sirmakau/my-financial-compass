
-- 1. Trigger function: after a transaction is applied to an Mpesa cash account,
--    mirror its balance to the user's Fuliza debt account.
CREATE OR REPLACE FUNCTION public.tg_auto_fuliza_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mpesa public.accounts%ROWTYPE;
  v_user uuid;
  v_acct_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_acct_id := OLD.account_id;
  ELSE
    v_user := NEW.user_id;
    v_acct_id := NEW.account_id;
  END IF;

  SELECT * INTO v_mpesa FROM public.accounts
    WHERE user_id = v_user AND type = 'cash' AND name ~* '^\s*m[-\s]?pesa\s*$'
    LIMIT 1;
  IF NOT FOUND OR v_acct_id <> v_mpesa.id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.accounts
  SET balance = LEAST(0, v_mpesa.balance), updated_at = now()
  WHERE user_id = v_user
    AND type = 'debt'
    AND (name ILIKE '%fuliza%' OR subtype ILIKE '%fuliza%');

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_auto_fuliza_balance ON public.transactions;
CREATE TRIGGER trg_auto_fuliza_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_fuliza_balance();

-- 2. One-time correction to your specified state.
UPDATE public.accounts SET balance = 0      WHERE id = 'ac657940-66ab-4b77-a4b8-b1d349ae61fd';
UPDATE public.accounts SET balance = -476.81 WHERE id = '4c6939ff-9c99-49cb-9713-f4d33d15df49';

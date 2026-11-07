CREATE OR REPLACE FUNCTION public.tg_auto_fuliza_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_acct uuid; v_mpesa public.accounts%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN v_user := OLD.user_id; v_acct := OLD.account_id;
  ELSE v_user := NEW.user_id; v_acct := NEW.account_id; END IF;
  SELECT * INTO v_mpesa FROM public.accounts
    WHERE user_id = v_user AND type = 'cash' AND name ~* '^\s*m[-\s]?pesa\s*$' LIMIT 1;
  IF NOT FOUND OR v_acct <> v_mpesa.id THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.accounts SET balance = LEAST(0, v_mpesa.balance), updated_at = now()
    WHERE user_id = v_user AND type = 'debt' AND (name ILIKE '%fuliza%' OR subtype ILIKE '%fuliza%');
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_auto_fuliza_balance() FROM PUBLIC, anon, authenticated;
UPDATE public.accounts f SET balance = LEAST(0, m.balance)
FROM public.accounts m
WHERE f.user_id = m.user_id AND f.type='debt' AND (f.name ILIKE '%fuliza%' OR f.subtype ILIKE '%fuliza%')
  AND m.type='cash' AND m.name ~* '^\s*m[-\s]?pesa\s*$';
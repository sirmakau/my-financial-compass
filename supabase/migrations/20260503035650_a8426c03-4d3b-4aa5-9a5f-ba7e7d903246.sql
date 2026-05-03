
INSERT INTO public.categories (user_id, name, kind, color, icon)
SELECT DISTINCT a.user_id, 'Investment', 'transfer'::category_kind, '#14b8a6', 'trending-up'
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id = a.user_id AND c.name = 'Investment'
);

CREATE OR REPLACE FUNCTION public.accrue_interest_for_account(p_account_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account public.accounts%ROWTYPE;
  v_days int;
  v_rate numeric;
  v_interest numeric;
  v_last timestamptz;
  v_cat_id uuid;
BEGIN
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_account.type <> 'investment' THEN RAISE EXCEPTION 'Not an investment account'; END IF;
  IF v_account.interest_rate IS NULL OR v_account.interest_rate <= 0 THEN
    RAISE EXCEPTION 'No interest rate set';
  END IF;

  v_last := COALESCE(v_account.last_interest_accrued_at, v_account.created_at);
  v_days := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - v_last)) / 86400)::int);
  IF v_days <= 0 THEN RETURN 0; END IF;

  v_rate := v_account.interest_rate / 100.0;
  v_interest := ROUND(v_account.balance * v_rate * v_days / 365.0, 2);
  IF v_interest <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.categories(user_id, name, kind, color, icon)
  VALUES (auth.uid(), 'Investment', 'transfer'::category_kind, '#14b8a6', 'trending-up')
  ON CONFLICT (user_id, name) DO NOTHING;

  SELECT id INTO v_cat_id FROM public.categories
    WHERE user_id = auth.uid() AND name = 'Investment' LIMIT 1;

  INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at, description, source)
  VALUES (auth.uid(), p_account_id, v_cat_id, v_interest, now(),
          'Accrued interest (' || v_days || ' days @ ' || v_account.interest_rate || '% p.a.)',
          'manual');

  UPDATE public.accounts SET last_interest_accrued_at = now() WHERE id = p_account_id;
  RETURN v_interest;
END $function$;

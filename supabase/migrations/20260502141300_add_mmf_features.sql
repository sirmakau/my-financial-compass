-- Add interest_rate to accounts for MMF accrual
ALTER TABLE public.accounts ADD COLUMN interest_rate NUMERIC(5,4) DEFAULT 0; -- e.g. 0.05 for 5%

-- Add subtype for accounts, e.g. for Fuliza
ALTER TABLE public.accounts ADD COLUMN subtype TEXT;

-- Function to accrue interest for investment accounts
CREATE OR REPLACE FUNCTION public.accrue_interest_for_account(
  p_account_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance NUMERIC;
  v_rate NUMERIC;
  v_interest NUMERIC;
  v_user_id UUID;
BEGIN
  SELECT balance, interest_rate, user_id INTO v_balance, v_rate, v_user_id
  FROM public.accounts
  WHERE id = p_account_id AND type = 'investment';

  IF NOT FOUND OR v_rate = 0 THEN
    RETURN;
  END IF;

  v_interest := v_balance * v_rate / 365; -- daily accrual

  INSERT INTO public.transactions(user_id, account_id, amount, occurred_at, description, source)
  VALUES (v_user_id, p_account_id, v_interest, p_date, 'Daily interest accrual', 'ai_assisted');
END $$;

-- Function to accrue interest for all investment accounts for a user
CREATE OR REPLACE FUNCTION public.accrue_daily_interest(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc RECORD;
BEGIN
  FOR acc IN SELECT id FROM public.accounts WHERE user_id = p_user_id AND type = 'investment' AND interest_rate > 0 LOOP
    PERFORM public.accrue_interest_for_account(acc.id, p_date);
  END LOOP;
END $$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.accrue_interest_for_account(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accrue_daily_interest(UUID, DATE) FROM PUBLIC, anon, authenticated;
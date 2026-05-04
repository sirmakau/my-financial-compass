DROP INDEX IF EXISTS public.uniq_mpesa_ref_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mpesa_ref_per_user_acct_amt
  ON public.transactions(user_id, mpesa_ref, account_id, amount)
  WHERE mpesa_ref IS NOT NULL;
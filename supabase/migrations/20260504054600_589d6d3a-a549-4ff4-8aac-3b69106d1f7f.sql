CREATE UNIQUE INDEX IF NOT EXISTS uniq_mpesa_ref_per_user
ON public.transactions (user_id, mpesa_ref)
WHERE mpesa_ref IS NOT NULL;
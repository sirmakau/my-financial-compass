
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_apply_txn_to_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seed_user_categories() FROM PUBLIC, anon, authenticated;

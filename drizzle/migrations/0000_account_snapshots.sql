CREATE TABLE public.account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  accounts_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_net_worth numeric NOT NULL DEFAULT 0,
  note text
);
GRANT SELECT ON public.account_snapshots TO authenticated;
GRANT ALL ON public.account_snapshots TO service_role;
ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots select" ON public.account_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.reset_user_accounts(p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.account_snapshots(user_id, accounts_data, total_net_worth, note)
  SELECT v_user,
    COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'balance',balance)), '[]'::jsonb),
    COALESCE(sum(balance),0), p_note
  FROM public.accounts WHERE user_id = v_user
  RETURNING id INTO v_id;
  UPDATE public.accounts SET balance = 0 WHERE user_id = v_user;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.reset_user_accounts(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_user_accounts(text) TO authenticated;
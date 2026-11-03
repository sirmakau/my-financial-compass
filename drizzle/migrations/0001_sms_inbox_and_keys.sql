CREATE TABLE public.sms_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text NOT NULL,
  sender text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX sms_inbox_user_body_uq ON public.sms_inbox(user_id, md5(body));
GRANT SELECT, UPDATE, DELETE ON public.sms_inbox TO authenticated;
GRANT ALL ON public.sms_inbox TO service_role;
ALTER TABLE public.sms_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inbox select" ON public.sms_inbox FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own inbox update" ON public.sms_inbox FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own inbox delete" ON public.sms_inbox FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.sms_webhook_keys (
  user_id uuid PRIMARY KEY,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_webhook_keys TO authenticated;
GRANT ALL ON public.sms_webhook_keys TO service_role;
ALTER TABLE public.sms_webhook_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own key all" ON public.sms_webhook_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
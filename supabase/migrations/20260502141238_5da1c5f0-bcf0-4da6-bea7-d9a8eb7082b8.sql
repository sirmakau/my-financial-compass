
-- ============ ENUMS ============
CREATE TYPE public.account_type AS ENUM ('cash','investment','debt','receivable');
CREATE TYPE public.txn_source AS ENUM ('manual','parsed','ai_assisted','import');
CREATE TYPE public.category_kind AS ENUM ('income','expense','transfer');

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL DEFAULT 'expense',
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
CREATE INDEX idx_categories_user ON public.categories(user_id);

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount NUMERIC(18,2) NOT NULL,        -- positive = inflow, negative = outflow
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  counterparty TEXT,
  mpesa_ref TEXT,
  source public.txn_source NOT NULL DEFAULT 'manual',
  raw_message TEXT,                     -- original SMS if parsed
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user_date ON public.transactions(user_id, occurred_at DESC);
CREATE INDEX idx_txn_account ON public.transactions(account_id);
CREATE UNIQUE INDEX uniq_mpesa_ref_per_user ON public.transactions(user_id, mpesa_ref) WHERE mpesa_ref IS NOT NULL;

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  action TEXT NOT NULL,                 -- INSERT/UPDATE/DELETE
  old_row JSONB,
  new_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user_time ON public.audit_log(user_id, created_at DESC);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_transactions BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Account balance auto-update from transactions ============
CREATE OR REPLACE FUNCTION public.tg_apply_txn_to_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.account_id = OLD.account_id THEN
      UPDATE public.accounts SET balance = balance + (NEW.amount - OLD.amount) WHERE id = NEW.account_id;
    ELSE
      UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER apply_txn_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_txn_to_balance();

-- ============ Audit trigger ============
CREATE OR REPLACE FUNCTION public.tg_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_row_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id; v_row_id := OLD.id;
    INSERT INTO public.audit_log(user_id,table_name,row_id,action,old_row,new_row)
    VALUES (v_user, TG_TABLE_NAME, v_row_id, TG_OP, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSE
    v_user := NEW.user_id; v_row_id := NEW.id;
    INSERT INTO public.audit_log(user_id,table_name,row_id,action,old_row,new_row)
    VALUES (v_user, TG_TABLE_NAME, v_row_id, TG_OP,
            CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER audit_accounts AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ============ Seed default categories on signup ============
CREATE OR REPLACE FUNCTION public.tg_seed_user_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.categories(user_id,name,kind,color,icon) VALUES
    (NEW.id,'Salary','income','#10b981','briefcase'),
    (NEW.id,'Business','income','#22c55e','store'),
    (NEW.id,'Gift','income','#84cc16','gift'),
    (NEW.id,'Food & Drinks','expense','#f59e0b','utensils'),
    (NEW.id,'Transport','expense','#3b82f6','bus'),
    (NEW.id,'Rent','expense','#ef4444','home'),
    (NEW.id,'Utilities','expense','#06b6d4','zap'),
    (NEW.id,'Airtime & Data','expense','#8b5cf6','smartphone'),
    (NEW.id,'Shopping','expense','#ec4899','shopping-bag'),
    (NEW.id,'Health','expense','#f43f5e','heart-pulse'),
    (NEW.id,'Entertainment','expense','#a855f7','clapperboard'),
    (NEW.id,'Fees & Charges','expense','#94a3b8','receipt'),
    (NEW.id,'Loan Repayment','expense','#dc2626','landmark'),
    (NEW.id,'Investment','transfer','#14b8a6','trending-up'),
    (NEW.id,'Transfer','transfer','#64748b','arrow-left-right'),
    (NEW.id,'Other','expense','#6b7280','circle');
  RETURN NEW;
END $$;

CREATE TRIGGER seed_categories_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.tg_seed_user_categories();

-- ============ RLS ============
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- accounts
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- categories
CREATE POLICY "own categories select" ON public.categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own categories insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own categories update" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own categories delete" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "own txn select" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own txn insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own txn update" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own txn delete" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- audit_log: read-only to user
CREATE POLICY "own audit select" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

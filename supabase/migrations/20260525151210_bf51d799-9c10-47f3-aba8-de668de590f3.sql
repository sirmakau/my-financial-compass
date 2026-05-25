-- Food advisor tables
CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  typical_qty text,
  actual_cost numeric NOT NULL DEFAULT 0,
  is_home_cooked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own foods select" ON public.foods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own foods insert" ON public.foods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own foods update" ON public.foods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own foods delete" ON public.foods FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.meal_combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  meal_type text NOT NULL,
  category text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_combos_meal_type_check CHECK (meal_type IN ('breakfast','lunch','supper')),
  CONSTRAINT meal_combos_category_check CHECK (category IN ('survival','fast','healthy','luxury','street','gym'))
);

ALTER TABLE public.meal_combos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own combos select" ON public.meal_combos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own combos insert" ON public.meal_combos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own combos update" ON public.meal_combos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own combos delete" ON public.meal_combos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_foods_user ON public.foods(user_id);
CREATE INDEX idx_combos_user ON public.meal_combos(user_id);

CREATE OR REPLACE FUNCTION public.ensure_food_seed(p_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.foods WHERE user_id = p_user_id) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.foods(user_id, name, unit_price, typical_qty, actual_cost, is_home_cooked) VALUES
    (p_user_id,'Mandazi',10,'3',30,false),
    (p_user_id,'Chapati',20,'2',40,false),
    (p_user_id,'Egg',20,'1',20,false),
    (p_user_id,'Sukuma Wiki',20,'2 bunches',20,false),
    (p_user_id,'Spinach',10,'1 bunch',10,false),
    (p_user_id,'Beans',40,'1 serving',40,false),
    (p_user_id,'Ndengu',40,'1 cup',40,false),
    (p_user_id,'Kamande',0,'1 serving',40,true),
    (p_user_id,'Ugali',0,'1 serving',0,true),
    (p_user_id,'Noodles',40,'1 packet',40,false),
    (p_user_id,'Smokie',40,'1',40,false),
    (p_user_id,'Sausage',50,'1',50,false),
    (p_user_id,'Mutura',50,'1 serving',50,false),
    (p_user_id,'Chips',130,'1 pack',130,false),
    (p_user_id,'Chicken',300,'1 serving',300,false),
    (p_user_id,'Nyama Choma',500,'1 serving',500,false);

  INSERT INTO public.meal_combos(user_id, name, meal_type, category, cost, items) VALUES
    -- Breakfast
    (p_user_id,'Tea + 3 Mandazis','breakfast','survival',30,'["Tea","Mandazi"]'),
    (p_user_id,'Tea + 2 Chapatis','breakfast','survival',40,'["Tea","Chapati"]'),
    (p_user_id,'Egg + 2 Chapatis','breakfast','gym',60,'["Egg","Chapati"]'),
    (p_user_id,'Tea + Sweet Potatoes','breakfast','healthy',50,'["Tea","Sweet Potatoes"]'),
    (p_user_id,'Tea + Arrowroots','breakfast','healthy',50,'["Tea","Arrowroots"]'),
    (p_user_id,'Noodles + Egg','breakfast','fast',60,'["Noodles","Egg"]'),
    (p_user_id,'Smokie + Chapati','breakfast','street',60,'["Smokie","Chapati"]'),
    (p_user_id,'Sausage + Chapati','breakfast','street',70,'["Sausage","Chapati"]'),
    (p_user_id,'Tea + Mandazi + Egg','breakfast','gym',50,'["Tea","Mandazi","Egg"]'),
    -- Lunch
    (p_user_id,'Ugali + Sukuma','lunch','survival',20,'["Ugali","Sukuma Wiki"]'),
    (p_user_id,'Ugali + Spinach','lunch','survival',10,'["Ugali","Spinach"]'),
    (p_user_id,'Ugali + Beans','lunch','healthy',40,'["Ugali","Beans"]'),
    (p_user_id,'Ugali + Ndengu','lunch','healthy',40,'["Ugali","Ndengu"]'),
    (p_user_id,'Ugali + Kamande','lunch','healthy',40,'["Ugali","Kamande"]'),
    (p_user_id,'Ugali + Beef Stew','lunch','luxury',150,'["Ugali","Beef Stew"]'),
    (p_user_id,'Rice + Beans','lunch','healthy',80,'["Rice","Beans"]'),
    (p_user_id,'Rice + Ndengu','lunch','healthy',80,'["Rice","Ndengu"]'),
    (p_user_id,'Githeri + Avocado','lunch','healthy',70,'["Githeri","Avocado"]'),
    (p_user_id,'Chips + Smokie','lunch','street',170,'["Chips","Smokie"]'),
    (p_user_id,'Chips + Sausage','lunch','street',180,'["Chips","Sausage"]'),
    (p_user_id,'Tilapia + Ugali','lunch','luxury',200,'["Tilapia","Ugali"]'),
    (p_user_id,'Pilau','lunch','luxury',200,'["Pilau"]'),
    (p_user_id,'Chicken + Chapati','lunch','luxury',340,'["Chicken","Chapati"]'),
    (p_user_id,'Nyama Choma + Ugali','lunch','luxury',500,'["Nyama Choma","Ugali"]'),
    -- Supper
    (p_user_id,'Ugali + Sukuma (Supper)','supper','survival',20,'["Ugali","Sukuma Wiki"]'),
    (p_user_id,'Ugali + Omena','supper','healthy',60,'["Ugali","Omena"]'),
    (p_user_id,'Chapati + Beans','supper','healthy',80,'["Chapati","Beans"]'),
    (p_user_id,'Chapati + Ndengu','supper','healthy',80,'["Chapati","Ndengu"]'),
    (p_user_id,'Noodles + Sausage','supper','fast',90,'["Noodles","Sausage"]'),
    (p_user_id,'Noodles + Egg (Supper)','supper','fast',60,'["Noodles","Egg"]'),
    (p_user_id,'Smokie Pasua','supper','street',40,'["Smokie"]'),
    (p_user_id,'Mutura','supper','street',50,'["Mutura"]'),
    (p_user_id,'Tea + Mandazis (Supper)','supper','survival',30,'["Tea","Mandazi"]'),
    (p_user_id,'Sweet Potatoes + Tea','supper','healthy',50,'["Sweet Potatoes","Tea"]');

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END $$;
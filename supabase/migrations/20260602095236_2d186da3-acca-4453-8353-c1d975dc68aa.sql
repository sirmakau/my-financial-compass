
CREATE OR REPLACE FUNCTION public.seed_meal_combos_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  DELETE FROM public.meal_combos WHERE user_id = p_user_id;

  INSERT INTO public.meal_combos(user_id, name, meal_type, category, cost, items) VALUES
    -- BREAKFAST
    (p_user_id,'Tea + 3 Mandazis','breakfast','survival',30,'["Tea","Mandazi"]'),
    (p_user_id,'Tea + 2 Chapatis','breakfast','survival',40,'["Tea","Chapati"]'),
    (p_user_id,'Egg + 2 Chapatis','breakfast','gym',60,'["Egg","Chapati"]'),
    (p_user_id,'Tea + Sweet Potatoes','breakfast','healthy',50,'["Tea","Sweet Potatoes"]'),
    (p_user_id,'Tea + Arrowroots','breakfast','healthy',50,'["Tea","Arrowroots"]'),
    (p_user_id,'Noodles','breakfast','fast',40,'["Noodles"]'),
    (p_user_id,'Noodles + Egg','breakfast','fast',60,'["Noodles","Egg"]'),
    (p_user_id,'Smokie + Chapati','breakfast','street',80,'["Smokie","Chapati"]'),
    (p_user_id,'Sausage + Chapati','breakfast','street',90,'["Sausage","Chapati"]'),
    (p_user_id,'Tea + 3 Mandazis + Egg','breakfast','gym',50,'["Tea","Mandazi","Egg"]'),
    (p_user_id,'Tea + Bread','breakfast','survival',65,'["Tea","Bread"]'),

    -- LUNCH: UGALI
    (p_user_id,'Ugali + Sukuma','lunch','survival',20,'["Ugali","Sukuma Wiki"]'),
    (p_user_id,'Ugali + Spinach','lunch','survival',20,'["Ugali","Spinach"]'),
    (p_user_id,'Ugali + Beans','lunch','healthy',40,'["Ugali","Beans"]'),
    (p_user_id,'Ugali + Ndengu','lunch','healthy',40,'["Ugali","Ndengu"]'),
    (p_user_id,'Ugali + Kamande','lunch','healthy',40,'["Ugali","Kamande"]'),
    (p_user_id,'Ugali + Omena','lunch','healthy',60,'["Ugali","Omena"]'),
    (p_user_id,'Ugali + Beef','lunch','luxury',150,'["Ugali","Beef"]'),
    (p_user_id,'Ugali + Chicken Soup','lunch','luxury',250,'["Ugali","Chicken Soup"]'),
    (p_user_id,'Ugali + Tilapia','lunch','luxury',200,'["Ugali","Tilapia"]'),
    (p_user_id,'Ugali + Nyama Choma','lunch','luxury',500,'["Ugali","Nyama Choma"]'),
    (p_user_id,'Ugali + Beans + Sukuma','lunch','healthy',60,'["Ugali","Beans","Sukuma Wiki"]'),
    (p_user_id,'Ugali + Ndengu + Sukuma','lunch','healthy',60,'["Ugali","Ndengu","Sukuma Wiki"]'),
    (p_user_id,'Ugali + Kamande + Sukuma','lunch','healthy',60,'["Ugali","Kamande","Sukuma Wiki"]'),
    (p_user_id,'Ugali + 2 Eggs','lunch','gym',40,'["Ugali","Egg","Egg"]'),

    -- LUNCH: RICE
    (p_user_id,'Rice + Sukuma','lunch','survival',20,'["Rice","Sukuma Wiki"]'),
    (p_user_id,'Rice + Spinach','lunch','survival',10,'["Rice","Spinach"]'),
    (p_user_id,'Rice + Beans','lunch','healthy',40,'["Rice","Beans"]'),
    (p_user_id,'Rice + Ndengu','lunch','healthy',40,'["Rice","Ndengu"]'),
    (p_user_id,'Rice + Kamande','lunch','healthy',40,'["Rice","Kamande"]'),
    (p_user_id,'Rice + Egg','lunch','survival',20,'["Rice","Egg"]'),
    (p_user_id,'Rice + 2 Eggs','lunch','gym',40,'["Rice","Egg","Egg"]'),
    (p_user_id,'Rice + Omena','lunch','healthy',60,'["Rice","Omena"]'),
    (p_user_id,'Rice + Beans + Sukuma','lunch','healthy',60,'["Rice","Beans","Sukuma Wiki"]'),
    (p_user_id,'Rice + Ndengu + Sukuma','lunch','healthy',60,'["Rice","Ndengu","Sukuma Wiki"]'),
    (p_user_id,'Rice + Kamande + Sukuma','lunch','healthy',60,'["Rice","Kamande","Sukuma Wiki"]'),
    (p_user_id,'Rice + Beef','lunch','luxury',150,'["Rice","Beef"]'),
    (p_user_id,'Rice + Chicken Soup','lunch','luxury',250,'["Rice","Chicken Soup"]'),
    (p_user_id,'Rice + Tilapia','lunch','luxury',200,'["Rice","Tilapia"]'),
    (p_user_id,'Rice + Nyama Choma','lunch','luxury',500,'["Rice","Nyama Choma"]'),
    (p_user_id,'Rice + Mutura','lunch','street',50,'["Rice","Mutura"]'),
    (p_user_id,'Rice + Smokie','lunch','street',40,'["Rice","Smokie"]'),
    (p_user_id,'Rice + Sausage','lunch','street',50,'["Rice","Sausage"]'),

    -- LUXURY LUNCH SPECIALS
    (p_user_id,'Pilau','lunch','luxury',200,'["Pilau"]'),
    (p_user_id,'Mukimo','lunch','luxury',200,'["Mukimo"]'),
    (p_user_id,'Matoke','lunch','luxury',200,'["Matoke"]'),
    (p_user_id,'Chicken + Chapati','lunch','luxury',290,'["Chicken","Chapati"]'),

    -- SUPPER: CHAPATI
    (p_user_id,'Chapati Only','supper','survival',40,'["Chapati"]'),
    (p_user_id,'Chapati + Beans','supper','healthy',80,'["Chapati","Beans"]'),
    (p_user_id,'Chapati + Ndengu','supper','healthy',80,'["Chapati","Ndengu"]'),
    (p_user_id,'Chapati + Kamande','supper','healthy',80,'["Chapati","Kamande"]'),
    (p_user_id,'Chapati + Egg','supper','gym',60,'["Chapati","Egg"]'),
    (p_user_id,'Chapati + 2 Eggs','supper','gym',80,'["Chapati","Egg","Egg"]'),
    (p_user_id,'Chapati + Beef','supper','luxury',190,'["Chapati","Beef"]'),
    (p_user_id,'Chapati + Chicken Soup','supper','luxury',290,'["Chapati","Chicken Soup"]'),
    (p_user_id,'Chapati + Tilapia','supper','luxury',240,'["Chapati","Tilapia"]'),
    (p_user_id,'Chapati + Smokie','supper','street',80,'["Chapati","Smokie"]'),
    (p_user_id,'Chapati + Sausage','supper','street',90,'["Chapati","Sausage"]'),
    (p_user_id,'Chapati + Mutura','supper','street',90,'["Chapati","Mutura"]'),

    -- SUPPER: ROOT CROPS
    (p_user_id,'Sweet Potatoes','supper','healthy',50,'["Sweet Potatoes"]'),
    (p_user_id,'Arrowroots','supper','healthy',50,'["Arrowroots"]'),
    (p_user_id,'Sweet Potatoes + Egg','supper','gym',70,'["Sweet Potatoes","Egg"]'),
    (p_user_id,'Arrowroots + Egg','supper','gym',70,'["Arrowroots","Egg"]'),
    (p_user_id,'Sweet Potatoes + Tea','supper','healthy',50,'["Sweet Potatoes","Tea"]'),
    (p_user_id,'Arrowroots + Tea','supper','healthy',50,'["Arrowroots","Tea"]'),

    -- SUPPER: NOODLES
    (p_user_id,'Noodles (Supper)','supper','fast',40,'["Noodles"]'),
    (p_user_id,'Noodles + Egg (Supper)','supper','fast',60,'["Noodles","Egg"]'),
    (p_user_id,'Noodles + 2 Eggs','supper','fast',80,'["Noodles","Egg","Egg"]'),
    (p_user_id,'Noodles + Smokie','supper','fast',80,'["Noodles","Smokie"]'),
    (p_user_id,'Noodles + Sausage','supper','fast',90,'["Noodles","Sausage"]'),
    (p_user_id,'Noodles + Mutura','supper','fast',90,'["Noodles","Mutura"]'),

    -- SUPPER: STREET
    (p_user_id,'Chips','supper','street',130,'["Chips"]'),
    (p_user_id,'Chips + Smokie','supper','street',170,'["Chips","Smokie"]'),
    (p_user_id,'Chips + Sausage','supper','street',180,'["Chips","Sausage"]'),
    (p_user_id,'Chips + Egg','supper','street',150,'["Chips","Egg"]'),
    (p_user_id,'Chips + Mutura','supper','street',180,'["Chips","Mutura"]'),
    (p_user_id,'Smokie Pasua','supper','street',40,'["Smokie"]'),
    (p_user_id,'Sausage','supper','street',50,'["Sausage"]'),
    (p_user_id,'Mutura','supper','street',50,'["Mutura"]'),
    (p_user_id,'Samosa','supper','street',60,'["Samosa"]');

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END $$;

-- Rewrite ensure_food_seed to use the shared seeder so new users get the new list
CREATE OR REPLACE FUNCTION public.ensure_food_seed(p_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_food_count int;
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_food_count FROM public.foods WHERE user_id = p_user_id;
  IF v_food_count = 0 THEN
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
  END IF;

  RETURN public.seed_meal_combos_for_user(p_user_id);
END $$;

-- Re-seed combos for ALL existing users so they get the refreshed catalog
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.meal_combos LOOP
    PERFORM public.seed_meal_combos_for_user(u.user_id);
  END LOOP;
END $$;

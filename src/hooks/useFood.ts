import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Food = {
  id: string;
  user_id: string;
  name: string;
  unit_price: number;
  typical_qty: string | null;
  actual_cost: number;
  is_home_cooked: boolean;
  created_at: string;
};

export type MealType = "breakfast" | "lunch" | "supper";
export type ComboCategory = "survival" | "fast" | "healthy" | "luxury" | "street" | "gym";

export type MealCombo = {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType;
  category: ComboCategory;
  cost: number;
  items: string[];
  created_at: string;
};

export const useFoods = () => {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["foods", user?.id],
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await (supabase as any)
        .from("foods")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });
};

export const useCombos = () => {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["meal_combos", user?.id],
    queryFn: async (): Promise<MealCombo[]> => {
      const { data, error } = await (supabase as any)
        .from("meal_combos")
        .select("*")
        .order("cost");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        items: Array.isArray(r.items) ? r.items : [],
      })) as MealCombo[];
    },
  });
};

export const useEnsureFoodSeed = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("ensure_food_seed", { p_user_id: user.id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      if (n && n > 0) {
        qc.invalidateQueries({ queryKey: ["foods"] });
        qc.invalidateQueries({ queryKey: ["meal_combos"] });
      }
    },
  });
};

export const useLogMealAsTxn = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { combo: MealCombo; account_id: string }) => {
      if (!user) throw new Error("Not authenticated");
      // Find Food & Drinks category
      const { data: cats } = await supabase
        .from("categories")
        .select("id,name")
        .eq("name", "Food & Drinks")
        .limit(1);
      const category_id = cats?.[0]?.id ?? null;

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: input.account_id,
        category_id,
        amount: -Math.abs(input.combo.cost),
        occurred_at: new Date().toISOString(),
        description: input.combo.name,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

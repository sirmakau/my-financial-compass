import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { outbox } from "@/lib/outbox";

const isNetworkError = (err: unknown) => {
  const msg = (err as any)?.message ?? String(err ?? "");
  return /Failed to fetch|NetworkError|network|timeout|abort|fetch|ECONN|503|502|504/i.test(msg)
    || (typeof navigator !== "undefined" && navigator.onLine === false);
};

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type AccountType = Database["public"]["Enums"]["account_type"];
export type CategoryKind = Database["public"]["Enums"]["category_kind"];
export type TxnSource = Database["public"]["Enums"]["txn_source"];

export const useAccounts = () => {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["accounts", user?.id],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCategories = () => {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["categories", user?.id],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useTransactions = (limit = 200) => {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["transactions", user?.id, limit],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateAccount = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; type: AccountType; balance?: number; interest_rate?: number | null; subtype?: string | null; notes?: string | null; credit_limit?: number | null }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: input.name,
          type: input.type,
          balance: input.balance ?? 0,
          interest_rate: input.interest_rate ?? null,
          subtype: input.subtype ?? null,
          notes: input.notes ?? null,
          credit_limit: input.credit_limit ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useDeleteAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useAccrueInterest = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.rpc("accrue_interest_for_account", { p_account_id: accountId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

export const useEnsureCategories = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.rpc("ensure_user_categories", { p_user_id: user.id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

export const useGenerateInsights = () => {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      // For now, mock insights. In real, call AI gateway with data summary
      const insights = [
        "Your income has increased by 15% this month compared to last month.",
        "Consider reviewing your entertainment expenses, which are 20% higher than average.",
        "Your investment in MMF is performing well with accrued interest.",
      ];
      return insights;
    },
  });
};

export interface TxnInput {
  account_id: string;
  category_id?: string | null;
  amount: number;
  occurred_at: string;
  description?: string | null;
  counterparty?: string | null;
  mpesa_ref?: string | null;
  source?: TxnSource;
  raw_message?: string | null;
  status?: "pending" | "completed";
  metadata?: any;
}

export const useCreateTransaction = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: TxnInput) => {
      if (!user) throw new Error("Not authenticated");
      const row = { user_id: user.id, source: "manual" as TxnSource, ...input };
      try {
        const { data, error } = await supabase.from("transactions").insert(row).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        const entry = outbox.enqueue(user.id, { userId: user.id, kind: "insert", table: "transactions", payload: row });
        // Optimistic cache row
        const optimistic: any = {
          id: entry.id,
          created_at: new Date().toISOString(),
          completed_at: input.status === "pending" ? null : new Date().toISOString(),
          status: input.status ?? "completed",
          _pending: true,
          ...row,
        };
        qc.setQueriesData({ queryKey: ["transactions"] }, (old: any) => (Array.isArray(old) ? [optimistic, ...old] : old));
        return optimistic;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useCreateTransactionsBatch = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rows: TxnInput[]) => {
      if (!user) throw new Error("Not authenticated");
      const payload = rows.map((r) => ({ user_id: user.id, source: "parsed" as TxnSource, ...r }));
      try {
        const { data, error } = await supabase.from("transactions").insert(payload).select();
        if (error) throw error;
        return data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        outbox.enqueue(user.id, { userId: user.id, kind: "insert", table: "transactions", payload });
        return payload;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useUpdateTransaction = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Transaction> }) => {
      if (!user) throw new Error("Not authenticated");
      // Optimistic
      qc.setQueriesData({ queryKey: ["transactions"] }, (old: any) =>
        Array.isArray(old) ? old.map((t) => (t.id === input.id ? { ...t, ...input.patch } : t)) : old,
      );
      try {
        const { error } = await supabase.from("transactions").update(input.patch as any).eq("id", input.id);
        if (error) throw error;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        outbox.enqueue(user.id, {
          userId: user.id,
          kind: "update",
          table: "transactions",
          payload: { match: { id: input.id }, patch: input.patch },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useDeleteTransaction = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      // Optimistic remove
      qc.setQueriesData({ queryKey: ["transactions"] }, (old: any) =>
        Array.isArray(old) ? old.filter((t: any) => t.id !== id) : old,
      );
      // If it's a local-only row, just drop the outbox insert if present.
      if (id.startsWith("local-") && user) {
        outbox.remove(user.id, id);
        return;
      }
      try {
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        if (!isNetworkError(err) || !user) throw err;
        outbox.enqueue(user.id, { userId: user.id, kind: "delete", table: "transactions", payload: { id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useMarkTransactionDone = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const patch = { status: "completed" as const, completed_at: new Date().toISOString() };
      qc.setQueriesData({ queryKey: ["transactions"] }, (old: any) =>
        Array.isArray(old) ? old.map((t: any) => (t.id === id ? { ...t, ...patch } : t)) : old,
      );
      try {
        const { error } = await supabase.from("transactions").update(patch).eq("id", id);
        if (error) throw error;
      } catch (err) {
        if (!isNetworkError(err) || !user) throw err;
        outbox.enqueue(user.id, { userId: user.id, kind: "update", table: "transactions", payload: { match: { id }, patch } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; kind: CategoryKind }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("categories")
        .insert({ user_id: user.id, name: input.name.trim(), kind: input.kind })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

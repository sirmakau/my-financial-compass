// Simple localStorage outbox for queued backend writes when offline / degraded.
import { supabase } from "@/integrations/supabase/client";

export type OutboxKind = "insert" | "update" | "delete";
export type OutboxTable = "transactions" | "categories" | "accounts";

export interface OutboxEntry {
  id: string; // local uuid
  userId: string;
  kind: OutboxKind;
  table: OutboxTable;
  payload: any; // insert: row(s); update: { match, patch }; delete: { id }
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const KEY = (userId: string) => `finance-outbox-v1:${userId}`;

export const outbox = {
  read(userId: string): OutboxEntry[] {
    try {
      const raw = localStorage.getItem(KEY(userId));
      return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
    } catch {
      return [];
    }
  },
  write(userId: string, entries: OutboxEntry[]) {
    try {
      localStorage.setItem(KEY(userId), JSON.stringify(entries));
      window.dispatchEvent(new CustomEvent("outbox:change", { detail: { userId, count: entries.length } }));
    } catch {
      /* quota */
    }
  },
  enqueue(userId: string, entry: Omit<OutboxEntry, "id" | "createdAt" | "attempts">) {
    const all = outbox.read(userId);
    const e: OutboxEntry = {
      ...entry,
      id: `local-${crypto.randomUUID()}`,
      createdAt: Date.now(),
      attempts: 0,
    };
    all.push(e);
    outbox.write(userId, all);
    return e;
  },
  remove(userId: string, id: string) {
    outbox.write(userId, outbox.read(userId).filter((e) => e.id !== id));
  },
  update(userId: string, id: string, patch: Partial<OutboxEntry>) {
    outbox.write(
      userId,
      outbox.read(userId).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  },
  clear(userId: string) {
    try {
      localStorage.removeItem(KEY(userId));
      window.dispatchEvent(new CustomEvent("outbox:change", { detail: { userId, count: 0 } }));
    } catch {
      /* noop */
    }
  },
  count(userId: string): number {
    return outbox.read(userId).length;
  },
};

const MAX_ATTEMPTS = 8;

async function runEntry(e: OutboxEntry): Promise<void> {
  if (e.kind === "insert") {
    const rows = Array.isArray(e.payload) ? e.payload : [e.payload];
    const { error } = await supabase.from(e.table as any).insert(rows);
    if (error) throw error;
    return;
  }
  if (e.kind === "update") {
    const { match, patch } = e.payload as { match: Record<string, any>; patch: Record<string, any> };
    let q = supabase.from(e.table as any).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  if (e.kind === "delete") {
    const { id } = e.payload as { id: string };
    const { error } = await supabase.from(e.table as any).delete().eq("id", id);
    if (error) throw error;
    return;
  }
}

export async function flushOutbox(userId: string): Promise<{ ok: number; failed: number; remaining: number }> {
  const entries = outbox.read(userId);
  let ok = 0;
  let failed = 0;
  for (const e of entries) {
    try {
      await runEntry(e);
      outbox.remove(userId, e.id);
      ok++;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const attempts = e.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Give up but keep in queue flagged; user can inspect/clear.
        outbox.update(userId, e.id, { attempts, lastError: msg });
      } else {
        outbox.update(userId, e.id, { attempts, lastError: msg });
      }
      failed++;
      // stop early on likely-network errors to avoid hammering
      if (/network|fetch|timeout|Failed to fetch/i.test(msg)) break;
    }
  }
  return { ok, failed, remaining: outbox.count(userId) };
}

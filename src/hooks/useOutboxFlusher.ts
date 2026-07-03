import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { flushOutbox, outbox } from "@/lib/outbox";
import { toast } from "sonner";

export function useOutboxFlusher() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refreshCount = useCallback(() => {
    if (!user) {
      setPending(0);
      return;
    }
    setPending(outbox.count(user.id));
  }, [user]);

  const flush = useCallback(async () => {
    if (!user || flushing) return;
    if (outbox.count(user.id) === 0) return;
    setFlushing(true);
    try {
      const res = await flushOutbox(user.id);
      if (res.ok > 0) {
        toast.success(`Synced ${res.ok} change${res.ok > 1 ? "s" : ""}`);
        qc.invalidateQueries();
      }
      if (res.remaining > 0 && res.failed > 0 && res.ok === 0) {
        // Silent — will retry on interval / online event.
      }
      refreshCount();
    } finally {
      setFlushing(false);
    }
  }, [user, flushing, qc, refreshCount]);

  useEffect(() => {
    refreshCount();
    const onChange = () => refreshCount();
    window.addEventListener("outbox:change", onChange);
    return () => window.removeEventListener("outbox:change", onChange);
  }, [refreshCount]);

  useEffect(() => {
    if (!user) return;
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if (outbox.count(user.id) > 0) flush();
    }, 20_000);
    // Initial attempt on mount
    flush();
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [user, flush]);

  return { pending, flushing, flush };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BackendStatus = "online" | "offline" | "degraded" | "checking";

const PING_INTERVAL_MS = 25_000;

async function ping(): Promise<BackendStatus> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  try {
    // Cheap head request against a public table with RLS — if it errors on network, we know.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const { error } = await supabase.from("accounts").select("id", { head: true, count: "exact" }).limit(1);
    clearTimeout(timer);
    if (error) {
      if (/fetch|network|Failed/i.test(error.message)) return "offline";
      return "degraded";
    }
    return "online";
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/abort|network|fetch/i.test(msg)) return "offline";
    return "degraded";
  }
}

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const s = await ping();
      if (!alive) return;
      setStatus(s);
      timer = setTimeout(check, PING_INTERVAL_MS);
    };

    const onOnline = () => check();
    const onOffline = () => setStatus("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    check();

    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return status;
}

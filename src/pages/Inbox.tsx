import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Inbox as InboxIcon, KeyRound, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

const ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sms-webhook`;

const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

export default function Inbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const inbox = useQuery({
    queryKey: ["sms_inbox"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_inbox").select("*").eq("status", "pending").order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const key = useQuery({
    queryKey: ["sms_key", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("sms_webhook_keys").select("token").maybeSingle();
      return data?.token ?? null;
    },
  });

  const genKey = async () => {
    if (!user) return;
    const { error } = await supabase.from("sms_webhook_keys").upsert({ user_id: user.id, token: randomToken() });
    if (error) return toast.error("Could not create key");
    toast.success(key.data ? "Key replaced — update your phone" : "Key created");
    qc.invalidateQueries({ queryKey: ["sms_key"] });
  };

  const dismiss = async (id: string) => {
    await supabase.from("sms_inbox").update({ status: "dismissed", processed_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["sms_inbox"] });
  };

  const review = (ids: string[]) => nav(`/import?inbox=${ids.join(",")}`);
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };
  const items = inbox.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">SMS Inbox</h1>
        <p className="text-sm text-muted-foreground">Messages sent automatically from your phone wait here until you review and approve them.</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Waiting for review ({items.length})</h2>
          {items.length > 0 && <Button size="sm" onClick={() => review(items.map((i) => i.id))}><Check className="mr-1 h-4 w-4" />Review all</Button>}
        </div>
        {inbox.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : inbox.error ? <div className="text-sm text-destructive">Couldn't load inbox. <Button variant="link" size="sm" onClick={() => inbox.refetch()}>Retry</Button></div>
          : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <InboxIcon className="h-8 w-8" />
              No new messages. Once your phone is set up below, new M-Pesa SMS will show up here within seconds.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{new Date(m.received_at).toLocaleString("en-KE")}{m.sender ? ` · ${m.sender}` : ""}</p>
                    <p className="text-sm font-mono break-words">{m.body}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => review([m.id])}>Review</Button>
                  <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => dismiss(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" />Phone setup (MacroDroid / Tasker)</h2>
        {key.data ? (
          <>
            <label className="text-xs text-muted-foreground">Web address</label>
            <div className="flex gap-2"><Input readOnly value={ENDPOINT} className="font-mono text-xs" /><Button size="icon" variant="outline" aria-label="Copy address" onClick={() => copy(ENDPOINT)}><Copy className="h-4 w-4" /></Button></div>
            <label className="text-xs text-muted-foreground">Your private key (keep secret)</label>
            <div className="flex gap-2"><Input readOnly value={key.data} className="font-mono text-xs" /><Button size="icon" variant="outline" aria-label="Copy key" onClick={() => copy(key.data!)}><Copy className="h-4 w-4" /></Button></div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>In MacroDroid add trigger <b>SMS Received</b> from sender <b>MPESA</b>.</li>
              <li>Add action <b>HTTP Request</b> → POST to the web address above.</li>
              <li>Add header <code>x-ledger-key</code> with your key.</li>
              <li>Body (JSON): <code>{`{"message": "[sms_message]", "sender": "[sms_number]"}`}</code></li>
            </ol>
            <Button variant="outline" size="sm" onClick={genKey}>Replace key</Button>
          </>
        ) : <Button onClick={genKey}>Create my private key</Button>}
      </Card>
    </div>
  );
}

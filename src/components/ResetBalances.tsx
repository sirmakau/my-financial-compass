import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RotateCcw, Loader2 } from "lucide-react";
import { formatKES } from "@/lib/format";
import { toast } from "sonner";

type SnapAcct = { name: string; type: string; balance: number };

export function ResetBalances() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const snaps = useQuery({
    queryKey: ["account_snapshots"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_snapshots").select("*").order("snapshot_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const reset = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("reset_user_accounts", { p_note: note || null });
    setBusy(false);
    if (error) return toast.error("Could not reset balances");
    toast.success("Balances reset — snapshot saved");
    setNote("");
    qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><RotateCcw className="h-4 w-4" /> Reset balances</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset all account balances</DialogTitle>
          <DialogDescription>
            Current balances are saved to a snapshot, then every account is set to 0. Transactions and history are kept.
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Snapshot note" />
        <div className="max-h-60 space-y-2 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Past snapshots</p>
          {snaps.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {snaps.data?.length === 0 && <p className="text-xs text-muted-foreground">No snapshots yet.</p>}
          {snaps.data?.map((s) => (
            <div key={s.id} className="rounded-md border border-border p-2 text-xs">
              <div className="flex justify-between font-medium">
                <span>{new Date(s.snapshot_at).toLocaleString()}</span>
                <span className="font-mono">{formatKES(Number(s.total_net_worth))}</span>
              </div>
              {s.note && <p className="text-muted-foreground">{s.note}</p>}
              {(s.accounts_data as SnapAcct[]).map((a) => (
                <div key={a.name} className="flex justify-between text-muted-foreground">
                  <span>{a.name}</span><span className="font-mono">{formatKES(Number(a.balance))}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={busy} onClick={reset}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Snapshot & reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

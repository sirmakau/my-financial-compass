import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useCategories, useCreateTransactionsBatch } from "@/hooks/useFinance";
import { formatKES } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertCircle, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Tolerance (KES) for matching SMS "Total Fuliza outstanding" with our computed debt.
const FULIZA_TOLERANCE = 1.0;

interface ParsedTxn {
  mpesa_ref: string | null;
  type: string;
  amount: number;
  counterparty: string | null;
  occurred_at: string;
  description: string;
  suggested_category: string;
  raw_message: string;
  confidence: number;
  target?: "mpesa" | "fuliza";
  fuliza_outstanding?: number | null;
  notes?: string;
}

interface Row extends ParsedTxn {
  _id: string;
  category_id: string | null;
  include: boolean;
}

const SAMPLE = `QGH7X8K9LM Confirmed. Ksh1,250.00 sent to JOHN DOE 0712345678 on 2/5/26 at 10:32 AM. New M-PESA balance is Ksh4,820.00. Transaction cost, Ksh22.00.

QGH7Y2P3QR Confirmed. You have received Ksh5,000.00 from JANE SMITH 0723456789 on 2/5/26 at 2:14 PM. New M-PESA balance is Ksh9,820.00.`;

const ImportSMS = () => {
  const { data: accounts = [] } = useAccounts();
  const { data: cats = [] } = useCategories();
  const batch = useCreateTransactionsBatch();

  const [text, setText] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const mpesaAccounts = useMemo(() => accounts.filter((a) => a.type === "cash"), [accounts]);
  const fulizaAccount = useMemo(
    () => accounts.find((a) => a.type === "debt" && (/fuliza/i.test(a.name) || /fuliza/i.test(a.subtype ?? ""))),
    [accounts],
  );

  const findCategoryIdByName = (name: string): string | null => {
    const exact = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return exact?.id ?? cats.find((c) => c.name === "Other")?.id ?? null;
  };

  const parse = async () => {
    if (!text.trim()) return toast.error("Paste M-Pesa messages first");
    if (!accountId) return toast.error("Select the M-Pesa account to import into");
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-mpesa", {
        body: { messages: text, categories: cats.map((c) => c.name) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: ParsedTxn[] = data?.transactions ?? [];
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      setErrors(Array.isArray(data?.errors) ? data.errors : []);
      if (parsed.length === 0) {
        toast.warning("No valid transactions parsed");
        setRows([]);
        return;
      }
      setRows(parsed.map((p, i) => ({
        ...p,
        _id: `${i}-${p.mpesa_ref ?? Math.random()}`,
        category_id: findCategoryIdByName(p.suggested_category),
        include: true,
      })));
      setFulizaAck(false);
      toast.success(`Parsed ${parsed.length} transaction${parsed.length > 1 ? "s" : ""}. Review below.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const confirmAll = async () => {
    let selected = rows.filter((r) => r.include);
    if (selected.length === 0) return toast.error("Nothing selected");
    if (fulizaCheck?.mismatch && !fulizaAck) {
      return toast.error("Fuliza outstanding mismatch — review and acknowledge before saving.");
    }

    // Pre-check duplicates by mpesa_ref to keep imports idempotent across pages.
    const refs = selected.map((r) => r.mpesa_ref).filter((x): x is string => !!x);
    if (refs.length > 0) {
      const { data: existing, error: dupErr } = await supabase
        .from("transactions")
        .select("mpesa_ref")
        .in("mpesa_ref", refs);
      if (dupErr) return toast.error(dupErr.message);
      const dupSet = new Set((existing ?? []).map((e) => e.mpesa_ref));
      const skipped = selected.filter((r) => r.mpesa_ref && dupSet.has(r.mpesa_ref));
      if (skipped.length > 0) {
        selected = selected.filter((r) => !r.mpesa_ref || !dupSet.has(r.mpesa_ref));
        toast.warning(`Skipped ${skipped.length} duplicate${skipped.length > 1 ? "s" : ""} already imported.`);
        setRows((rs) => rs.map((r) => (r.mpesa_ref && dupSet.has(r.mpesa_ref) ? { ...r, include: false } : r)));
      }
      if (selected.length === 0) return;
    }

    try {
      await batch.mutateAsync(selected.map((r) => {
        const useFuliza = r.target === "fuliza" && fulizaAccount;
        return {
          account_id: useFuliza ? fulizaAccount!.id : accountId,
          category_id: r.category_id,
          amount: r.amount,
          occurred_at: r.occurred_at,
          description: r.description,
          counterparty: r.counterparty,
          mpesa_ref: r.mpesa_ref,
          raw_message: r.raw_message,
        };
      }));
      toast.success(`Imported ${selected.length} transaction${selected.length > 1 ? "s" : ""}`);
      setRows([]); setText("");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("duplicate") || msg.includes("uniq_mpesa_ref")) {
        toast.error("Some transactions already exist (duplicate M-Pesa ref). Remove them and retry.");
      } else {
        toast.error(msg);
      }
    }
  };

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  // Reconcile SMS-reported "Total Fuliza outstanding" vs our computed debt.
  // Computed outstanding = current debt + (borrows added) - (repays applied) for included rows.
  // On the fuliza account, debt is stored as NEGATIVE balance, borrows are negative amounts,
  // repays are positive amounts. So: outstanding = -(balance + sum(included fuliza amounts)).
  const fulizaCheck = useMemo(() => {
    const fulizaRows = rows.filter((r) => r.include && r.target === "fuliza");
    if (fulizaRows.length === 0) return null;

    // Latest reported outstanding from the SMS batch (use the max fuliza_outstanding present —
    // multiple split rows from one SMS share the same value; multiple SMS use the latest by time).
    const reportedRows = fulizaRows.filter((r) => typeof r.fuliza_outstanding === "number" && r.fuliza_outstanding !== null);
    if (reportedRows.length === 0) return null;
    const latest = [...reportedRows].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).pop()!;
    const reported = Number(latest.fuliza_outstanding);

    const currentDebt = fulizaAccount ? -Number(fulizaAccount.balance ?? 0) : 0;
    // Only count fuliza-target rows up to and including the latest reported SMS time.
    const applied = fulizaRows
      .filter((r) => r.occurred_at <= latest.occurred_at)
      .reduce((s, r) => s + Number(r.amount), 0);
    const computed = Math.max(0, currentDebt - applied); // -applied because borrows are negative
    const diff = +(computed - reported).toFixed(2);
    const mismatch = Math.abs(diff) > FULIZA_TOLERANCE;
    return { reported, computed: +computed.toFixed(2), diff, mismatch, hasAccount: !!fulizaAccount };
  }, [rows, fulizaAccount]);

  const [fulizaAck, setFulizaAck] = useState(false);


  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Import M-Pesa SMS</h1>
        <p className="text-sm text-muted-foreground">
          Paste raw M-Pesa messages — AI extracts and categorizes them. You review and confirm before saving.
        </p>
      </header>

      <Card className="border-border/60 p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="space-y-2">
            <Label>Raw M-Pesa SMS</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={SAMPLE}
              className="font-mono-figure text-xs"
            />
            <p className="text-xs text-muted-foreground">Tip: paste multiple messages separated by blank lines.</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Import into account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {mpesaAccounts.length === 0 ? (
                    <SelectItem value="none" disabled>Create a cash account first</SelectItem>
                  ) : mpesaAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={parse} disabled={parsing} className="w-full gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Parse with AI
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setText(SAMPLE)}>
              Try sample
            </Button>
          </div>
        </div>
      </Card>

      {(errors.length > 0 || warnings.length > 0) && (
        <Card className="space-y-2 border-border/60 p-3 text-xs">
          {errors.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="h-4 w-4" /> {errors.length} row{errors.length > 1 ? "s" : ""} rejected
              </div>
              <ul className="ml-6 list-disc text-muted-foreground">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-warning">
                <AlertTriangle className="h-4 w-4" /> {warnings.length} warning{warnings.length > 1 ? "s" : ""}
              </div>
              <ul className="ml-6 list-disc text-muted-foreground">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="overflow-hidden border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm">Review parsed transactions before saving</span>
            </div>
            {rows.some((r) => r.target === "fuliza") && !fulizaAccount && (
              <span className="text-xs text-warning">
                Fuliza rows detected but no Fuliza debt account exists — create one in Accounts to track them separately.
              </span>
            )}
            <Button size="sm" onClick={confirmAll}
              disabled={batch.isPending || (fulizaCheck?.mismatch && !fulizaAck)}
              className="gap-1.5">
              {batch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm & Save ({rows.filter((r) => r.include).length})
            </Button>
          </div>

          {fulizaCheck && (
            <div className={`flex flex-wrap items-start gap-3 border-b border-border/60 p-3 text-xs ${
              fulizaCheck.mismatch ? "bg-warning/10" : "bg-inflow/5"
            }`}>
              {fulizaCheck.mismatch
                ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                : <Check className="mt-0.5 h-4 w-4 shrink-0 text-inflow" />}
              <div className="flex-1 space-y-1">
                <div className="font-medium">
                  Fuliza reconciliation {fulizaCheck.mismatch ? "— mismatch detected" : "— matches SMS"}
                </div>
                <div className="text-muted-foreground">
                  SMS reports outstanding <span className="font-mono-figure">{formatKES(fulizaCheck.reported)}</span>;
                  {" "}computed from your data <span className="font-mono-figure">{formatKES(fulizaCheck.computed)}</span>
                  {" "}(difference <span className="font-mono-figure">{formatKES(fulizaCheck.diff)}</span>).
                  {!fulizaCheck.hasAccount && " No Fuliza debt account exists — create one in Accounts."}
                  {fulizaCheck.mismatch && " Likely cause: a Fuliza-related SMS was missed, a prior import was reverted, or manual edits drifted the balance."}
                </div>
                {fulizaCheck.mismatch && (
                  <label className="mt-1 flex items-center gap-2 text-foreground">
                    <input type="checkbox" checked={fulizaAck} onChange={(e) => setFulizaAck(e.target.checked)} />
                    I’ve reviewed and want to import anyway
                  </label>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left">Keep</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Counterparty</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-left">Category</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => (
                  <tr key={r._id} className={r.include ? "" : "opacity-40"}>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => update(r._id, { include: !r.include })}>
                        {r.include ? <Check className="h-4 w-4 text-inflow" /> : <X className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="datetime-local" className="h-8 w-44 text-xs"
                        value={r.occurred_at.slice(0, 16)}
                        onChange={(e) => update(r._id, { occurred_at: new Date(e.target.value).toISOString() })} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 w-40 text-xs" value={r.counterparty ?? ""}
                        onChange={(e) => update(r._id, { counterparty: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 w-56 text-xs" value={r.description}
                        onChange={(e) => update(r._id, { description: e.target.value })} />
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {r.target === "fuliza" && (
                          <Badge variant="outline" className="text-[10px]">→ Fuliza</Badge>
                        )}
                        {r.notes && <span className="text-[10px] text-warning">{r.notes}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Select value={r.category_id ?? ""} onValueChange={(v) => update(r._id, { category_id: v })}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" step="0.01" className={`h-8 w-28 text-right font-mono-figure text-xs ${r.amount >= 0 ? "text-inflow" : "text-outflow"}`}
                        value={r.amount}
                        onChange={(e) => update(r._id, { amount: parseFloat(e.target.value) || 0 })} />
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{formatKES(r.amount, { signed: true })}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.confidence >= 0.8 ? "default" : r.confidence >= 0.5 ? "secondary" : "outline"}>
                        {Math.round(r.confidence * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ImportSMS;

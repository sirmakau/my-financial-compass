import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccounts, useCategories, useTransactions, useDeleteTransaction, useMarkTransactionDone } from "@/hooks/useFinance";
import { formatKES, formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, Search, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { QuickAddTransaction } from "@/components/QuickAddTransaction";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const Transactions = () => {
  const { data: txns = [], isLoading } = useTransactions(500);
  const { data: accounts = [] } = useAccounts();
  const { data: cats = [] } = useCategories();
  const del = useDeleteTransaction();
  const markDone = useMarkTransactionDone();

  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");

  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const categoryName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Uncategorized";

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (accountId !== "all" && t.account_id !== accountId) return false;
      if (categoryId !== "all" && t.category_id !== categoryId) return false;
      const a = Number(t.amount);
      if (direction === "in" && a < 0) return false;
      if (direction === "out" && a >= 0) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = `${t.description ?? ""} ${t.counterparty ?? ""} ${t.mpesa_ref ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txns, accountId, categoryId, direction, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(urlPage, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const setPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (clamped <= 1) sp.delete("page");
        else sp.set("page", String(clamped));
        return sp;
      },
      { replace: false },
    );
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    if (urlPage !== 1) {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          sp.delete("page");
          return sp;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, accountId, categoryId, direction]);

  // Clamp URL page if it exceeds total
  useEffect(() => {
    if (urlPage > totalPages) {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (totalPages <= 1) sp.delete("page");
          else sp.set("page", String(totalPages));
          return sp;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {txns.length}</p>
        </div>
        <QuickAddTransaction />
      </header>

      <Card className="border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, counterparty, M-Pesa ref…" className="pl-9" />
          </div>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={(v) => setDirection(v as "all" | "in" | "out")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">In & Out</SelectItem>
              <SelectItem value="in">Inflow</SelectItem>
              <SelectItem value="out">Outflow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No transactions match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Counterparty / Description</th>
                  <th className="px-4 py-2.5 text-left">Account</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Source</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageItems.map((t) => {
                  const a = Number(t.amount);
                  const isPending = (t as any).status === "pending";
                  return (
                    <tr key={t.id} className="hover:bg-secondary/20">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(t.occurred_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{t.counterparty || t.description || "—"}</div>
                          {isPending && (
                            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400">
                              Pending
                            </Badge>
                          )}
                        </div>
                        {t.counterparty && t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                        {t.mpesa_ref && <div className="mt-0.5 font-mono-figure text-[10px] text-muted-foreground">{t.mpesa_ref}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">{accountName(t.account_id)}</td>
                      <td className="px-4 py-3 text-xs">{categoryName(t.category_id)}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] capitalize">{t.source}</Badge></td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono-figure font-medium ${a >= 0 ? "text-inflow" : "text-outflow"}`}>
                        {formatKES(a, { signed: true })}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isPending && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-xs text-emerald-400 hover:text-emerald-300"
                              onClick={async () => {
                                if (!confirm("Mark this as received/paid? Account balance will update.")) return;
                                await markDone.mutateAsync(t.id);
                                toast.success("Marked as done");
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={async () => {
                              if (!confirm("Delete this transaction? Account balance will be adjusted.")) return;
                              await del.mutateAsync(t.id);
                              toast.success("Deleted");
                            }}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="font-mono-figure text-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Transactions;

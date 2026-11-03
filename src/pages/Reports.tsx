import { useMemo, useState } from "react";
import { useAccounts, useTransactions, useGenerateInsights } from "@/hooks/useFinance";
import { formatKES } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp } from "lucide-react";

const Reports = () => {
  const { data: accounts = [], isLoading: aL } = useAccounts();
  const { data: txns = [], isLoading: tL } = useTransactions(1000);
  const generate = useGenerateInsights();
  const [insights, setInsights] = useState<string[]>([]);

  const receivables = useMemo(() => {
    return accounts.filter(a => a.type === 'receivable').map(a => {
      const balance = Number(a.balance);
      const lastTxn = txns.filter(t => t.account_id === a.id).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];
      const daysOutstanding = lastTxn ? Math.floor((Date.now() - new Date(lastTxn.occurred_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return { ...a, balance, daysOutstanding };
    });
  }, [accounts, txns]);

  const agingBuckets = useMemo(() => {
    const buckets: Record<'0-30' | '31-60' | '61-90' | '90+', number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const r of receivables) {
      if (r.balance <= 0) continue;
      if (r.daysOutstanding <= 30) buckets['0-30'] += r.balance;
      else if (r.daysOutstanding <= 60) buckets['31-60'] += r.balance;
      else if (r.daysOutstanding <= 90) buckets['61-90'] += r.balance;
      else buckets['90+'] += r.balance;
    }
    return buckets;
  }, [receivables]);

  const handleGenerateInsights = async () => {
    const result = await generate.mutateAsync();
    setInsights(result);
  };

  if (aL || tL) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Reports</h1>
        <p className="text-sm text-muted-foreground">Insights and aging reports</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-border/60 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">0-30 days</div>
          <div className="mt-2 font-mono-figure text-xl font-semibold text-inflow">{formatKES(agingBuckets['0-30'])}</div>
        </Card>
        <Card className="border-border/60 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">31-60 days</div>
          <div className="mt-2 font-mono-figure text-xl font-semibold text-warning">{formatKES(agingBuckets['31-60'])}</div>
        </Card>
        <Card className="border-border/60 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">61-90 days</div>
          <div className="mt-2 font-mono-figure text-xl font-semibold text-outflow">{formatKES(agingBuckets['61-90'])}</div>
        </Card>
        <Card className="border-border/60 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">90+ days</div>
          <div className="mt-2 font-mono-figure text-xl font-semibold text-destructive">{formatKES(agingBuckets['90+'])}</div>
        </Card>
      </div>

      <Card className="border-border/60 p-4">
        <h2 className="mb-3 font-display text-sm font-medium">Receivables Aging</h2>
        {receivables.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No receivables to show</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Account</th>
                  <th className="px-4 py-2.5 text-left">Subtype</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Days Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {receivables.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      {r.subtype && <Badge variant="outline">{r.subtype}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-figure">{formatKES(r.balance)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={r.daysOutstanding > 90 ? "destructive" : r.daysOutstanding > 60 ? "default" : "secondary"}>
                        {r.daysOutstanding}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="border-border/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium">AI Insights</h2>
          <Button size="sm" onClick={handleGenerateInsights} disabled={generate.isPending} className="gap-1.5">
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            Generate
          </Button>
        </div>
        {insights.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Click generate to get AI-powered insights</p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
                {insight}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default Reports;
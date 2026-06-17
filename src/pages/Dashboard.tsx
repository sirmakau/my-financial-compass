import { useMemo, useState } from "react";
import { useAccounts, useTransactions, useCategories } from "@/hooks/useFinance";
import { formatKES } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { QuickAddTransaction } from "@/components/QuickAddTransaction";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, Landmark, HandCoins, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";


const TYPE_META = {
  cash: { label: "Cash", icon: Wallet, color: "hsl(var(--primary))" },
  investment: { label: "Investments", icon: TrendingUp, color: "hsl(180 70% 50%)" },
  debt: { label: "Debt", icon: Landmark, color: "hsl(var(--outflow))" },
  receivable: { label: "Receivables", icon: HandCoins, color: "hsl(var(--warning))" },
} as const;

const Dashboard = () => {
  const { data: accounts = [], isLoading: aL } = useAccounts();
  const { data: txns = [], isLoading: tL } = useTransactions(500);
  const { data: cats = [] } = useCategories();

  const totals = useMemo(() => {
    const by: Record<string, number> = { cash: 0, investment: 0, debt: 0, receivable: 0 };
    accounts.forEach((a) => { by[a.type] += Number(a.balance); });
    const netWorth = by.cash + by.investment + by.receivable - Math.abs(by.debt);
    return { by, netWorth };
  }, [accounts]);

  const mpesa = useMemo(() => {
    const isFuliza = (a: typeof accounts[number]) =>
      /fuliza/i.test(a.name) || /fuliza/i.test(a.subtype ?? "");
    const isMpesaCash = (a: typeof accounts[number]) =>
      a.type === "cash" && (/m[-\s]?pesa/i.test(a.name) || /m[-\s]?pesa/i.test(a.subtype ?? ""));

    const cash = accounts.filter(isMpesaCash).reduce((s, a) => s + Number(a.balance), 0);
    const fulizaAcc = accounts.find((a) => a.type === "debt" && isFuliza(a));
    const fulizaOwed = fulizaAcc ? Math.abs(Number(fulizaAcc.balance)) : 0;
    const fulizaLimit = fulizaAcc ? Number(fulizaAcc.credit_limit ?? 0) : 0;
    // Net available M-Pesa: positive cash, or negative when on Fuliza
    const net = cash - fulizaOwed;
    return { cash, fulizaOwed, fulizaLimit, net, hasFuliza: !!fulizaAcc };
  }, [accounts]);

  const monthly = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMonth = txns.filter((t) => new Date(t.occurred_at) >= start);
    const income = inMonth.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const expense = inMonth.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, net: income + expense };
  }, [txns]);

  const cashFlowSeries = useMemo(() => {
    const days: Record<string, { date: string; label: string; in: number; out: number; net: number }> = {};
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const d = new Date(cutoff); d.setDate(cutoff.getDate() + i);
      const k = d.toISOString().slice(0, 10);
      days[k] = {
        date: k,
        label: d.toLocaleDateString("en-KE", { month: "short", day: "2-digit" }),
        in: 0,
        out: 0,
        net: 0,
      };
    }
    txns.forEach((t) => {
      const k = new Date(t.occurred_at).toISOString().slice(0, 10);
      if (days[k]) {
        const a = Number(t.amount);
        if (a >= 0) days[k].in += a; else days[k].out += Math.abs(a);
      }
    });
    return Object.values(days).map((d) => ({ ...d, net: d.in - d.out }));
  }, [txns]);

  const flowMax = useMemo(
    () => cashFlowSeries.reduce((m, d) => Math.max(m, d.in, d.out), 0),
    [cashFlowSeries]
  );
  const hasFlow = flowMax > 0;

  const [flowMode, setFlowMode] = useState<"all" | "in" | "out" | "net">("all");

  const { topSpend, totalSpend } = useMemo(() => {
    const map = new Map<string, number>();
    const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Uncategorized";
    txns.filter((t) => Number(t.amount) < 0).forEach((t) => {
      const k = catName(t.category_id);
      map.set(k, (map.get(k) ?? 0) + Math.abs(Number(t.amount)));
    });
    const all = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = all.reduce((s, x) => s + x.value, 0);
    const top = all.slice(0, 5);
    const restSum = all.slice(5).reduce((s, x) => s + x.value, 0);
    if (restSum > 0) top.push({ name: "Other", value: restSum });
    return { topSpend: top, totalSpend: total };
  }, [txns, cats]);

  const pieColors = [
    "hsl(var(--inflow))",
    "hsl(180 70% 50%)",
    "hsl(var(--warning))",
    "hsl(265 70% 62%)",
    "hsl(var(--outflow))",
    "hsl(220 12% 50%)",
  ];

  // Y-axis ticks: clean, non-duplicated, rounded to nice numbers
  const yTicks = useMemo(() => {
    if (flowMax <= 0) return [0, 250, 500, 750, 1000];
    const step = niceStep(flowMax / 4);
    const top = Math.ceil(flowMax / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return ticks;
  }, [flowMax]);


  if (aL || tL) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your financial picture at a glance</p>
        </div>
        <QuickAddTransaction />
      </header>

      {/* Net worth */}
      <Card className="overflow-hidden border-border/60 bg-gradient-surface p-6 shadow-card">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Net worth</div>
        <div className="mt-2 font-mono-figure text-4xl font-semibold tracking-tight md:text-5xl">
          {formatKES(totals.netWorth)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((k) => {
            const m = TYPE_META[k];
            const Icon = m.icon;
            return (
              <div key={k} className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                  {m.label}
                </div>
                <div className="mt-1 font-mono-figure text-lg font-medium">{formatKES(totals.by[k])}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* M-Pesa available balance (net of Fuliza) */}
      {(mpesa.cash > 0 || mpesa.hasFuliza) && (
        <Card className="border-border/60 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">M-Pesa available</div>
              <div className={`mt-1 font-mono-figure text-3xl font-semibold ${mpesa.net < 0 ? "text-outflow" : ""}`}>
                {formatKES(mpesa.net, { signed: mpesa.net < 0 })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {mpesa.net < 0
                  ? `On Fuliza — ${formatKES(mpesa.fulizaOwed)} owed`
                  : mpesa.hasFuliza
                    ? "Fuliza fully paid"
                    : `Cash: ${formatKES(mpesa.cash)}`}
              </div>
            </div>
            {mpesa.hasFuliza && mpesa.fulizaLimit > 0 && (
              <div className="min-w-[180px]">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Fuliza used</span>
                  <span className="font-mono-figure">{formatKES(mpesa.fulizaOwed)} / {formatKES(mpesa.fulizaLimit)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-outflow transition-all"
                    style={{ width: `${Math.min(100, (mpesa.fulizaOwed / mpesa.fulizaLimit) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatKES(Math.max(0, mpesa.fulizaLimit - mpesa.fulizaOwed))} available
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Month KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPI label="Income this month" value={formatKES(monthly.income)} tone="in" icon={ArrowUpRight} />
        <KPI label="Expenses this month" value={formatKES(monthly.expense)} tone="out" icon={ArrowDownRight} />
        <KPI label="Net" value={formatKES(monthly.net, { signed: true })} tone={monthly.net >= 0 ? "in" : "out"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/60 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-medium">Cash flow — last 30 days</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={cashFlowSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatKES(v)}
                />
                <Line type="monotone" dataKey="in" stroke="hsl(var(--inflow))" strokeWidth={2} dot={false} name="Inflow" />
                <Line type="monotone" dataKey="out" stroke="hsl(var(--outflow))" strokeWidth={2} dot={false} name="Outflow" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-border/60 p-4">
          <h2 className="mb-3 font-display text-sm font-medium">Top spending categories</h2>
          {spendByCategory.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No expense data yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={spendByCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {spendByCategory.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="border-border/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium">Recent transactions</h2>
          <Link to="/transactions" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet. Add one or import from M-Pesa.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {txns.slice(0, 8).map((t) => {
              const a = Number(t.amount);
              return (
                <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.counterparty || t.description || "Transaction"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.occurred_at).toLocaleString("en-KE", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className={`font-mono-figure font-medium ${a >= 0 ? "text-inflow" : "text-outflow"}`}>
                    {formatKES(a, { signed: true })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

const KPI = ({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "in" | "out"; icon?: React.ComponentType<{ className?: string }> }) => (
  <Card className="border-border/60 p-4">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      {Icon && <Icon className={`h-4 w-4 ${tone === "in" ? "text-inflow" : "text-outflow"}`} />}
    </div>
    <div className={`mt-2 font-mono-figure text-xl font-semibold ${tone === "in" ? "text-inflow" : "text-outflow"}`}>{value}</div>
  </Card>
);

export default Dashboard;

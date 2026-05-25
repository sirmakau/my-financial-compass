import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/useFinance";
import { useCombos, useEnsureFoodSeed, useLogMealAsTxn, type ComboCategory, type MealCombo, type MealType } from "@/hooks/useFood";
import { Utensils, Flame, Sparkles, Shuffle, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const KES = (n: number) => `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const CATEGORIES: { value: ComboCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "survival", label: "Survival" },
  { value: "fast", label: "Fast" },
  { value: "healthy", label: "Healthy" },
  { value: "luxury", label: "Luxury" },
  { value: "street", label: "Street" },
  { value: "gym", label: "Gym" },
];

type HelbMode = "reflected" | "normal" | "endmonth" | "critical";

const helbFrom = (bal: number): HelbMode => {
  if (bal > 3000) return "reflected";
  if (bal >= 800) return "normal";
  if (bal >= 200) return "endmonth";
  return "critical";
};

const helbLabel: Record<HelbMode, { label: string; tone: string; quip: string }> = {
  reflected: { label: "HELB Reflected", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", quip: "Chicken weather. Spend wisely." },
  normal: { label: "Normal Operation", tone: "bg-sky-500/15 text-sky-400 border-sky-500/30", quip: "Rice + ndengu energy." },
  endmonth: { label: "End Month", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30", quip: "Ugali + sukuma prioritized." },
  critical: { label: "Critical Condition", tone: "bg-red-500/15 text-red-400 border-red-500/30", quip: "Tea + mandazi survival mode." },
};

const MEALS: { type: MealType; label: string; share: number }[] = [
  { type: "breakfast", label: "Breakfast", share: 0.25 },
  { type: "lunch", label: "Lunch", share: 0.4 },
  { type: "supper", label: "Supper", share: 0.35 },
];

const Food = () => {
  const { data: accounts = [] } = useAccounts();
  const { data: combos = [], isLoading } = useCombos();
  const ensureSeed = useEnsureFoodSeed();
  const logMeal = useLogMealAsTxn();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      ensureSeed.mutate();
    }
  }, [ensureSeed]);

  const cashBalance = useMemo(
    () => accounts.filter((a) => a.type === "cash" || a.type === "mpesa").reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accounts],
  );

  const [budget, setBudget] = useState<number>(0);
  useEffect(() => {
    setBudget(Math.max(0, Math.round(cashBalance)));
  }, [cashBalance]);

  const mode = helbFrom(cashBalance);
  const modeMeta = helbLabel[mode];

  const [shuffleKeys, setShuffleKeys] = useState<Record<MealType, number>>({ breakfast: 0, lunch: 0, supper: 0 });
  const [activeCat, setActiveCat] = useState<ComboCategory | "all">("all");

  const filteredByMode = useMemo(() => {
    if (mode === "critical") return combos.filter((c) => c.category === "survival");
    return combos;
  }, [combos, mode]);

  const pickFor = (type: MealType): MealCombo[] => {
    const slot = budget * (MEALS.find((m) => m.type === type)?.share ?? 0.33);
    const pool = filteredByMode.filter((c) => c.meal_type === type && c.cost <= slot);
    void shuffleKeys[type];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.sort((a, b) => b.cost - a.cost).slice(0, 3);
  };

  const browseList = useMemo(() => {
    return combos
      .filter((c) => (activeCat === "all" ? true : c.category === activeCat))
      .sort((a, b) => a.cost - b.cost);
  }, [combos, activeCat]);

  const [pending, setPending] = useState<MealCombo | null>(null);
  const defaultAccount = useMemo(() => {
    return accounts.find((a) => a.type === "mpesa") ?? accounts.find((a) => a.type === "cash") ?? accounts[0];
  }, [accounts]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  useEffect(() => {
    if (defaultAccount && !selectedAccount) setSelectedAccount(defaultAccount.id);
  }, [defaultAccount, selectedAccount]);

  const totalPickedHint = "Pick a combo, then confirm to log it as an expense.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Food Advisor</h1>
          <p className="text-sm text-muted-foreground">Budget-aware meal combos for Kenyan student life.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`gap-1 border ${modeMeta.tone}`}>
            <Flame className="h-3 w-3" /> {modeMeta.label}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Today's plan</CardTitle>
              <CardDescription>{modeMeta.quip}</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Cash + M-Pesa balance</div>
              <div className="font-display text-xl font-semibold">{KES(cashBalance)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="budget" className="text-xs text-muted-foreground">Daily food budget (KES)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Split: Breakfast 25% · Lunch 40% · Supper 35%
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {MEALS.map((m) => {
              const slot = Math.round(budget * m.share);
              const picks = pickFor(m.type);
              return (
                <Card key={m.type} className="bg-card/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{m.label}</CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setShuffleKeys((s) => ({ ...s, [m.type]: s[m.type] + 1 }))}
                      >
                        <Shuffle className="h-3 w-3" /> Shuffle
                      </Button>
                    </div>
                    <CardDescription className="text-xs">Slot: {KES(slot)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
                    {!isLoading && picks.length === 0 && (
                      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3 w-3" /> Nothing fits this slot. Increase budget or check survival combos below.
                      </div>
                    )}
                    {picks.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setPending(c)}
                        className="group flex w-full items-center justify-between rounded-md border border-border bg-background/40 p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground capitalize">{c.category} · {c.items.join(", ")}</div>
                        </div>
                        <div className="ml-2 shrink-0 text-sm font-semibold">{KES(c.cost)}</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{totalPickedHint}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Utensils className="h-4 w-4" /> Browse combos</CardTitle>
          <CardDescription>All meal combos, filter by vibe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                size="sm"
                variant={activeCat === c.value ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setActiveCat(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {browseList.map((c) => (
              <button
                key={c.id}
                onClick={() => setPending(c)}
                className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.meal_type} · {c.category}</div>
                </div>
                <div className="ml-2 shrink-0 text-sm font-semibold">{KES(c.cost)}</div>
              </button>
            ))}
            {browseList.length === 0 && (
              <div className="text-xs text-muted-foreground">No combos in this category.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {pending?.name}</DialogTitle>
            <DialogDescription>
              {pending && <>Cost <span className="font-semibold text-foreground">{KES(pending.cost)}</span> · {pending.items.join(", ")}</>}
              <br />Log this as an expense?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Account to charge</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} · {KES(Number(a.balance))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => { toast({ title: "Noted", description: `${pending?.name} suggested (not logged).` }); setPending(null); }}>
              Just suggest
            </Button>
            <Button
              disabled={!pending || !selectedAccount || logMeal.isPending}
              onClick={async () => {
                if (!pending || !selectedAccount) return;
                try {
                  await logMeal.mutateAsync({ combo: pending, account_id: selectedAccount });
                  toast({ title: "Logged", description: `${pending.name} (-${KES(pending.cost)})` });
                  setPending(null);
                } catch (e: any) {
                  toast({ title: "Failed to log", description: e?.message ?? "Try again", variant: "destructive" });
                }
              }}
            >
              {logMeal.isPending ? "Logging…" : "Log expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Food;

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
import { Utensils, Flame, TrendingUp, Shuffle, AlertTriangle } from "lucide-react";
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
  if (bal >= 10000) return "reflected";
  if (bal >= 4000) return "normal";
  if (bal >= 1000) return "endmonth";
  return "critical";
};

const helbLabel: Record<HelbMode, { label: string; tone: string; quip: string }> = {
  reflected: { label: "HELB Reflected", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", quip: "Chicken weather. Spend wisely." },
  normal: { label: "Normal Operation", tone: "bg-sky-500/15 text-sky-400 border-sky-500/30", quip: "Rice + ndengu energy." },
  endmonth: { label: "End Month", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30", quip: "Ugali + sukuma prioritized." },
  critical: { label: "Critical Condition", tone: "bg-red-500/15 text-red-400 border-red-500/30", quip: "Tea + mandazi survival mode." },
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  supper: "Supper",
};

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

  // HELB mode source: M-Pesa + KCB by name match (case-insensitive)
  const helbBalance = useMemo(
    () =>
      accounts
        .filter((a) => /m-?pesa|kcb/i.test(a.name))
        .reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accounts],
  );

  const [budget, setBudget] = useState<number>(300);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [activeCat, setActiveCat] = useState<ComboCategory | "all">("all");

  const mode = helbFrom(helbBalance);
  const modeMeta = helbLabel[mode];

  const filteredByMode = useMemo(() => {
    if (mode === "critical") return combos.filter((c) => c.category === "survival");
    return combos;
  }, [combos, mode]);

  // Affordable combos within the user-set limit
  const affordable = useMemo(() => {
    return filteredByMode.filter((c) => c.cost <= budget);
  }, [filteredByMode, budget]);

  // Group affordable combos by meal_type for plan view; shuffle on demand
  const grouped = useMemo(() => {
    void shuffleSeed; // re-compute when shuffled
    const g: Record<MealType, MealCombo[]> = { breakfast: [], lunch: [], supper: [] };
    const shuffled = [...affordable].sort(() => Math.random() - 0.5);
    for (const c of shuffled) g[c.meal_type].push(c);
    return g;
  }, [affordable, shuffleSeed]);

  const cheapestCost = useMemo(
    () => (filteredByMode.length ? Math.min(...filteredByMode.map((c) => c.cost)) : 0),
    [filteredByMode],
  );

  const browseList = useMemo(() => {
    return combos
      .filter((c) => (activeCat === "all" ? true : c.category === activeCat))
      .sort((a, b) => a.cost - b.cost);
  }, [combos, activeCat]);

  const [pending, setPending] = useState<MealCombo | null>(null);
  const defaultAccount = useMemo(() => {
    return (
      accounts.find((a) => /m-?pesa/i.test(a.name)) ??
      accounts.find((a) => a.type === "cash") ??
      accounts[0]
    );
  }, [accounts]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  useEffect(() => {
    if (defaultAccount && !selectedAccount) setSelectedAccount(defaultAccount.id);
  }, [defaultAccount, selectedAccount]);

  const showSlots = budget >= 250; // enough for at least three light meals
  const meals: MealType[] = ["breakfast", "lunch", "supper"];

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
              <div className="text-xs text-muted-foreground">M-Pesa + KCB balance</div>
              <div className="font-display text-xl font-semibold">{KES(helbBalance)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="budget" className="text-xs text-muted-foreground">
                How much do you want to spend today? (KES)
              </Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1"
              onClick={() => setShuffleSeed((s) => s + 1)}
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </Button>
            <div className="text-xs text-muted-foreground">
              {affordable.length} combo{affordable.length === 1 ? "" : "s"} fit your limit
            </div>
          </div>

          {affordable.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {cheapestCost > 0
                ? `Nothing under ${KES(budget)}. Cheapest combo is ${KES(cheapestCost)}.`
                : "Loading combos…"}
            </div>
          ) : showSlots ? (
            <div className="grid gap-4 md:grid-cols-3">
              {meals.map((type) => {
                const picks = grouped[type].slice(0, 3);
                return (
                  <Card key={type} className="bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{MEAL_LABEL[type]}</CardTitle>
                      <CardDescription className="text-xs">
                        {picks.length === 0 ? "No fit — try another slot" : `${picks.length} option${picks.length > 1 ? "s" : ""}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
                      {!isLoading && picks.length === 0 && (
                        <div className="text-xs text-muted-foreground">Nothing under your limit for this slot.</div>
                      )}
                      {picks.map((c) => (
                        <ComboButton key={c.id} combo={c} onPick={setPending} />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Best picks under {KES(budget)}</CardTitle>
                <CardDescription className="text-xs">
                  Tight budget — skipping the 3-meal split. Pick what fits.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {[...affordable].sort((a, b) => b.cost - a.cost).slice(0, 6).map((c) => (
                  <ComboButton key={c.id} combo={c} onPick={setPending} />
                ))}
              </CardContent>
            </Card>
          )}
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
            <DialogTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> {pending?.name}</DialogTitle>
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

const ComboButton = ({ combo, onPick }: { combo: MealCombo; onPick: (c: MealCombo) => void }) => (
  <button
    onClick={() => onPick(combo)}
    className="group flex w-full items-center justify-between rounded-md border border-border bg-background/40 p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent"
  >
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{combo.name}</div>
      <div className="truncate text-xs text-muted-foreground capitalize">{combo.category} · {combo.items.join(", ")}</div>
    </div>
    <div className="ml-2 shrink-0 text-sm font-semibold">{KES(combo.cost)}</div>
  </button>
);

export default Food;

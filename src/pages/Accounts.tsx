import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAccounts, useCreateAccount, useDeleteAccount, useAccrueInterest, useEnsureCategories, type AccountType } from "@/hooks/useFinance";
import { formatKES } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Wallet, TrendingUp, Landmark, HandCoins, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  cash: Wallet, investment: TrendingUp, debt: Landmark, receivable: HandCoins,
};

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  type: z.enum(["cash", "investment", "debt", "receivable"]),
  balance: z.coerce.number().min(-1_000_000_000).max(1_000_000_000),
  interest_rate: z.coerce.number().min(0).max(100).optional(),
  credit_limit: z.coerce.number().min(0).max(1_000_000_000).optional(),
  subtype: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

const Accounts = () => {
  const { data: accounts = [], isLoading } = useAccounts();
  const create = useCreateAccount();
  const del = useDeleteAccount();
  const accrue = useAccrueInterest();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "cash", balance: 0 },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      await create.mutateAsync({ 
        name: v.name, 
        type: v.type, 
        balance: v.balance, 
        interest_rate: v.interest_rate, 
        subtype: v.subtype, 
        notes: v.notes 
      });
      toast.success("Account created");
      form.reset({ type: "cash", balance: 0 });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Accounts</h1>
          <p className="text-sm text-muted-foreground">Cash, investments, debt and receivables</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. M-Pesa, Ziidi MMF, Fuliza" {...form.register("name")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as AccountType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash / Mobile money</SelectItem>
                      <SelectItem value="investment">Investment / MMF</SelectItem>
                      <SelectItem value="debt">Debt (e.g. Fuliza)</SelectItem>
                      <SelectItem value="receivable">Expected money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Starting balance (KES)</Label>
                  <Input type="number" step="0.01" {...form.register("balance")} />
                </div>
              </div>
              {form.watch("type") === "investment" && (
                <div className="space-y-1.5">
                  <Label>Annual interest rate (%)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 5.0" {...form.register("interest_rate")} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Subtype (optional)</Label>
                <Input placeholder="e.g. Fuliza, Ziidi" {...form.register("subtype")} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} {...form.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">No accounts yet. Add your M-Pesa, MMF, or debt accounts to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const Icon = ICONS[a.type];
            const balance = Number(a.balance);
            return (
              <Card key={a.id} className="group border-border/60 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <Badge variant="secondary" className="mt-1 capitalize">{a.type}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {a.type === "investment" && a.interest_rate && a.interest_rate > 0 && (
                      <Button
                        variant="ghost" size="icon"
                        className="opacity-0 transition group-hover:opacity-100"
                        onClick={async () => {
                          await accrue.mutateAsync(a.id);
                          toast.success("Interest accrued");
                        }}
                        disabled={accrue.isPending}
                      >
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={async () => {
                        if (!confirm(`Delete "${a.name}"? All transactions will be removed.`)) return;
                        await del.mutateAsync(a.id);
                        toast.success("Account deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className={`mt-4 font-mono-figure text-2xl font-semibold ${a.type === "debt" ? "text-outflow" : ""}`}>
                  {formatKES(balance)}
                </div>
                {a.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Accounts;

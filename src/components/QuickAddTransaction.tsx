import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useCategories, useCreateTransaction, useCreateCategory } from "@/hooks/useFinance";
import { Plus, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  account_id: z.string().uuid("Select an account"),
  category_id: z.string().uuid().optional().nullable(),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Amount must be positive").max(1_000_000_000),
  occurred_at: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  counterparty: z.string().trim().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export const QuickAddTransaction = ({ trigger }: { trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const create = useCreateTransaction();
  const createCat = useCreateCategory();
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "out",
      occurred_at: new Date().toISOString().slice(0, 16),
      amount: 0,
    },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      const signed = v.direction === "in" ? v.amount : -v.amount;
      await create.mutateAsync({
        account_id: v.account_id,
        category_id: v.category_id || null,
        amount: signed,
        occurred_at: new Date(v.occurred_at).toISOString(),
        description: v.description || null,
        counterparty: v.counterparty || null,
      });
      toast.success("Transaction added");
      form.reset({
        direction: "out",
        occurred_at: new Date().toISOString().slice(0, 16),
        amount: 0,
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
        </DialogHeader>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create an account first.</p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select value={form.watch("direction")} onValueChange={(v) => form.setValue("direction", v as "in" | "out")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Inflow (+)</SelectItem>
                    <SelectItem value="out">Outflow (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input type="number" step="0.01" min="0" {...form.register("amount")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={form.watch("account_id")} onValueChange={(v) => form.setValue("account_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                <button
                  type="button"
                  onClick={() => setNewCatOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <PlusCircle className="h-3 w-3" /> {newCatOpen ? "Cancel" : "New"}
                </button>
              </div>
              {newCatOpen ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key !== "Enter" || !newCatName.trim()) return;
                      e.preventDefault();
                      const kind = form.watch("direction") === "in" ? "income" : "expense";
                      try {
                        const c = await createCat.mutateAsync({ name: newCatName.trim(), kind });
                        form.setValue("category_id", c.id);
                        setNewCatName("");
                        setNewCatOpen(false);
                        toast.success(`Added "${c.name}"`);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newCatName.trim() || createCat.isPending}
                    onClick={async () => {
                      const kind = form.watch("direction") === "in" ? "income" : "expense";
                      try {
                        const c = await createCat.mutateAsync({ name: newCatName.trim(), kind });
                        form.setValue("category_id", c.id);
                        setNewCatName("");
                        setNewCatOpen(false);
                        toast.success(`Added "${c.name}"`);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              ) : (
                <Select value={form.watch("category_id") ?? ""} onValueChange={(v) => form.setValue("category_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" {...form.register("occurred_at")} />
            </div>
            <div className="space-y-1.5">
              <Label>Counterparty</Label>
              <Input placeholder="e.g. Naivas, John Doe" {...form.register("counterparty")} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} {...form.register("description")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

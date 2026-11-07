import { ArrowDownToLine, ArrowRight, BarChart3, BookOpen, CheckCircle2, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";

const features = [
  { icon: BarChart3, title: "A clearer financial picture", text: "Track cash, investments, receivables, debts, and net worth in one place." },
  { icon: Smartphone, title: "M-Pesa ready", text: "Connect M-Pesa SMS notifications through MacroDroid and the Ledger webhook." },
  { icon: BookOpen, title: "Step-by-step setup", text: "Follow the complete Android, Supabase, and MacroDroid integration guide." },
];

const Landing = () => (
  <div className="min-h-screen bg-background">
    <PublicNavbar />
    <main>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-56 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-primary">Personal financial intelligence</p>
            <h1 className="max-w-3xl font-display text-5xl font-semibold tracking-tight md:text-6xl">
              Make every shilling easier to understand.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Ledger gives you a calm, complete view of your finances, with reliable account calculations and a practical M-Pesa SMS workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                Open Ledger <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/Documentation" className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-secondary">
                Read the guide
              </Link>
              <a
                href="/ledger.apk"
                download="ledger.apk"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-secondary"
              >
                <ArrowDownToLine className="h-4 w-4" /> Download Android app
              </a>
            </div>
          </div>
          <Card className="border-border/60 bg-gradient-surface p-6 shadow-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ledger workflow</div>
            <div className="mt-6 space-y-4">
              {["Receive M-Pesa SMS", "Check connectivity", "Send securely to Ledger", "Review before importing"].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{index + 1}</div>
                  <span className="text-sm">{step}</span>
                  {index < 3 && <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-border/60 p-6">
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold">Built around clarity and control.</h2>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {["Debt and net worth calculations follow consistent accounting rules.", "Fuliza is mirrored correctly without double-counting it.", "You review imported messages before financial records change."].map((item) => (
                <li key={item} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  </div>
);

export default Landing;

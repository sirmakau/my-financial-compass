import { ArrowDownToLine, ArrowRight, BookOpen, Smartphone, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";

const Apps = () => (
  <div className="min-h-screen bg-background">
    <PublicNavbar />
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-12 lg:px-8 lg:py-20">
      <section className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Apps</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">The tools behind your financial workflow.</h1>
        <p className="mt-4 text-lg text-muted-foreground">Use Ledger with the tools you already rely on to capture, understand, and review your financial activity.</p>
        <a
          href="/ledger.apk"
          download="ledger.apk"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <ArrowDownToLine className="h-4 w-4" /> Download Ledger for Android
        </a>
      </section>
      <section className="grid gap-5 md:grid-cols-3">
        {[
          { icon: Wallet, title: "Ledger", text: "Manage accounts, transactions, debt, investments, receivables, and financial summaries.", action: "Open Ledger", to: "/auth" },
          { icon: Smartphone, title: "MacroDroid", text: "Detect incoming M-Pesa SMS messages and send them securely to the Ledger webhook.", action: "View setup", to: "/Documentation" },
          { icon: BookOpen, title: "Documentation", text: "Follow the exact setup steps for online delivery, offline storage, and retry validation.", action: "Read documentation", to: "/Documentation" },
        ].map(({ icon: Icon, title, text, action, to }) => (
          <Card key={title} className="flex flex-col border-border/60 p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{text}</p>
            <Link to={to} className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline">{action} <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Card>
        ))}
      </section>
    </main>
  </div>
);

export default Apps;

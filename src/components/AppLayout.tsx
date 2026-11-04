import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, ArrowLeftRight, MessageSquareText, LogOut, BarChart3, Utensils, Inbox } from "lucide-react";
import logo from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BackendStatusPill } from "@/components/BackendStatusPill";
import { ThemeToggle } from "@/components/ThemeToggle";


const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/import", label: "Messages", icon: Inbox, badge: true },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/food", label: "Food", icon: Utensils },
];

export const AppLayout = () => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const { data: pending = 0 } = useQuery({
    queryKey: ["sms_inbox_count"],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase.from("sms_inbox").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <img src={logo} alt="Ledger logo" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="font-display text-lg font-semibold tracking-tight">Ledger</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && pending > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-2">
            <div className="min-w-0 truncate text-xs text-muted-foreground">{user?.email}</div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <BackendStatusPill />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={async () => { await signOut(); nav("/auth"); }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Ledger logo" width={32} height={32} className="h-7 w-7 object-contain" />
          <span className="font-display font-semibold">Ledger</span>
        </div>
        <div className="flex items-center gap-2">
          <BackendStatusPill />
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden">
          {links.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && pending > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="h-14 lg:hidden" />
      </main>
    </div>
  );
};

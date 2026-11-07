import { BookOpen, LayoutGrid, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "@/assets/logo.png";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/apps", label: "Apps" },
  { to: "/Documentation", label: "Documentation" },
];

export const PublicNavbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold" onClick={() => setOpen(false)}>
          <img src={logo} alt="Ledger logo" width={32} height={32} className="h-8 w-8 object-contain" />
          Ledger
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/auth" className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </nav>
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-border/60 px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2.5 text-sm ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link to="/auth" onClick={() => setOpen(false)} className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};

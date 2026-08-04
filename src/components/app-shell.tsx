import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Users,
  MessageCircle,
  CalendarCheck,
  BarChart3,
  Bot,
  Settings,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AskAiIsland } from "@/components/ask-ai";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/conversations", label: "Conversations", icon: MessageCircle },
  { to: "/tasks", label: "Tasks", icon: CalendarCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-brain", label: "AI Brain", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("salesmind-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("salesmind-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={cn(
        "glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5",
        compact && "px-2.5",
      )}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, logout } = useAuth();
  const email = session?.user?.email || "User";

  return (
    <div className="min-h-screen w-full">
      {/* Desktop floating sidebar */}
      <aside className="fixed top-5 bottom-5 left-5 z-40 hidden w-[15.5rem] lg:block">
        <div className="glass flex h-full flex-col rounded-[28px] p-4">
          <Link to="/" className="mb-6 flex items-center gap-3 px-2 pt-2">
            <span className="from-primary to-accent grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br">
              <Bot className="text-primary-foreground h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">SalesMind AI</span>
              <span className="text-muted-foreground block text-[11px]">Your AI sales employee</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-[18px] px-3 py-2.5 text-sm font-medium transition-all duration-300",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_var(--primary)]"
                      : "text-muted-foreground hover:bg-primary-soft/70 hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="bg-primary-soft text-primary grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-xs font-bold uppercase">
                {email.substring(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{email}</span>
                <button
                  onClick={() => logout()}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px] font-medium transition"
                >
                  <LogOut className="h-3 w-3" /> Sign out
                </button>
              </span>
            </div>
            <ThemeToggle compact />
          </div>
        </div>
      </aside>

      <div className="mx-auto max-w-[86rem] px-4 pt-5 pb-32 sm:px-6 lg:pt-6 lg:pb-12 lg:pl-[17.5rem]">
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="from-primary to-accent grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br">
              <Bot className="text-primary-foreground h-4 w-4" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">SalesMind AI</span>
          </Link>
          <ThemeToggle compact />
        </div>
        {children}
      </div>

      {/* Mobile floating bottom nav */}
      <nav className="fixed inset-x-3 bottom-4 z-40 lg:hidden">
        <div className="glass flex items-center justify-between gap-1 rounded-[26px] px-2 py-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-[18px] px-1 py-2 text-[10px] font-medium transition-all",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="truncate">{label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AskAiIsland />
    </div>
  );
}

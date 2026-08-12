import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Users,
  MessageSquare,
  CalendarCheck,
  BarChart3,
  Bot,
  Settings,
  Moon,
  Sun,
  LogOut,
  Radio,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AskAiIsland } from "@/components/ask-ai";
import { useAuth } from "@/contexts/auth-context";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: string;
}

const nav: readonly NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/conversations", label: "Chats", icon: MessageSquare, badge: "Live" },
  { to: "/call-autopilot", label: "Call Autopilot", icon: PhoneCall, badge: "Voice" },
  { to: "/tasks", label: "Tasks", icon: CalendarCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-brain", label: "AI Rules", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

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
      aria-label="Toggle theme"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition cursor-pointer",
        compact && "p-1.5",
      )}
    >
      {dark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />}
      {!compact && <span className="text-[11px] font-medium">{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, logout } = useAuth();
  const email = session?.user?.email || "Founder";

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* Desktop WhatsApp-styled Minimalist Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-border bg-card p-3 min-h-screen sticky top-0 h-screen">
        <div className="flex flex-col gap-4">
          {/* Brand Header */}
          <Link to="/" className="flex items-center gap-2.5 px-2 py-1 group">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#008069] dark:bg-[#00a884] text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-bold tracking-tight text-foreground block">SalesMind AI</span>
              <span className="text-[10px] text-muted-foreground font-medium">WhatsApp CRM Engine</span>
            </div>
          </Link>

          {/* Autopilot Status Indicator */}
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 border border-border text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
              <span className="font-semibold text-foreground">WhatsApp API Live</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">v21.0</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-0.5">
            {nav.map(({ to, label, icon: Icon, badge }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-[#008069]/10 dark:bg-[#00a884]/15 text-[#008069] dark:text-[#00a884] font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("h-4 w-4", active ? "text-[#008069] dark:text-[#00a884]" : "text-muted-foreground")} />
                    <span>{label}</span>
                  </div>
                  {badge && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.2 rounded-full",
                        active
                          ? "bg-[#008069] dark:bg-[#00a884] text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Account & Theme */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#008069] text-white text-xs font-semibold uppercase">
              {email.substring(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground leading-tight">{email}</span>
              <button
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-[10px] transition cursor-pointer mt-0.5"
              >
                <LogOut className="h-2.5 w-2.5" /> Sign out
              </button>
            </div>
          </div>
          <ThemeToggle compact />
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <div className="flex items-center justify-between border-b border-border bg-[#008069] dark:bg-[#111b21] px-4 py-3 text-white lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">SalesMind</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#25D366] bg-black/20 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse" /> Autopilot Live
            </span>
            <ThemeToggle compact />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-3 sm:p-5 max-w-7xl w-full mx-auto pb-24 lg:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-border bg-card px-2 py-1.5">
        <div className="flex items-center justify-around">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition",
                  active ? "text-[#008069] dark:text-[#00a884] font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AskAiIsland />
    </div>
  );
}

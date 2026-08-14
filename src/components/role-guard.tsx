import { useAuth } from "@/contexts/auth-context";
import { type UserRole } from "@/lib/types";
import { ShieldCheck, UserCheck, Lock } from "lucide-react";
import { GlassCard } from "@/components/glass";
import { cn } from "@/lib/utils";

interface RoleGateProps {
  requiredRole?: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideFallback?: boolean;
}

export function RoleGate({
  requiredRole = "admin",
  children,
  fallback,
  hideFallback = false,
}: RoleGateProps) {
  const { role, isAdmin } = useAuth();

  const hasAccess = requiredRole === "admin" ? isAdmin : true;

  if (hasAccess) {
    return <>{children}</>;
  }

  if (hideFallback) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <GlassCard className="border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">Admin Access Required</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          You are currently signed in as a <strong className="text-foreground capitalize">{role}</strong>. This section is restricted to Organization Administrators.
        </p>
      </div>
    </GlassCard>
  );
}

export function RoleBadge({
  role,
  size = "md",
  className,
}: {
  role: UserRole;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const isAdmin = role === "admin";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border transition-all",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        isAdmin
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
        className
      )}
    >
      {isAdmin ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> : <UserCheck className="h-3.5 w-3.5 shrink-0" />}
      <span className="capitalize">{role === "admin" ? "Admin" : "Salesperson"}</span>
    </span>
  );
}

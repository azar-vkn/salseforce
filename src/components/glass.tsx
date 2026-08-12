import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function GlassCard({
  className,
  children,
  delay = 0,
  ...props
}: ComponentPropsWithoutRef<"div"> & { delay?: number }) {
  return (
    <div
      {...props}
      style={{ animationDelay: `${delay}ms`, ...props.style }}
      className={cn(
        "bg-card text-card-foreground border border-border/80 rounded-xl p-5 shadow-xs transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Island({
  className,
  children,
  icon,
  variant = "primary",
  ...props
}: ComponentPropsWithoutRef<"button"> & { icon?: ReactNode; variant?: "primary" | "glass" | "outline" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          : variant === "outline"
          ? "border border-border/80 bg-transparent hover:bg-muted text-foreground"
          : "bg-muted/70 hover:bg-muted text-foreground border border-border/50",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {hint ? <span className="text-muted-foreground text-[11px] font-normal">{hint}</span> : null}
    </div>
  );
}

export function Ring({ label, value, size = 64 }: { label: string; value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={5}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
            strokeDasharray={c}
            strokeDashoffset={c - (c * value) / 100}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xs font-bold text-foreground">
          {value}%
        </span>
      </div>
      <span className="text-muted-foreground text-center text-[11px] font-medium leading-tight">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

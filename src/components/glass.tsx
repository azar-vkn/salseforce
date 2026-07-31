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
      className={cn("glass rise rounded-[24px] p-5 sm:p-6", className)}
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
}: ComponentPropsWithoutRef<"button"> & { icon?: ReactNode; variant?: "primary" | "glass" }) {
  return (
    <button
      {...props}
      className={cn(
        "island focus-visible:ring-ring/70 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-[0_10px_26px_-14px_var(--primary)]"
          : "glass text-foreground",
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
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  );
}

export function Ring({ label, value, size = 74 }: { label: string; value: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={7}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out"
            strokeDasharray={c}
            strokeDashoffset={c - (c * value) / 100}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-semibold">
          {value}
        </span>
      </div>
      <span className="text-muted-foreground text-center text-[11px] leading-tight">{label}</span>
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
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="bg-primary-soft grid h-20 w-20 place-items-center rounded-[28px]">
        <div className="bg-primary/70 h-9 w-9 animate-[soft-pulse_2.4s_ease-in-out_infinite] rounded-2xl" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {action}
    </div>
  );
}

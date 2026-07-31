import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SalesMind AI" },
      { name: "description", content: "Profile, AI behaviour and notification preferences." },
      { property: "og:title", content: "Settings — SalesMind AI" },
      { property: "og:description", content: "Profile, AI behaviour and notification preferences." },
    ],
  }),
  component: SettingsPage,
});

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background/60 focus:ring-ring/60 mt-1.5 h-12 w-full rounded-[20px] px-4 text-sm outline-none focus:ring-2"
      />
    </label>
  );
}

function Toggle({ label, hint }: { label: string; hint: string }) {
  const [on, setOn] = useState(true);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-300",
            on ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@salesmind.ai");
  const [company, setCompany] = useState("SalesMind AI");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Keep it simple. Change only what matters.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Profile" />
          <div className="mt-4 space-y-4">
            <Field label="Full name" value={name} onChange={setName} />
            <Field label="Email" value={email} onChange={setEmail} />
            <Field label="Company" value={company} onChange={setCompany} />
            <Island onClick={() => toast.success("Profile saved")}>Save changes</Island>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard delay={80}>
            <SectionTitle title="AI behaviour" />
            <div className="divide-border/60 mt-1 divide-y">
              <Toggle label="Daily briefing" hint="A morning summary at 8:30 AM" />
              <Toggle label="Suggested replies" hint="Draft responses inside conversations" />
              <Toggle label="Auto lead scoring" hint="Re-score leads after every interaction" />
            </div>
          </GlassCard>

          <GlassCard delay={140}>
            <SectionTitle title="Notifications" />
            <div className="divide-border/60 mt-1 divide-y">
              <Toggle label="Hot lead alerts" hint="Ping me when intent crosses 85" />
              <Toggle label="Task reminders" hint="15 minutes before each task" />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

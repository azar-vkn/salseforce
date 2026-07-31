import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Flame,
  IndianRupee,
  MessageSquareDot,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Plus,
  Megaphone,
  PhoneCall,
} from "lucide-react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { leads, revenueSeries } from "@/lib/mock-data";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesMind AI" },
      { name: "description", content: "Your daily AI briefing: hot leads, revenue and next actions." },
      { property: "og:title", content: "Dashboard — SalesMind AI" },
      {
        property: "og:description",
        content: "Your daily AI briefing: hot leads, revenue and next actions.",
      },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Revenue this month", value: "₹42.0L", delta: "+18%", icon: IndianRupee },
  { label: "Hot leads", value: "8", delta: "+3 today", icon: Flame },
  { label: "Pending replies", value: "12", delta: "avg 7 min", icon: MessageSquareDot },
  { label: "Conversions", value: "24%", delta: "+4.2%", icon: TrendingUp },
];

function Dashboard() {
  const hot = leads.filter((l) => l.score > 75).slice(0, 3);

  return (
    <div className="space-y-5">
      <header className="rise">
        <p className="text-muted-foreground text-sm">Friday, 31 July</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Good morning, John <span className="inline-block">👋</span>
        </h1>
      </header>

      <GlassCard delay={40} className="from-primary/18 to-accent/10 bg-gradient-to-br">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-primary h-4 w-4" /> AI Summary
        </div>
        <p className="text-lg leading-relaxed font-medium sm:text-xl">
          Today you have <span className="text-primary">8 hot leads</span>,{" "}
          <span className="text-primary">3 meetings</span> and{" "}
          <span className="text-primary">12 follow-ups</span>. Expected revenue{" "}
          <span className="text-primary">₹4.2 Lakhs</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Island icon={<Plus className="h-4 w-4" />} onClick={() => toast.success("Lead form opened")}>
            Add Lead
          </Island>
          <Island
            variant="glass"
            icon={<Megaphone className="h-4 w-4" />}
            onClick={() => toast("Campaign draft ready")}
          >
            New Campaign
          </Island>
          <Island
            variant="glass"
            icon={<PhoneCall className="h-4 w-4" />}
            onClick={() => toast("Calling Aarav Mehta…")}
          >
            Call Lead
          </Island>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <GlassCard key={s.label} delay={80 + i * 60} className="p-4 sm:p-5">
            <div className="bg-primary-soft text-primary mb-3 grid h-9 w-9 place-items-center rounded-2xl">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold tracking-tight sm:text-3xl">{s.value}</div>
            <div className="text-muted-foreground mt-1 text-xs">{s.label}</div>
            <div className="text-primary mt-2 text-xs font-semibold">{s.delta}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard delay={320} className="lg:col-span-2">
          <SectionTitle title="Pipeline health" hint="Revenue in ₹ Lakhs" />
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={380}>
          <SectionTitle title="AI suggestions" />
          <ul className="mt-2 space-y-3 text-sm">
            {[
              "Call Aarav Mehta — 94% buying intent.",
              "Sara Kapoor hasn't replied in 2 days. Nudge her.",
              "Dev Sharma is price sensitive — send ROI proof.",
            ].map((s) => (
              <li key={s} className="glass rounded-[18px] px-3 py-2.5 leading-snug">
                {s}
              </li>
            ))}
          </ul>
          <Link
            to="/ai-brain"
            className="text-primary mt-4 inline-block text-xs font-semibold"
          >
            Open AI Brain →
          </Link>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard delay={420} className="lg:col-span-2">
          <SectionTitle title="Hot leads" hint="Ranked by AI score" />
          <div className="mt-2 space-y-2">
            {hot.map((l) => (
              <Link
                key={l.id}
                to="/leads"
                className="hover:bg-primary-soft/60 flex items-center gap-3 rounded-[18px] px-2 py-2.5 transition"
              >
                <span className="bg-primary-soft text-primary grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold">
                  {l.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {l.company} · {l.nextAction}
                  </span>
                </span>
                <span className="text-primary shrink-0 text-sm font-bold">{l.score}</span>
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard delay={460}>
          <SectionTitle title="Today's schedule" />
          <ul className="mt-3 space-y-3 text-sm">
            {[
              { t: "11:00", d: "Demo — Lumen Studio" },
              { t: "14:30", d: "Pricing call — Nimbus" },
              { t: "17:00", d: "Renewal — Bright Foods" },
            ].map((e) => (
              <li key={e.t} className="flex items-center gap-3">
                <span className="bg-primary-soft text-primary grid h-9 w-9 place-items-center rounded-2xl">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{e.t}</span>
                  <span className="text-muted-foreground block truncate text-xs">{e.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

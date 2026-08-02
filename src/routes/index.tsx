import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { useLeads, useTasks } from "@/hooks/use-supabase";
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

function Dashboard() {
  const { data: serverLeads = [], isLoading: loadingLeads, error } = useLeads();
  const { data: serverTasks = [], isLoading: loadingTasks } = useTasks();
  
  const hot = serverLeads.filter((l) => l.score > 75).slice(0, 3);
  const wonLeads = serverLeads.filter(l => l.stage === "Won");
  
  // Basic parsing for string values like "₹5L", "₹50k"
  const parseValue = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0;
    if (valStr.toLowerCase().includes('l')) return num * 100000;
    if (valStr.toLowerCase().includes('k')) return num * 1000;
    if (valStr.toLowerCase().includes('cr')) return num * 10000000;
    return num;
  };

  const formatLakhs = (val: number) => `₹${(val / 100000).toFixed(1)}L`;

  const totalWon = wonLeads.reduce((sum, l) => sum + parseValue(l.value), 0);
  const totalExpected = serverLeads.filter(l => l.stage !== "Won").reduce((sum, l) => sum + parseValue(l.value), 0);

  const pendingReplies = serverLeads.filter(l => l.status === "Unread").length;
  const todayTasks = serverTasks.filter(t => t.column === "today");
  const followUps = serverTasks.filter(t => t.tag.toLowerCase().includes("follow")).length;

  const stats = [
    { label: "Revenue this month", value: totalWon > 0 ? formatLakhs(totalWon) : "₹0", delta: "+12%", icon: IndianRupee },
    { label: "Hot leads", value: serverLeads.filter(l => l.score > 75).length.toString(), delta: "+2", icon: Flame },
    { label: "Pending replies", value: pendingReplies.toString(), delta: "-1", icon: MessageSquareDot },
    { label: "Conversions", value: wonLeads.length.toString(), delta: "+5%", icon: TrendingUp },
  ];

  const revenueSeries = [
    { month: "Jan", revenue: 2.4 },
    { month: "Feb", revenue: 3.1 },
    { month: "Mar", revenue: 2.8 },
    { month: "Apr", revenue: 4.2 },
    { month: "May", revenue: 3.9 },
    { month: "Jun", revenue: totalWon > 0 ? totalWon / 100000 : 4.5 }, // Current month mock
  ];
  
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loadingLeads || loadingTasks) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-5">
      <header className="rise">
        <p className="text-muted-foreground text-sm">
          {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </h1>
      </header>

      <GlassCard delay={40} className="from-primary/18 to-accent/10 bg-gradient-to-br">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-primary h-4 w-4" /> AI Summary
        </div>
        <p className="text-lg leading-relaxed font-medium sm:text-xl">
          Today you have <span className="text-primary">{hot.length} hot leads</span>,{" "}
          <span className="text-primary">{todayTasks.filter(t => t.tag.toLowerCase().includes('meet')).length} meetings</span> and{" "}
          <span className="text-primary">{followUps} follow-ups</span>. Expected revenue{" "}
          <span className="text-primary">{formatLakhs(totalExpected)}</span>.
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
            {hot.length > 0 ? (
              hot.map(l => (
                <li key={`sug-${l.id}`} className="text-muted-foreground px-3 py-2 text-xs border-b border-border/40 last:border-0">
                  <strong className="text-foreground">{l.name}</strong> has a high intent score. Consider scheduling a demo soon.
                </li>
              ))
            ) : (
              <li className="text-muted-foreground px-3 py-2.5 text-center text-xs">
                No suggestions available yet.
              </li>
            )}
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
            {todayTasks.length > 0 ? (
              todayTasks.map(t => (
                <li key={t.id} className="flex justify-between items-center text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span>
                    <strong className="text-foreground block">{t.title}</strong>
                    <span className="text-muted-foreground">{t.lead}</span>
                  </span>
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded-full">{t.tag}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground px-3 py-2.5 text-center text-xs">
                No meetings scheduled today.
              </li>
            )}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

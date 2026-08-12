import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Flame,
  IndianRupee,
  MessageSquare,
  TrendingUp,
  Sparkles,
  Plus,
  Megaphone,
  PhoneCall,
  ArrowRight,
} from "lucide-react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { useLeads, useTasks, useCalls, useCallSettings } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SalesMind AI" },
      { name: "description", content: "Your daily WhatsApp sales briefing: hot leads, revenue and next actions." },
      { property: "og:title", content: "Dashboard — SalesMind AI" },
      {
        property: "og:description",
        content: "Your daily WhatsApp sales briefing: hot leads, revenue and next actions.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: serverLeads = [], isLoading: loadingLeads } = useLeads();
  const { data: serverTasks = [], isLoading: loadingTasks } = useTasks();
  const { data: serverCalls = [] } = useCalls();
  const { data: callSettings } = useCallSettings();
  
  const hot = serverLeads.filter((l) => l.score > 75).slice(0, 3);
  const wonLeads = serverLeads.filter(l => l.stage === "Won");
  
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const callsToday = serverCalls.filter(c => c.createdAt.slice(0, 10) === todayStr).length;
  const dealsDiscussed = new Set(serverCalls.map(c => c.leadId)).size;
  const followUpsCreated = serverCalls.filter(c => c.analysis?.recommendedNextAction).length;

  const stats = [
    { label: "Won Revenue", value: totalWon > 0 ? formatLakhs(totalWon) : "₹0", delta: "+12%", icon: IndianRupee },
    { label: "Hot Leads", value: serverLeads.filter(l => l.score > 75).length.toString(), delta: "+2 new", icon: Flame },
    { label: "Unread Chats", value: pendingReplies.toString(), delta: "Realtime", icon: MessageSquare },
    { label: "Call Autopilot", value: callSettings?.enabled ? "● Active" : "○ Disabled", delta: `${serverCalls.length} AI Calls (${callsToday} today)`, icon: PhoneCall },
  ];

  const revenueSeries = [
    { month: "Jan", revenue: 2.4 },
    { month: "Feb", revenue: 3.1 },
    { month: "Mar", revenue: 2.8 },
    { month: "Apr", revenue: 4.2 },
    { month: "May", revenue: 3.9 },
    { month: "Jun", revenue: totalWon > 0 ? totalWon / 100000 : 4.5 },
  ];
  
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loadingLeads || loadingTasks) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-lg bg-card border border-border px-4 py-3 shadow-xs">
          <div className="h-4 w-4 rounded-full border-2 border-[#008069] border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-lg shadow-xs">
        <div>
          <p className="text-[11px] text-muted-foreground">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-0.5">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/conversations"
            className="bg-[#008069] dark:bg-[#00a884] text-white hover:opacity-90 flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold shadow-xs transition"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Open WhatsApp Inbox</span>
          </Link>
        </div>
      </header>

      {/* AI Summary Banner */}
      <div className="bg-[#008069]/10 dark:bg-[#00a884]/15 border border-[#008069]/30 rounded-lg p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#008069] dark:text-[#25D366]">
          <Sparkles className="h-4 w-4" />
          <span>AI Daily Executive Briefing</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground font-medium">
          You have <strong className="text-[#008069] dark:text-[#25D366]">{hot.length} high-intent leads</strong> active on WhatsApp,{" "}
          <strong>{todayTasks.filter(t => t.tag.toLowerCase().includes('meet')).length} scheduled calls</strong> and{" "}
          <strong>{followUps} follow-ups</strong>. Expected pipeline value:{" "}
          <strong className="text-[#008069] dark:text-[#25D366]">{formatLakhs(totalExpected)}</strong>.
        </p>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3.5 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">{s.label}</span>
              <div className="text-[#008069] dark:text-[#00a884] bg-[#008069]/10 p-1.5 rounded">
                <s.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{s.value}</div>
            <div className="text-[10px] text-[#008069] dark:text-[#25D366] font-semibold">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Chart & Suggestions */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs lg:col-span-2 space-y-3">
          <SectionTitle title="Pipeline Growth" hint="Revenue in ₹ Lakhs" />
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#008069" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#008069" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#008069"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-2.5">
            <SectionTitle title="AI Autopilot Suggestions" hint="Call & Lead Intelligence" />
            <ul className="space-y-2">
              {serverCalls.length > 0 && serverCalls[0].summary ? (
                <li className="text-xs bg-muted/60 p-2.5 rounded border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-foreground text-xs font-bold">
                      🔥 {serverLeads.find(l => l.id === serverCalls[0].leadId)?.name || "Customer Call"}
                    </strong>
                    <span className="text-[10px] text-[#008069] font-bold">AI Call Intel</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    "{serverCalls[0].summary}"
                  </p>
                  {serverCalls[0].analysis?.recommendedNextAction && (
                    <div className="text-[10px] text-[#008069] font-semibold">
                      Recommended: {serverCalls[0].analysis.recommendedNextAction}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Link
                      to="/call-autopilot"
                      className="bg-[#008069] text-white px-2 py-0.5 rounded text-[10px] font-bold hover:opacity-90 transition"
                    >
                      Call with AI
                    </Link>
                    <Link
                      to="/leads"
                      className="bg-muted border border-border text-foreground px-2 py-0.5 rounded text-[10px] font-medium hover:bg-muted/80 transition"
                    >
                      View Lead
                    </Link>
                  </div>
                </li>
              ) : hot.length > 0 ? (
                hot.map(l => (
                  <li key={`sug-${l.id}`} className="text-xs bg-muted/60 p-2.5 rounded border border-border">
                    <strong className="text-foreground">{l.name}</strong> ({l.company}): Score is {l.score}/100. Next: {l.nextAction}.
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground text-xs text-center py-4">No suggestions right now.</li>
              )}
            </ul>
          </div>
          <Link
            to="/call-autopilot"
            className="text-[#008069] dark:text-[#00a884] font-semibold text-xs flex items-center gap-1 mt-3 hover:underline"
          >
            <span>Manage Call Autopilot & AI Rules</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Hot Leads & Schedule */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs space-y-2.5">
          <SectionTitle title="Hot Leads Priority" hint="Ranked by AI Score" />
          <div className="space-y-2">
            {hot.map((l) => (
              <Link
                key={l.id}
                to="/conversations"
                className="hover:bg-muted/60 flex items-center gap-3 rounded-lg p-2 transition border border-transparent hover:border-border"
              >
                <span className="bg-[#008069] text-white grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                  {l.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-foreground">{l.name}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {l.company} · {l.nextAction}
                  </span>
                </span>
                <span className="text-[#008069] dark:text-[#25D366] text-xs font-bold">{l.score} pts</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-xs space-y-2.5">
          <SectionTitle title="Today's Schedule" />
          <ul className="space-y-2 text-xs">
            {todayTasks.length > 0 ? (
              todayTasks.map(t => (
                <li key={t.id} className="flex justify-between items-center bg-muted/60 p-2.5 rounded border border-border">
                  <span>
                    <strong className="text-foreground block text-xs">{t.title}</strong>
                    <span className="text-muted-foreground text-[11px]">{t.lead}</span>
                  </span>
                  <span className="bg-[#008069]/10 text-[#008069] dark:text-[#00a884] px-2 py-0.5 rounded text-[10px] font-semibold">{t.tag}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground text-center py-4">No tasks scheduled for today.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

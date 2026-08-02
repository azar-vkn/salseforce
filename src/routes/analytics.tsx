import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { GlassCard, SectionTitle } from "@/components/glass";
import { useLeads } from "@/hooks/use-supabase";
export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SalesMind AI" },
      { name: "description", content: "Revenue, pipeline, lead sources and conversion insights." },
      { property: "og:title", content: "Analytics — SalesMind AI" },
      {
        property: "og:description",
        content: "Revenue, pipeline, lead sources and conversion insights.",
      },
    ],
  }),
  component: Analytics,
});

const tooltipStyle = {
  borderRadius: 18,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  fontSize: 12,
};

const pieColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function Analytics() {
  const { data: leads = [], isLoading } = useLeads();

  const parseValue = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0;
    if (valStr.toLowerCase().includes('l')) return num * 100000;
    if (valStr.toLowerCase().includes('k')) return num * 1000;
    if (valStr.toLowerCase().includes('cr')) return num * 10000000;
    return num;
  };

  const formatLakhs = (val: number) => `₹${(val / 100000).toFixed(1)}L`;

  const wonLeads = leads.filter(l => l.stage === "Won");
  const totalWon = wonLeads.reduce((sum, l) => sum + parseValue(l.value), 0);
  
  const winRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;
  const avgDealSize = wonLeads.length > 0 ? totalWon / wonLeads.length : 0;

  const funnelSeries = [
    { stage: "New", value: leads.filter(l => l.stage === "New").length },
    { stage: "Qualified", value: leads.filter(l => l.stage === "Qualified").length },
    { stage: "Proposal", value: leads.filter(l => l.stage === "Proposal").length },
    { stage: "Negotiation", value: leads.filter(l => l.stage === "Negotiation").length },
    { stage: "Won", value: wonLeads.length },
  ];

  const statuses = ["Unread", "Read", "Replied", "Archived"];
  let sourceSeries = statuses.map(s => ({
    name: s,
    value: leads.filter(l => l.status === s).length
  })).filter(s => s.value > 0);

  if (sourceSeries.length === 0) {
    sourceSeries = [{ name: "No data", value: 1 }];
  }

  const revenueSeries = [
    { month: "Jan", revenue: 2.4, target: 2.0 },
    { month: "Feb", revenue: 3.1, target: 2.5 },
    { month: "Mar", revenue: 2.8, target: 3.0 },
    { month: "Apr", revenue: 4.2, target: 3.5 },
    { month: "May", revenue: 3.9, target: 4.0 },
    { month: "Jun", revenue: totalWon > 0 ? Number((totalWon / 100000).toFixed(1)) : 4.5, target: 4.5 },
  ];

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Last 6 months</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total revenue", v: totalWon > 0 ? formatLakhs(totalWon) : "₹0" },
          { l: "Win rate", v: `${winRate}%` },
          { l: "Avg deal size", v: avgDealSize > 0 ? formatLakhs(avgDealSize) : "₹0" },
          { l: "Sales cycle", v: "18 days" }, // Mocked cycle as there are no dates
        ].map((s, i) => (
          <GlassCard key={s.l} delay={i * 60} className="p-4 sm:p-5">
            <div className="text-2xl font-bold tracking-tight sm:text-3xl">{s.v}</div>
            <div className="text-muted-foreground mt-1 text-xs">{s.l}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard delay={220} className="lg:col-span-2">
          <SectionTitle title="Revenue vs target" hint="₹ Lakhs" />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-chart-1)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2}
                  strokeDasharray="5 6"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={280}>
          <SectionTitle title="Lead Status Breakdown" />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceSeries}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={4}
                  stroke="none"
                >
                  {sourceSeries.map((s, i) => (
                    <Cell key={s.name} fill={s.name === "No data" ? "var(--color-muted)" : pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {sourceSeries.filter(s => s.name !== "No data").map((s, i) => {
              const total = sourceSeries.reduce((acc, curr) => acc + curr.value, 0);
              const percentage = Math.round((s.value / total) * 100);
              return (
                <span key={s.name} className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: pieColors[i % pieColors.length] }}
                  />
                  {s.name} {percentage}%
                </span>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard delay={320} className="lg:col-span-2">
          <SectionTitle title="Conversion funnel" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelSeries} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="stage"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[14, 14, 14, 14]} fill="var(--color-chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={360}>
          <SectionTitle title="AI insights" />
          <ul className="mt-2 space-y-2 text-sm">
            {leads.length > 0 ? (
              <>
                <li className="text-muted-foreground px-3 py-2 text-xs border-b border-border/40">
                  <strong className="text-foreground">Win Rate Note:</strong> Your current win rate is {winRate}%. 
                  {winRate < 20 ? " Focus on higher quality leads in the New stage." : " Great job maintaining a healthy conversion rate!"}
                </li>
                {leads.filter(l => l.score > 80 && l.stage !== "Won").length > 0 && (
                  <li className="text-muted-foreground px-3 py-2 text-xs">
                    <strong className="text-foreground">Hot Pipeline:</strong> You have {leads.filter(l => l.score > 80 && l.stage !== "Won").length} high-intent leads waiting to be closed.
                  </li>
                )}
              </>
            ) : (
              <li className="text-muted-foreground px-3 py-2.5 text-center text-xs">
                No insights available yet.
              </li>
            )}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

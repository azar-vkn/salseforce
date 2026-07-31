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
import { funnelSeries, revenueSeries, sourceSeries } from "@/lib/mock-data";

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
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Last 6 months</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total revenue", v: "₹1.64 Cr" },
          { l: "Win rate", v: "31%" },
          { l: "Avg deal size", v: "₹3.8L" },
          { l: "Sales cycle", v: "18 days" },
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
          <SectionTitle title="Lead sources" />
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
                    <Cell key={s.name} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {sourceSeries.map((s, i) => (
              <span key={s.name} className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: pieColors[i % pieColors.length] }}
                />
                {s.name} {s.value}%
              </span>
            ))}
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
            {[
              "WhatsApp leads convert 2.3× faster than ads.",
              "Deals stall most at Proposal — add ROI proof earlier.",
              "Best call window: Tue–Thu, 11 AM–1 PM.",
            ].map((t) => (
              <li key={t} className="glass rounded-[18px] px-3 py-2.5 leading-snug">
                {t}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

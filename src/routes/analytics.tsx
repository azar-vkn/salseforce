import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
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
import {
  Download,
  FileSpreadsheet,
  CalendarRange,
  ChevronDown,
  Filter,
  Loader2,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  ArrowDownToLine,
} from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/glass";
import { useLeads, useBolnaCalls } from "@/hooks/use-supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Lead, BolnaCallRecord } from "@/lib/types";
import * as XLSX from "xlsx";

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

// ── Date Range Presets ────────────────────────────────────────────

type RangePreset = {
  label: string;
  getRange: () => { from: string; to: string };
};

const RANGE_PRESETS: RangePreset[] = [
  {
    label: "Last 7 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { from: fmt(from), to: fmt(to) };
    },
  },
  {
    label: "Last 30 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from: fmt(from), to: fmt(to) };
    },
  },
  {
    label: "Last 3 months",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 3);
      return { from: fmt(from), to: fmt(to) };
    },
  },
  {
    label: "Last 6 months",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 6);
      return { from: fmt(from), to: fmt(to) };
    },
  },
  {
    label: "This year",
    getRange: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), 0, 1);
      return { from: fmt(from), to: fmt(to) };
    },
  },
  {
    label: "All time",
    getRange: () => ({ from: "", to: "" }),
  },
];

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toLocalISO(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// ── Excel export helpers ──────────────────────────────────────────

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function leadsToRows(leads: Lead[]) {
  return leads.map((l) => ({
    Name: l.name,
    Company: l.company,
    Stage: l.stage,
    Status: l.status,
    Value: l.value,
    Score: l.score,
    Emotion: l.emotion,
    "Next Action": l.nextAction,
    Phone: l.phone || l.dna?.phone || "",
    WhatsApp: l.whatsapp || l.dna?.whatsapp || "",
    Email: l.email || l.dna?.email || "",
    "Created At": l.createdAt || "",
    "Updated At": l.updatedAt || "",
    "DNA Budget": l.dna?.budget ?? "",
    "DNA Intent": l.dna?.intent ?? "",
    "DNA Trust": l.dna?.trust ?? "",
    "DNA Urgency": l.dna?.urgency ?? "",
    "DNA Confidence": l.dna?.confidence ?? "",
    "DNA Language": l.dna?.language || "",
    "DNA Style": l.dna?.style || "",
  }));
}

function callsToRows(calls: BolnaCallRecord[]) {
  return calls.map((c) => ({
    Direction: c.direction,
    Status: c.status,
    "Execution ID": c.bolna_execution_id || "",
    Summary: c.summary || "",
    "Recording URL": c.recording_url || "",
    "Created At": c.created_at,
    "Updated At": c.updated_at,
  }));
}

function summaryToRows(stats: {
  totalRevenue: string;
  winRate: string;
  avgDealSize: string;
  totalLeads: number;
  totalCalls: number;
  stageBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}) {
  return [
    { Metric: "Total Revenue", Value: stats.totalRevenue },
    { Metric: "Win Rate", Value: stats.winRate },
    { Metric: "Avg Deal Size", Value: stats.avgDealSize },
    { Metric: "Total Leads", Value: String(stats.totalLeads) },
    { Metric: "Total Calls", Value: String(stats.totalCalls) },
    { Metric: "", Value: "" },
    { Metric: "── Stage Breakdown ──", Value: "" },
    ...Object.entries(stats.stageBreakdown).map(([k, v]) => ({
      Metric: k,
      Value: String(v),
    })),
    { Metric: "", Value: "" },
    { Metric: "── Status Breakdown ──", Value: "" },
    ...Object.entries(stats.statusBreakdown).map(([k, v]) => ({
      Metric: k,
      Value: String(v),
    })),
  ];
}

// ── Main Page ─────────────────────────────────────────────────────

function Analytics() {
  const { data: allLeads = [], isLoading: loadingLeads } = useLeads();
  const { data: allCalls = [], isLoading: loadingCalls } = useBolnaCalls();

  // Date range state
  const defaultRange = RANGE_PRESETS[3].getRange(); // Last 6 months
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [activePreset, setActivePreset] = useState("Last 6 months");
  const [showPresets, setShowPresets] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter leads by date range
  const leads = useMemo(() => {
    if (!dateFrom && !dateTo) return allLeads;
    return allLeads.filter((l) => {
      const d = l.createdAt || l.updatedAt || "";
      if (!d) return true; // include leads without dates
      const date = d.slice(0, 10);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    });
  }, [allLeads, dateFrom, dateTo]);

  // Filter calls by date range
  const calls = useMemo(() => {
    if (!dateFrom && !dateTo) return allCalls;
    return allCalls.filter((c) => {
      const d = c.created_at || "";
      if (!d) return true;
      const date = d.slice(0, 10);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    });
  }, [allCalls, dateFrom, dateTo]);

  // Analytics computations
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

  // Stage breakdown for summary
  const stageBreakdown: Record<string, number> = {};
  leads.forEach(l => { stageBreakdown[l.stage] = (stageBreakdown[l.stage] || 0) + 1; });
  const statusBreakdown: Record<string, number> = {};
  leads.forEach(l => { statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1; });

  // ── Preset selection ────────────────────────────────
  const handlePresetSelect = (preset: RangePreset) => {
    const range = preset.getRange();
    setDateFrom(range.from);
    setDateTo(range.to);
    setActivePreset(preset.label);
    setShowPresets(false);
  };

  // ── Range label ─────────────────────────────────────
  const rangeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "All time";
    const from = dateFrom ? new Date(dateFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const to = dateTo ? new Date(dateTo).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Today";
    return `${from} → ${to}`;
  }, [dateFrom, dateTo]);

  // ── Download filtered data ──────────────────────────
  const handleDownloadFiltered = useCallback(() => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = summaryToRows({
        totalRevenue: totalWon > 0 ? formatLakhs(totalWon) : "₹0",
        winRate: `${winRate}%`,
        avgDealSize: avgDealSize > 0 ? formatLakhs(avgDealSize) : "₹0",
        totalLeads: leads.length,
        totalCalls: calls.length,
        stageBreakdown,
        statusBreakdown,
      });
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Leads sheet
      if (leads.length > 0) {
        const leadsWs = XLSX.utils.json_to_sheet(leadsToRows(leads));
        XLSX.utils.book_append_sheet(wb, leadsWs, "Leads");
      }

      // Calls sheet
      if (calls.length > 0) {
        const callsWs = XLSX.utils.json_to_sheet(callsToRows(calls));
        XLSX.utils.book_append_sheet(wb, callsWs, "Calls");
      }

      // Revenue chart data
      const revenueWs = XLSX.utils.json_to_sheet(revenueSeries);
      XLSX.utils.book_append_sheet(wb, revenueWs, "Revenue vs Target");

      // Funnel data
      const funnelWs = XLSX.utils.json_to_sheet(funnelSeries);
      XLSX.utils.book_append_sheet(wb, funnelWs, "Conversion Funnel");

      const suffix = dateFrom ? `_${dateFrom}_to_${dateTo || "today"}` : "_all";
      downloadWorkbook(wb, `SalesMind_Analytics${suffix}.xlsx`);
      toast.success(`📊 Analytics exported (${leads.length} leads, ${calls.length} calls)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  }, [leads, calls, totalWon, winRate, avgDealSize, revenueSeries, funnelSeries, stageBreakdown, statusBreakdown, dateFrom, dateTo, formatLakhs]);

  // ── Download ALL data (unfiltered) ──────────────────
  const handleDownloadAll = useCallback(() => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Summary
      const allStageBreakdown: Record<string, number> = {};
      allLeads.forEach(l => { allStageBreakdown[l.stage] = (allStageBreakdown[l.stage] || 0) + 1; });
      const allStatusBreakdown: Record<string, number> = {};
      allLeads.forEach(l => { allStatusBreakdown[l.status] = (allStatusBreakdown[l.status] || 0) + 1; });

      const allWon = allLeads.filter(l => l.stage === "Won");
      const allTotalWon = allWon.reduce((s, l) => s + parseValue(l.value), 0);
      const allWinRate = allLeads.length > 0 ? Math.round((allWon.length / allLeads.length) * 100) : 0;
      const allAvg = allWon.length > 0 ? allTotalWon / allWon.length : 0;

      const summaryData = summaryToRows({
        totalRevenue: allTotalWon > 0 ? formatLakhs(allTotalWon) : "₹0",
        winRate: `${allWinRate}%`,
        avgDealSize: allAvg > 0 ? formatLakhs(allAvg) : "₹0",
        totalLeads: allLeads.length,
        totalCalls: allCalls.length,
        stageBreakdown: allStageBreakdown,
        statusBreakdown: allStatusBreakdown,
      });
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // All leads
      if (allLeads.length > 0) {
        const leadsWs = XLSX.utils.json_to_sheet(leadsToRows(allLeads));
        XLSX.utils.book_append_sheet(wb, leadsWs, "All Leads");
      }

      // All calls
      if (allCalls.length > 0) {
        const callsWs = XLSX.utils.json_to_sheet(callsToRows(allCalls));
        XLSX.utils.book_append_sheet(wb, callsWs, "All Calls");
      }

      downloadWorkbook(wb, `SalesMind_Full_Export_${toLocalISO(new Date())}.xlsx`);
      toast.success(`📦 Full bulk export done (${allLeads.length} leads, ${allCalls.length} calls)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  }, [allLeads, allCalls, parseValue, formatLakhs]);

  if (loadingLeads || loadingCalls) {
    return (
      <div className="flex items-center justify-center p-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header with Date Range & Download Controls ─────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            {rangeLabel}
            <span className="text-muted-foreground/60">
              · {leads.length} leads · {calls.length} calls
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/60 transition shadow-xs"
            >
              <Filter className="h-3.5 w-3.5 text-primary" />
              {activePreset}
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", showPresets && "rotate-180")} />
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-border/60 bg-popover shadow-xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePresetSelect(p)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-muted/50",
                      activePreset === p.label ? "text-primary bg-primary/5" : "text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset("Custom");
              }}
              className="rounded-xl border border-border/60 bg-card/80 backdrop-blur px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-[120px]"
            />
            <span className="text-[10px] text-muted-foreground font-medium">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset("Custom");
              }}
              className="rounded-xl border border-border/60 bg-card/80 backdrop-blur px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-[120px]"
            />
          </div>

          {/* Download Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadFiltered}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition shadow-xs disabled:opacity-50"
              title="Download filtered analytics as Excel"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export Range
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition shadow-xs disabled:opacity-50"
              title="Download all data as Excel (no date filter)"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Full Export
            </button>
          </div>
        </div>
      </header>

      {/* Click-away for preset dropdown */}
      {showPresets && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPresets(false)} />
      )}

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total revenue", v: totalWon > 0 ? formatLakhs(totalWon) : "₹0", icon: DollarSign, color: "text-emerald-400" },
          { l: "Win rate", v: `${winRate}%`, icon: TrendingUp, color: "text-blue-400" },
          { l: "Avg deal size", v: avgDealSize > 0 ? formatLakhs(avgDealSize) : "₹0", icon: BarChart3, color: "text-violet-400" },
          { l: "Sales cycle", v: "18 days", icon: Clock, color: "text-amber-400" },
        ].map((s, i) => (
          <GlassCard key={s.l} delay={i * 60} className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">{s.v}</div>
                <div className="text-muted-foreground mt-1 text-xs">{s.l}</div>
              </div>
              <div className={cn("p-2 rounded-lg bg-muted/40", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────── */}
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

      {/* ── Charts Row 2 ─────────────────────────────────────── */}
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

      {/* ── Download Summary Footer ──────────────────────────── */}
      <GlassCard delay={400} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Data Export</p>
            <p className="text-xs text-muted-foreground">
              Export includes: Summary metrics, Leads, Calls, Revenue chart data, Conversion funnel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadFiltered}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export Selected Range (.xlsx)
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Full Bulk Export (.xlsx)
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Radio,
  Search,
  X,
  ExternalLink,
  Trash2,
  Calendar,
  CalendarClock,
  StopCircle,
  RefreshCw,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { GlassCard, Island, EmptyState } from "@/components/glass";
import {
  useLeads,
  useBolnaCalls,
  useTriggerBolnaCall,
  useCancelBolnaCall,
  useDeleteBolnaCall,
  useRescheduleBolnaCall,
  usePurgeQueuedCalls,
} from "@/hooks/use-supabase";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { type BolnaCallRecord, type BolnaCallStatus, type Lead } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/call-autopilot")({
  head: () => ({
    meta: [
      { title: "Call Autopilot — SalesMind AI" },
      { name: "description", content: "Bolna AI Voice Agent — Trigger outbound calls and track live call status." },
    ],
  }),
  component: CallAutopilotPage,
});

// ── Status Helpers ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BolnaCallStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  initiated: {
    label: "Initiated",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: Clock,
  },
  scheduled: {
    label: "Scheduled",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    icon: Clock,
  },
  queued: {
    label: "Queued",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: Loader2,
  },
  "in-progress": {
    label: "In Progress",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10 border-teal-500/20",
    icon: Radio,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: BolnaCallStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.initiated;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.bgColor,
        config.color
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          status === "queued" && "animate-spin",
          status === "in-progress" && "animate-pulse"
        )}
      />
      {config.label}
    </span>
  );
}

function DirectionIcon({ direction }: { direction: "outbound" | "inbound" }) {
  return direction === "outbound" ? (
    <PhoneOutgoing className="h-4 w-4 text-blue-400" />
  ) : (
    <PhoneIncoming className="h-4 w-4 text-emerald-400" />
  );
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ── Main Page ──────────────────────────────────────────────────────

function CallAutopilotPage() {
  const { data: calls = [], isLoading: loadingCalls } = useBolnaCalls();
  const { data: leads = [] } = useLeads();
  const queryClient = useQueryClient();
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Subscribe to Realtime updates on the calls table
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("bolna-calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["bolna_calls"] });
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as BolnaCallRecord;
            if (updated.status === "in-progress") {
              toast.info("📞 Call is now in progress");
            } else if (updated.status === "completed") {
              toast.success("✅ Call completed");
            } else if (updated.status === "failed") {
              toast.error("❌ Call failed");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Build a lead lookup map
  const leadMap = useMemo(() => {
    const map: Record<string, Lead> = {};
    for (const lead of leads) {
      map[lead.id] = lead;
    }
    return map;
  }, [leads]);

  // Active calls (not completed/failed)
  const activeCalls = calls.filter(
    (c) => !["completed", "failed"].includes(c.status)
  );

  // Filter calls by search query
  const filteredCalls = useMemo(() => {
    if (!searchQuery.trim()) return calls;
    const q = searchQuery.toLowerCase();
    return calls.filter((c) => {
      const lead = c.lead_id ? leadMap[c.lead_id] : null;
      return (
        (lead?.name || "").toLowerCase().includes(q) ||
        c.direction.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        (c.bolna_execution_id || "").toLowerCase().includes(q) ||
        (c.summary || "").toLowerCase().includes(q)
      );
    });
  }, [calls, searchQuery, leadMap]);

  const purgeQueued = usePurgeQueuedCalls();

  const handlePurgeQueue = async () => {
    if (!confirm("Are you sure you want to stop and cancel all active / queued calls?")) return;
    try {
      await purgeQueued.mutateAsync();
      toast.success("🛑 All active and queued calls have been stopped.");
    } catch (err: any) {
      toast.error(err.message || "Failed to purge calls");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Call Autopilot (Voice)
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Bolna AI voice calls — trigger outbound calls, reschedule, and manage live queues
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeCalls.length > 0 && (
            <button
              onClick={handlePurgeQueue}
              disabled={purgeQueued.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition shadow-xs"
            >
              {purgeQueued.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5" />
              )}
              Stop All Active Calls ({activeCalls.length})
            </button>
          )}
          <CallLeadDialog leads={leads} />
        </div>
      </div>

      {/* Active Calls Panel */}
      {activeCalls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Live Active Queue ({activeCalls.length})
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeCalls.map((call) => (
              <LiveCallCard
                key={call.id}
                call={call}
                lead={call.lead_id ? leadMap[call.lead_id] : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Calls Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Call History ({filteredCalls.length})
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search calls..."
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {loadingCalls ? (
          <GlassCard className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground text-sm">Loading calls...</span>
          </GlassCard>
        ) : filteredCalls.length === 0 ? (
          <GlassCard>
            <EmptyState
              title="No calls yet"
              description="Trigger your first outbound call using the 'Call a Lead' button above. Call records will appear here in real time."
            />
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <ScrollArea className="max-h-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Direction
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Lead
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Summary
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map((call) => {
                    const lead = call.lead_id
                      ? leadMap[call.lead_id]
                      : undefined;
                    const isExpanded = expandedCallId === call.id;

                    return (
                      <CallTableRow
                        key={call.id}
                        call={call}
                        lead={lead}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedCallId(isExpanded ? null : call.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

// ── Reschedule Call Dialog ──────────────────────────────────────────

function RescheduleCallDialog({
  call,
  lead,
  trigger,
}: {
  call: BolnaCallRecord;
  lead?: Lead;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [note, setNote] = useState("");
  const rescheduleCall = useRescheduleBolnaCall();

  const handleReschedule = async () => {
    if (!rescheduleDate) {
      toast.error("Please pick a valid date and time.");
      return;
    }
    try {
      await rescheduleCall.mutateAsync({
        call_id: call.id,
        execution_id: call.bolna_execution_id,
        lead_id: call.lead_id,
        reschedule_time: rescheduleDate,
        note: note.trim() || undefined,
      });
      toast.success(
        `🗓️ Call rescheduled for ${new Date(rescheduleDate).toLocaleString()}`
      );
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule call");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 transition"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-violet-400" />
            Reschedule Call
          </DialogTitle>
          <DialogDescription>
            Stop current queued execution and schedule a new callback slot for{" "}
            <span className="font-semibold text-foreground">
              {lead?.name || "this lead"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Target Callback Date & Time
            </label>
            <input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Optional Note / Agenda
            </label>
            <input
              type="text"
              placeholder="e.g. Lead requested evening callback after 6 PM"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <button className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </DialogClose>
          <button
            onClick={handleReschedule}
            disabled={rescheduleCall.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
          >
            {rescheduleCall.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Save Reschedule
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Live Call Card ──────────────────────────────────────────────────

function LiveCallCard({
  call,
  lead,
}: {
  call: BolnaCallRecord;
  lead?: Lead;
}) {
  const cancelCall = useCancelBolnaCall();
  const deleteCall = useDeleteBolnaCall();

  const isPendingStatus = ["initiated", "scheduled", "queued", "in-progress", "ringing"].includes(
    call.status
  );

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Stop and cancel active call for ${lead?.name || "this lead"}?`)) return;
    try {
      await cancelCall.mutateAsync({
        call_id: call.id,
        execution_id: call.bolna_execution_id,
      });
      toast.success("🛑 Call stopped and cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to stop call");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete call record for ${lead?.name || "this lead"}?`)) return;
    try {
      await deleteCall.mutateAsync({
        call_id: call.id,
        execution_id: call.bolna_execution_id,
      });
      toast.success("🗑️ Call record removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete call record");
    }
  };

  return (
    <GlassCard className="relative overflow-hidden flex flex-col justify-between">
      {/* Animated pulse indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
        </span>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {lead?.name || "Unknown Caller"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {call.direction === "outbound" ? "Outbound" : "Inbound"} •{" "}
              {formatTime(call.created_at)}
            </p>
          </div>
        </div>

        {/* Status Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={call.status} />
            <span className="text-[11px] font-mono text-muted-foreground">
              {call.bolna_execution_id ? `#${call.bolna_execution_id.slice(0, 8)}` : ""}
            </span>
          </div>
          <CallStatusProgress status={call.status} />
        </div>

        {/* Live Transcript */}
        {call.transcript && (
          <div className="mt-3 rounded-lg bg-muted/40 border border-border/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Live Transcript
            </p>
            <p className="text-xs text-foreground leading-relaxed line-clamp-4">
              {call.transcript}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons Toolbar */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {isPendingStatus && (
            <button
              onClick={handleCancel}
              disabled={cancelCall.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition"
              title="Stop and cancel this call immediately"
            >
              {cancelCall.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StopCircle className="h-3 w-3" />
              )}
              Stop Call
            </button>
          )}
          <RescheduleCallDialog
            call={call}
            lead={lead}
            trigger={
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition"
                title="Reschedule this call for later"
              >
                <CalendarClock className="h-3 w-3" /> Reschedule
              </button>
            }
          />
        </div>

        <button
          onClick={handleDelete}
          disabled={deleteCall.isPending}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
          title="Delete call record"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </GlassCard>
  );
}

// ── Status Progress Bar ────────────────────────────────────────────

function CallStatusProgress({ status }: { status: BolnaCallStatus }) {
  const steps: BolnaCallStatus[] = [
    "initiated",
    "scheduled",
    "queued",
    "in-progress",
    "completed",
  ];
  const currentIdx = steps.indexOf(status);

  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((step, idx) => (
        <div
          key={step}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-all duration-500",
            idx <= currentIdx
              ? status === "failed"
                ? "bg-red-400"
                : "bg-primary"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

// ── Call Table Row ──────────────────────────────────────────────────

function CallTableRow({
  call,
  lead,
  isExpanded,
  onToggle,
}: {
  call: BolnaCallRecord;
  lead?: Lead;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cancelCall = useCancelBolnaCall();
  const deleteCall = useDeleteBolnaCall();

  const isPendingStatus = ["initiated", "scheduled", "queued", "in-progress", "ringing"].includes(
    call.status
  );

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Cancel call for ${lead?.name || "this lead"}?`)) return;
    try {
      await cancelCall.mutateAsync({
        call_id: call.id,
        execution_id: call.bolna_execution_id,
      });
      toast.success("🛑 Call stopped");
    } catch (err: any) {
      toast.error(err.message || "Failed to stop call");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete call record for ${lead?.name || "this lead"}?`)) return;
    try {
      await deleteCall.mutateAsync({
        call_id: call.id,
        execution_id: call.bolna_execution_id,
      });
      toast.success("🗑️ Record deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete call");
    }
  };

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors",
          isExpanded && "bg-muted/20"
        )}
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <DirectionIcon direction={call.direction} />
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {lead ? (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                  {lead.initials}
                </div>
                <span className="font-medium text-foreground truncate max-w-[140px]">
                  {lead.name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground italic">Unknown</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <StatusBadge status={call.status} />
        </td>
        <td className="py-3 px-4 text-muted-foreground text-xs">
          {formatTime(call.created_at)}
        </td>
        <td className="py-3 px-4 text-muted-foreground text-xs max-w-[180px] truncate">
          {call.summary || "—"}
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isPendingStatus && (
              <button
                onClick={handleCancel}
                disabled={cancelCall.isPending}
                className="p-1 rounded text-muted-foreground hover:text-rose-400 transition"
                title="Stop / Cancel Call"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </button>
            )}
            <RescheduleCallDialog
              call={call}
              lead={lead}
              trigger={
                <button
                  className="p-1 rounded text-muted-foreground hover:text-violet-400 transition"
                  title="Reschedule Call"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                </button>
              }
            />
            <button
              onClick={handleDelete}
              disabled={deleteCall.isPending}
              className="p-1 rounded text-muted-foreground hover:text-rose-400 transition"
              title="Delete Record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onToggle}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition ml-1"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 inline" />
              ) : (
                <ChevronDown className="h-4 w-4 inline" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr className="bg-muted/10">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Transcript */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Transcript
                </p>
                {call.transcript ? (
                  <ScrollArea className="max-h-48 rounded-lg bg-card border border-border/40 p-3">
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {call.transcript}
                    </p>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No transcript available
                    {["initiated", "scheduled", "queued", "in-progress"].includes(call.status)
                      ? " — will appear when the call completes"
                      : ""}
                  </p>
                )}
              </div>

              {/* Summary & Metadata */}
              <div className="space-y-3">
                {call.summary && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Summary
                    </p>
                    <p className="text-xs text-foreground leading-relaxed">
                      {call.summary}
                    </p>
                  </div>
                )}

                {call.recording_url && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Recording
                    </p>
                    <a
                      href={call.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Play className="h-3 w-3" /> Play Recording
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Action Buttons in Expanded View */}
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  {isPendingStatus && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelCall.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <StopCircle className="h-3.5 w-3.5" /> Stop / Cancel Call
                    </button>
                  )}
                  <RescheduleCallDialog
                    call={call}
                    lead={lead}
                    trigger={
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition">
                        <CalendarClock className="h-3.5 w-3.5" /> Reschedule Call
                      </button>
                    }
                  />
                  <button
                    onClick={handleDelete}
                    disabled={deleteCall.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Record
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Call Lead Dialog ────────────────────────────────────────────────

function CallLeadDialog({ leads }: { leads: Lead[] }) {
  const [open, setOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [customPhone, setCustomPhone] = useState("");
  const triggerCall = useTriggerBolnaCall();

  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  const phoneNumber = customPhone || selectedLead?.phone || selectedLead?.whatsapp || "";

  const leadsWithPhone = leads.filter((l) => l.phone || l.whatsapp);

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a valid phone number with country code.");
      return;
    }

    let cleanPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");
    if (!cleanPhone.startsWith("+")) {
      if (/^[6-9]\d{9}$/.test(cleanPhone)) {
        cleanPhone = `+91${cleanPhone}`;
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    try {
      await triggerCall.mutateAsync({
        lead_id: selectedLeadId || undefined,
        phone_number: cleanPhone,
      });
      toast.success(`📞 Call initiated to ${selectedLead?.name || cleanPhone}`);
      setOpen(false);
      setSelectedLeadId("");
      setCustomPhone("");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger call");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Island className="gap-2 px-4 py-2 text-sm" icon={<Phone className="h-4 w-4" />}>
          Call a Lead
        </Island>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Trigger Outbound Call
          </DialogTitle>
          <DialogDescription>
            Select a lead and start an AI voice call via Bolna. The call status
            will update live on this page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lead Selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Select Lead
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => {
                setSelectedLeadId(e.target.value);
                setCustomPhone("");
              }}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Choose a lead —</option>
              {leadsWithPhone.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} ({lead.company}) — {lead.phone || lead.whatsapp}
                </option>
              ))}
            </select>
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder="+91 9244444999"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">
              Country code will be formatted automatically (e.g. +91 9244444999).
            </p>
          </div>

          {/* Selected Lead Preview */}
          {selectedLead && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                  {selectedLead.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLead.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLead.company} • Score: {selectedLead.score}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <button className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </DialogClose>
          <button
            onClick={handleCall}
            disabled={!phoneNumber || triggerCall.isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
              triggerCall.isPending && "animate-pulse"
            )}
          >
            {triggerCall.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                Start Call
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

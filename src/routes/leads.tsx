import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutGrid,
  Rows3,
  Plus,
  PhoneCall,
  MessageSquare,
  Search,
  X,
  Edit2,
  Trash,
  Download,
  Activity,
  CheckCircle2,
  PhoneIncoming,
  PhoneOutgoing,
  Bot,
  UserCheck,
  FileText,
  Clock,
  Sparkles,
  Shield,
} from "lucide-react";
import { Ring } from "@/components/glass";
import { type Lead, type CallRecord, type CallTranscriptItem } from "@/lib/types";
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useClearAllLeads,
  useCalls,
  useAddCallRecord,
  useCallSettings,
} from "@/hooks/use-supabase";
import { getVoiceProvider } from "@/lib/call-autopilot/voice-provider";
import { buildCallAiContext } from "@/lib/call-autopilot/call-context-builder";
import { analyzeCallTranscript } from "@/lib/call-autopilot/call-analyzer";
import { calculateUpdatedBuyerDna } from "@/lib/call-autopilot/buyer-dna-updater";
import { evaluateHumanHandoff } from "@/lib/call-autopilot/human-handoff-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — SalesMind AI" },
      { name: "description", content: "Lead scores, Buyer DNA and AI-suggested next actions." },
      { property: "og:title", content: "Leads — SalesMind AI" },
      { property: "og:description", content: "Lead scores, Buyer DNA and AI-suggested next actions." },
    ],
  }),
  component: LeadsPage,
});

const emotionTone: Record<Lead["emotion"], string> = {
  Excited: "bg-[#008069]/10 text-[#008069] dark:text-[#25D366] border border-[#008069]/20",
  Curious: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  Hesitant: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  Neutral: "bg-muted text-muted-foreground border border-border",
  Frustrated: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
};

const defaultDna = {
  budget: 50,
  intent: 50,
  trust: 50,
  priceSensitivity: 50,
  urgency: 50,
  language: "English · Professional tone",
  style: "Prefers data-driven conversations",
  confidence: 60,
};

function LeadsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("All");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: leads = [], isLoading, error } = useLeads();
  const { data: calls = [] } = useCalls();
  const { data: callSettings } = useCallSettings();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const clearAllLeads = useClearAllLeads();
  const addCallRecord = useAddCallRecord();

  // ── Call Autopilot UI State ──────────────────────────────────────
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeCallRecord, setActiveCallRecord] = useState<CallRecord | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<CallTranscriptItem[]>([]);
  const [liveConfidence, setLiveConfidence] = useState(90);
  const [liveDuration, setLiveDuration] = useState(0);
  const [viewingCallDetail, setViewingCallDetail] = useState<CallRecord | null>(null);

  // ── Start AI Outbound Voice Call (Production Telephony) ──────────
  async function handleStartAiCall(lead: Lead) {
    const phone = lead.phone || lead.whatsapp;
    if (!phone) {
      toast.warning(`Please save a phone number for ${lead.name} before initiating an AI voice call.`);
      return;
    }

    try {
      const provider = getVoiceProvider({ provider: "twilio" });
      toast.info(`📱 Initiating Production Twilio AI Outbound Call to ${lead.name} (${phone})…`);
      const callRec = await provider.startOutboundCall(phone, lead.id);
      setActiveCallRecord(callRec);
      addCallRecord.mutate(callRec);
      toast.success(`✅ Twilio Outbound Call Initiated (SID: ${callRec.providerCallId || callRec.id}). Call status: ${callRec.status}`);
    } catch (err: any) {
      toast.error(err.message || "Call Autopilot is not configured.");
    }
  }

  const exportCsv = () => {
    if (!leads.length) return;
    const headers = ["ID", "Name", "Company", "Stage", "Score", "Value", "Emotion", "Status", "Email", "Phone", "WhatsApp"];
    
    const escapeCsv = (val: string | number | undefined, isPhone = false) => {
      if (val === undefined || val === null || val === "") return '""';
      const str = String(val).replace(/"/g, '""');
      if (isPhone || /^\+?\d{7,}$/.test(str)) {
        return `="${str}"`; // Prevents Excel scientific notation (e.g. 9.18E+11)
      }
      return `"${str}"`;
    };

    const rows = leads.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.name),
      escapeCsv(l.company),
      escapeCsv(l.stage),
      l.score,
      escapeCsv(l.value),
      escapeCsv(l.emotion),
      escapeCsv(l.status),
      escapeCsv(l.email),
      escapeCsv(l.phone || l.whatsapp, true),
      escapeCsv(l.whatsapp || l.phone, true),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    // Add UTF-8 BOM (\uFEFF) so Excel opens UTF-8 special characters correctly without garbled text
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `salesmind-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported leads to CSV");
  };

  const filtered = leads.filter((l) => {
    const matchesQuery = (l.name + l.company + l.stage).toLowerCase().includes(query.toLowerCase());
    const matchesStage = selectedStage === "All" || l.stage === selectedStage;
    return matchesQuery && matchesStage;
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-lg bg-card border border-border px-4 py-3 shadow-xs">
          <div className="h-4 w-4 rounded-full border-2 border-[#008069] border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-foreground">Loading leads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 text-sm">Error loading leads: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">Leads Pipeline</h1>
            <span className="text-[10px] font-semibold text-[#008069] dark:text-[#25D366] bg-[#008069]/10 px-2 py-0.5 rounded">
              {filtered.length} Opportunities
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime scoring, WhatsApp integration & Buyer DNA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded text-xs font-medium border border-border transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[#008069] dark:bg-[#00a884] hover:opacity-90 text-white flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>
          {leads.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all leads? New leads will be created automatically when customers send a message.")) {
                  clearAllLeads.mutate(undefined, {
                    onSuccess: () => {
                      setSelected(null);
                      toast.success("All leads cleared. Ready for inbound customer messages!");
                    },
                  });
                }
              }}
              className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer"
            >
              <Trash className="h-3.5 w-3.5" />
              <span>Clear All Leads</span>
            </button>
          )}
        </div>
      </header>

      {/* Search & Layout Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md bg-card border border-border px-3 text-xs">
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, company, or stage…"
            className="min-w-0 flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-card border border-border p-0.5">
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={`${v} view`}
              className={cn(
                "rounded p-1.5 transition cursor-pointer",
                view === v
                  ? "bg-[#008069] dark:bg-[#00a884] text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "cards" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Filter Chips */}
      <div className="flex flex-wrap gap-1">
        {["All", "New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStage(st)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer",
              selectedStage === st
                ? "bg-[#008069] dark:bg-[#00a884] text-white font-semibold"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {st}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3 shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#008069]/10 flex items-center justify-center text-[#008069] dark:text-[#00a884]">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Leads Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Leads will be generated automatically when clients or customers send an inbound message to your WhatsApp number.
          </p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <div key={l.id} className="bg-card border border-border rounded-lg p-3.5 shadow-xs space-y-3 hover:border-[#008069]/40 transition">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#008069] text-white text-xs font-bold">
                  {l.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-foreground">{l.name}</h3>
                  <p className="text-muted-foreground truncate text-xs">{l.company}</p>
                </div>
                <div className="text-right">
                  <div className="text-[#008069] dark:text-[#25D366] text-base font-bold">{l.score}</div>
                  <div className="text-muted-foreground text-[9px] uppercase font-semibold">Score</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 text-[10px] font-medium">
                <span className="bg-muted px-2 py-0.5 rounded border border-border">{l.stage}</span>
                <span className={cn("px-2 py-0.5 rounded", emotionTone[l.emotion])}>
                  {l.emotion}
                </span>
                <span className="bg-[#008069]/10 text-[#008069] dark:text-[#00a884] px-2 py-0.5 rounded font-bold">
                  {l.value}
                </span>
              </div>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                {l.phone || l.whatsapp ? (
                  <div className="text-foreground font-medium flex items-center gap-1">
                    <span className="text-[#008069]">📱</span> {l.phone || l.whatsapp}
                  </div>
                ) : (
                  <div className="text-amber-500 font-medium text-[11px]">
                    ⚠️ No phone number saved
                  </div>
                )}
                {l.email && <div className="text-[11px] truncate">✉️ {l.email}</div>}
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-border flex-wrap">
                <button
                  className="bg-[#008069]/10 text-[#008069] dark:text-[#00a884] hover:bg-[#008069]/20 flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                  onClick={() => navigate({ to: "/conversations" })}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Chat</span>
                </button>
                <button
                  className="bg-[#008069] text-white hover:opacity-90 flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold shadow-xs transition cursor-pointer"
                  onClick={() => handleStartAiCall(l)}
                  title="Initiate AI Voice Call with full CRM context"
                >
                  <PhoneCall className="h-3 w-3" />
                  <span>Call with AI</span>
                </button>
                <button
                  className="bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium border border-border transition cursor-pointer"
                  onClick={() => setSelected(l)}
                >
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <span>DNA</span>
                </button>
                <button
                  className="bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1 rounded px-2 py-1 text-xs transition cursor-pointer"
                  onClick={() => setEditingLead(l)}
                >
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  className="text-rose-500 hover:bg-rose-500/10 rounded p-1 text-xs transition cursor-pointer ml-auto"
                  onClick={() => {
                    if (confirm(`Delete ${l.name}?`)) {
                      deleteLead.mutate(l.id, {
                        onSuccess: () => toast.success("Lead deleted"),
                        onError: (e) => toast.error(`Failed to delete: ${e.message}`)
                      });
                    }
                  }}
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Call History Snippet */}
              {(() => {
                const leadCalls = calls.filter((c) => c.leadId === l.id);
                if (leadCalls.length === 0) return null;
                const lastCall = leadCalls[0];
                return (
                  <div className="bg-muted/60 border border-border rounded p-2 text-[11px] space-y-1 mt-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <PhoneCall className="h-3 w-3 text-[#008069]" />
                        {lastCall.direction === "OUTBOUND" ? "AI Outbound" : "AI Inbound"} · {Math.floor(lastCall.duration / 60)}m {lastCall.duration % 60}s
                      </span>
                      <button
                        onClick={() => setViewingCallDetail(lastCall)}
                        className="text-[#008069] dark:text-[#00a884] font-semibold hover:underline cursor-pointer text-[10px]"
                      >
                        View Details
                      </button>
                    </div>
                    <p className="text-foreground line-clamp-1 italic">{lastCall.summary || "AI conversation logged."}</p>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto shadow-xs">
          <table className="w-full min-w-[50rem] text-xs">
            <thead className="text-muted-foreground text-left uppercase border-b border-border bg-muted/40">
              <tr>
                {["Lead", "Company", "Stage", "Score", "Value", "Phone", "Next action"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="hover:bg-muted/50 cursor-pointer transition"
                >
                  <td className="px-3 py-2.5 font-semibold text-foreground">{l.name}</td>
                  <td className="text-muted-foreground px-3 py-2.5">{l.company}</td>
                  <td className="px-3 py-2.5">
                    <span className="bg-muted px-2 py-0.5 rounded border border-border">{l.stage}</span>
                  </td>
                  <td className="text-[#008069] dark:text-[#25D366] font-bold px-3 py-2.5">{l.score}</td>
                  <td className="font-semibold text-foreground px-3 py-2.5">{l.value}</td>
                  <td className="text-muted-foreground px-3 py-2.5">{l.phone || "-"}</td>
                  <td className="text-muted-foreground px-3 py-2.5">{l.nextAction}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingLead(l); }}
                      className="hover:bg-muted mr-1.5 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${l.name}?`)) {
                          deleteLead.mutate(l.id, {
                            onSuccess: () => toast.success("Lead deleted"),
                          });
                        }
                      }}
                      className="hover:bg-rose-500/10 text-rose-500 rounded p-1"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Buyer DNA Modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-md rounded-lg p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Buyer DNA · {selected.name}</h3>
                <p className="text-muted-foreground text-xs">{selected.company}</p>
              </div>
              <button onClick={() => setSelected(null)} className="hover:bg-muted rounded p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <Ring label="Budget" value={selected.dna.budget} size={48} />
              <Ring label="Intent" value={selected.dna.intent} size={48} />
              <Ring label="Trust" value={selected.dna.trust} size={48} />
              <Ring label="Price" value={selected.dna.priceSensitivity} size={48} />
              <Ring label="Urgency" value={selected.dna.urgency} size={48} />
            </div>

            <div className="grid gap-1.5 text-xs">
              <div className="bg-muted p-2 rounded border border-border">
                <span className="text-[10px] text-muted-foreground block">Communication</span>
                <span className="font-medium text-foreground">{selected.dna.language}</span>
              </div>
              <div className="bg-muted p-2 rounded border border-border">
                <span className="text-[10px] text-muted-foreground block">Decision Style</span>
                <span className="font-medium text-foreground">{selected.dna.style}</span>
              </div>
            </div>

            {/* AI Call Intelligence Section */}
            {(() => {
              const leadCalls = calls.filter((c) => c.leadId === selected.id);
              const lastCall = leadCalls[0];
              if (!lastCall) return null;
              return (
                <div className="bg-muted/70 border border-border rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-bold text-[#008069] dark:text-[#00a884] flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Call Intelligence
                    </span>
                    <span className="text-[10px] text-muted-foreground">{lastCall.startedAt.slice(0, 10)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">Duration</span>
                      <span className="font-semibold text-foreground">{Math.floor(lastCall.duration / 60)}m {lastCall.duration % 60}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Outcome</span>
                      <span className="font-semibold text-foreground">{lastCall.outcome || "Qualified"}</span>
                    </div>
                  </div>

                  {lastCall.summary && (
                    <p className="text-[11px] text-foreground italic bg-background/60 p-2 rounded border border-border">
                      "{lastCall.summary}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#008069] font-bold">✓ Buyer DNA updated from call</span>
                    <button
                      onClick={() => setViewingCallDetail(lastCall)}
                      className="text-xs text-[#008069] hover:underline font-semibold cursor-pointer"
                    >
                      View Transcript & Analysis
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelected(null)}
                className="bg-[#008069] text-white text-xs font-semibold px-4 py-1.5 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add / Edit Lead Modal */}
      {(showAddForm || editingLead) ? (
        <LeadFormModal
          key={editingLead?.id || "new-lead"}
          initialData={editingLead}
          onClose={() => {
            setShowAddForm(false);
            setEditingLead(null);
          }}
          onSave={(lead) => {
            if (editingLead) {
              updateLead.mutate({ id: editingLead.id, data: lead }, {
                onSuccess: (updated) => {
                  toast.success("Lead updated successfully!");
                  if (selected?.id === editingLead.id && updated) {
                    setSelected(updated);
                  }
                  setEditingLead(null);
                },
                onError: (err) => {
                  toast.error(`Failed to update: ${err.message}`);
                },
              });
            } else {
              createLead.mutate(lead, {
                onSuccess: () => {
                  toast.success("Lead added successfully!");
                  setShowAddForm(false);
                },
                onError: (err) => {
                  toast.error(`Failed to add: ${err.message}`);
                },
              });
            }
          }}
          isSaving={createLead.isPending || updateLead.isPending}
        />
      ) : null}

      {/* Call Details Modal */}
      {viewingCallDetail ? (
        <CallDetailsModal
          call={viewingCallDetail}
          onClose={() => setViewingCallDetail(null)}
        />
      ) : null}
    </div>
  );
}

function CallDetailsModal({ call, onClose }: { call: CallRecord; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-xl rounded-lg p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-[#008069]" />
            <h3 className="text-sm font-bold text-foreground">
              {call.direction === "OUTBOUND" ? "AI Outbound Call Details" : "AI Inbound Call Details"}
            </h3>
          </div>
          <button onClick={onClose} className="hover:bg-muted rounded p-1 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted p-2 rounded border border-border">
            <span className="text-[10px] text-muted-foreground block">Duration</span>
            <span className="font-bold text-foreground">{Math.floor(call.duration / 60)}m {call.duration % 60}s</span>
          </div>
          <div className="bg-muted p-2 rounded border border-border">
            <span className="text-[10px] text-muted-foreground block">Status</span>
            <span className="font-bold text-foreground">{call.status}</span>
          </div>
          <div className="bg-muted p-2 rounded border border-border">
            <span className="text-[10px] text-muted-foreground block">Provider</span>
            <span className="font-bold text-foreground">{call.provider}</span>
          </div>
        </div>

        {call.summary && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">AI Call Summary</h4>
            <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded border border-border leading-relaxed">
              {call.summary}
            </p>
          </div>
        )}

        {call.transcripts && call.transcripts.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-foreground">Voice Transcript</h4>
            <div className="bg-background/80 border border-border rounded p-3 space-y-2 max-h-56 overflow-y-auto text-xs">
              {call.transcripts.map((t, idx) => (
                <div key={idx} className="leading-snug">
                  <span className={cn("font-bold text-[10px] uppercase mr-1.5", t.speaker === "AI" ? "text-[#008069]" : "text-purple-600")}>
                    {t.speaker}:
                  </span>
                  <span className="text-foreground text-[11px]">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-[#008069] text-white text-xs font-semibold px-4 py-1.5 rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadFormModal({
  initialData,
  onClose,
  onSave,
  isSaving,
}: {
  initialData: Lead | null;
  onClose: () => void;
  onSave: (lead: Omit<Lead, "id">) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [company, setCompany] = useState(initialData?.company || "");
  const [stage, setStage] = useState<Lead["stage"]>(initialData?.stage || "New");
  const [value, setValue] = useState(initialData?.value || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [nextAction, setNextAction] = useState(initialData?.nextAction || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;

    const parts = name.trim().split(" ");
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.trim().slice(0, 2).toUpperCase();

    const phoneVal = phone.trim();
    const whatsappVal = whatsapp.trim() || phoneVal;

    onSave({
      name: name.trim(),
      company: company.trim(),
      initials,
      score: initialData?.score ?? 50,
      stage,
      nextAction: nextAction.trim() || "Initial outreach",
      emotion: initialData?.emotion ?? "Neutral",
      status: initialData?.status ?? "Unread",
      value: value.trim() || "₹0",
      phone: phoneVal || undefined,
      whatsapp: whatsappVal || undefined,
      email: email.trim() || undefined,
      dna: initialData?.dna ?? defaultDna,
    });
  }

  const inputClass =
    "bg-muted focus:ring-1 focus:ring-[#008069] h-9 w-full rounded px-3 text-xs outline-none border border-border text-foreground";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-md rounded-lg p-5 shadow-xl space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="text-sm font-bold text-foreground">{initialData ? "Edit Lead" : "Add New Lead"}</h3>
          <button onClick={onClose} className="hover:bg-muted rounded p-1 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Azar"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">Company *</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. SalesMind Global"
              className={inputClass}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground mb-1 block text-[11px] font-medium">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Lead["stage"])}
                className={inputClass}
              >
                {(["New", "Qualified", "Proposal", "Negotiation", "Won"] as const).map((s) => (
                  <option key={s} value={s} className="bg-card text-foreground">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-[11px] font-medium">Deal Value</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. ₹10.0L"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">WhatsApp Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 918778948875"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[11px] font-medium">Next Action</label>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Schedule demo"
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-muted px-3 py-1.5 rounded text-xs font-medium hover:bg-muted/80 text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || !company.trim()}
              className="bg-[#008069] dark:bg-[#00a884] text-white font-semibold px-4 py-1.5 rounded text-xs shadow-xs transition hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : initialData ? "Save Changes" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

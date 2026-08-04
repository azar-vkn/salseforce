import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, Rows3, Plus, PhoneCall, MessageCircle, CalendarPlus, Search, X, Edit2, Trash, Download } from "lucide-react";
import { GlassCard, Island, Ring } from "@/components/glass";
import { type Lead } from "@/lib/types";
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from "@/hooks/use-supabase";
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
  Excited: "bg-primary/15 text-primary",
  Curious: "bg-chart-3/20 text-foreground",
  Hesitant: "bg-warning/20 text-foreground",
  Neutral: "bg-muted text-muted-foreground",
  Frustrated: "bg-destructive/20 text-destructive",
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
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const exportCsv = () => {
    if (!leads.length) return;
    const headers = ["ID", "Name", "Company", "Stage", "Score", "Value", "Emotion", "Status", "Email", "Phone"];
    const rows = leads.map((l) => [
      l.id,
      `"${l.name}"`,
      `"${l.company}"`,
      l.stage,
      l.score,
      `"${l.value}"`,
      l.emotion,
      l.status,
      l.email || "",
      l.phone || "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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
    return <div className="p-8 text-center text-muted-foreground">Loading leads...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading leads: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Leads Pipeline</h1>
          <p className="text-muted-foreground mt-1 text-sm">{filtered.length} active opportunities · Realtime scoring & DNA</p>
        </div>
        <div className="flex items-center gap-2">
          <Island
            variant="glass"
            className="px-3 py-2 text-xs hover:scale-105 transition"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={exportCsv}
          >
            Export CSV
          </Island>
          <Island icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddForm(true)}>
            Add Lead
          </Island>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[20px] px-4">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, company, or stage…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="glass flex shrink-0 items-center gap-1 rounded-[20px] p-1">
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={`${v} view`}
              className={cn(
                "rounded-[16px] p-2.5 transition",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {v === "cards" ? <LayoutGrid className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        {["All", "New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStage(st)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-full transition",
              selectedStage === st
                ? "bg-primary text-primary-foreground shadow-xs"
                : "glass text-muted-foreground hover:text-foreground"
            )}
          >
            {st}
          </button>
        ))}
      </div>


      {view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l, i) => (
            <GlassCard key={l.id} delay={i * 60} className="group">
              <div className="flex items-start gap-3">
                <span className="bg-primary-soft text-primary grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold">
                  {l.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold">{l.name}</h3>
                  <p className="text-muted-foreground truncate text-xs">{l.company}</p>
                </div>
                <div className="text-right">
                  <div className="text-primary text-lg font-bold">{l.score}</div>
                  <div className="text-muted-foreground text-[10px]">score</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
                <span className="glass rounded-full px-2.5 py-1">{l.stage}</span>
                <span className={cn("rounded-full px-2.5 py-1", emotionTone[l.emotion])}>
                  {l.emotion}
                </span>
                <span className="glass rounded-full px-2.5 py-1">{l.status}</span>
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1">Deal: {l.value}</span>
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {l.phone || l.whatsapp ? (
                  <div className="text-foreground font-medium flex items-center gap-1">
                    <span>📞</span> {l.phone || l.whatsapp}
                  </div>
                ) : (
                  <div className="text-amber-500 font-medium flex items-center gap-1">
                    <span>⚠️</span> No phone number saved
                  </div>
                )}
                {l.email && <div>✉️ {l.email}</div>}
              </div>

              <p className="text-muted-foreground mt-3 text-xs">
                Next action · <span className="text-foreground font-medium">{l.nextAction}</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<PhoneCall className="h-3.5 w-3.5" />}
                  onClick={() => toast(`Calling ${l.name}…`)}
                >
                  Call
                </Island>
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  onClick={() => navigate({ to: "/conversations" })}
                >
                  Message
                </Island>
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<CalendarPlus className="h-3.5 w-3.5" />}
                  onClick={() => setSelected(l)}
                >
                  DNA
                </Island>
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<Edit2 className="h-3.5 w-3.5" />}
                  onClick={() => setEditingLead(l)}
                >
                  Edit
                </Island>
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs text-red-500 hover:bg-red-500/10"
                  icon={<Trash className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${l.name}?`)) {
                      deleteLead.mutate(l.id, {
                        onSuccess: () => toast.success("Lead deleted"),
                        onError: (e) => toast.error(`Failed to delete: ${e.message}`)
                      });
                    }
                  }}
                >
                  Delete
                </Island>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                {["Lead", "Company", "Stage", "Score", "Value", "Phone", "WhatsApp", "Email", "Next action"].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="hover:bg-primary-soft/50 cursor-pointer transition"
                >
                  <td className="rounded-l-[16px] px-3 py-3 font-medium whitespace-nowrap">{l.name}</td>
                  <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">{l.company}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{l.stage}</td>
                  <td className="text-primary px-3 py-3 font-semibold whitespace-nowrap">{l.score}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{l.value}</td>
                  <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">{l.phone || "-"}</td>
                  <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">{l.whatsapp || "-"}</td>
                  <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">{l.email || "-"}</td>
                  <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">{l.nextAction}</td>
                  <td className="rounded-r-[16px] px-3 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingLead(l); }}
                      className="hover:bg-muted mr-2 rounded p-1 transition"
                      aria-label="Edit lead"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${l.name}?`)) {
                          deleteLead.mutate(l.id, {
                            onSuccess: () => toast.success("Lead deleted"),
                          });
                        }
                      }}
                      className="hover:bg-red-500/10 text-red-500 rounded p-1 transition"
                      aria-label="Delete lead"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Buyer DNA Modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="glass rise w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[30px] p-6"
              onClick={(e) => e.stopPropagation()}
            >
            <h3 className="text-lg font-semibold">Buyer DNA · {selected.name}</h3>
            <p className="text-muted-foreground text-xs">{selected.company}</p>
            <div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-5">
              <Ring label="Budget" value={selected.dna.budget} />
              <Ring label="Intent" value={selected.dna.intent} />
              <Ring label="Trust" value={selected.dna.trust} />
              <Ring label="Price sensitivity" value={selected.dna.priceSensitivity} />
              <Ring label="Urgency" value={selected.dna.urgency} />
            </div>
            <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
              <span className="glass rounded-[18px] px-3 py-2">{selected.dna.language}</span>
              <span className="glass rounded-[18px] px-3 py-2">{selected.dna.style}</span>
              <span className="bg-primary/12 text-primary rounded-[18px] px-3 py-2 font-semibold">
                Confidence {selected.dna.confidence}%
              </span>
            </div>
              <div className="mt-5 flex justify-end">
                <Island onClick={() => setSelected(null)}>Close</Island>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add/Edit Lead Modal */}
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
                  toast.error(`Failed to update lead: ${err.message}`);
                },
              });
            } else {
              createLead.mutate(lead, {
                onSuccess: () => {
                  toast.success("Lead added successfully!");
                  setShowAddForm(false);
                },
                onError: (err) => {
                  toast.error(`Failed to add lead: ${err.message}`);
                },
              });
            }
          }}
          isSaving={createLead.isPending || updateLead.isPending}
        />
      ) : null}

    </div>
  );
}

// ── Lead Form Modal ──────────────────────────────────────────────────
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
    "bg-background/60 focus:ring-ring/60 h-11 w-full rounded-[16px] px-4 text-sm outline-none focus:ring-2";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="glass rise w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[30px] p-6"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{initialData ? "Edit Lead" : "Add New Lead"}</h3>
          <button onClick={onClose} className="hover:bg-muted rounded-full p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Company *</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Lead["stage"])}
              className={inputClass}
            >
              {(["New", "Qualified", "Proposal", "Negotiation", "Won"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Deal Value</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. ₹5L"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">WhatsApp (Optional)</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Same as phone if left empty"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">Next Action</label>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Schedule demo call"
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Island variant="glass" onClick={onClose}>
              Cancel
            </Island>
            <Island type="submit" disabled={isSaving || !name.trim() || !company.trim()}>
              {isSaving ? "Saving…" : initialData ? "Save Changes" : "Add Lead"}
            </Island>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

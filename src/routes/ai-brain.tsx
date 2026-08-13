import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Zap,
  Database,
  Plus,
  Search,
  FileText,
  HelpCircle,
  AlertTriangle,
  Building2,
  Briefcase,
  Package,
  DollarSign,
  Tag,
  FileCode,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Upload,
  BookOpen,
  Eye,
  Trash2,
  Edit,
  Check,
  X,
  Filter,
} from "lucide-react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import {
  useKnowledgeItems,
  useCreateKnowledgeItem,
  useUpdateKnowledgeItem,
  useDeleteKnowledgeItem,
  useKnowledgeDocuments,
  useUploadDocument,
  useBusinessRules,
  useCreateBusinessRule,
  useDeleteBusinessRule,
  useUnknownQuestions,
  useAnswerUnknownQuestion,
  useAiBrainStats,
} from "@/hooks/use-ai-brain";
import { executeAiBrainPipeline } from "@/lib/ai-brain-engine";
import { useLeads } from "@/hooks/use-supabase";
import { type KnowledgeType, type KnowledgeStatus, type KnowledgeItem } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-brain")({
  head: () => ({
    meta: [
      { title: "CRM AI Brain — Single Source of Truth" },
      { name: "description", content: "Central AI Brain storing company knowledge, services, pricing, policies, FAQs, business rules, and document RAG." },
    ],
  }),
  component: CrmAiBrainSuite,
});

type TabType =
  | "overview"
  | "company"
  | "services"
  | "products"
  | "pricing"
  | "offers"
  | "policies"
  | "faqs"
  | "documents"
  | "rules"
  | "unknown"
  | "sandbox";

const tabs: { id: TabType; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Zap },
  { id: "company", label: "Company", icon: Building2 },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "products", label: "Products", icon: Package },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "offers", label: "Offers", icon: Tag },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "faqs", label: "FAQs", icon: HelpCircle },
  { id: "documents", label: "Documents", icon: BookOpen },
  { id: "rules", label: "Business Rules", icon: ShieldCheck },
  { id: "unknown", label: "Unknown Questions", icon: AlertTriangle },
  { id: "sandbox", label: "AI Sandbox", icon: Bot },
];

function CrmAiBrainSuite() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addType, setAddType] = useState<KnowledgeType>("service");

  // Unknown Question Answer Modal state
  const [selectedUnansweredQ, setSelectedUnansweredQ] = useState<any | null>(null);
  const [approvedAnswerInput, setApprovedAnswerInput] = useState("");

  // Data Hooks
  const stats = useAiBrainStats();
  const { data: allItems = [] } = useKnowledgeItems();
  const { data: documents = [] } = useKnowledgeDocuments();
  const { data: rules = [] } = useBusinessRules();
  const { data: unknownQuestions = [] } = useUnknownQuestions();
  const { data: leads = [] } = useLeads();

  const createKnowledge = useCreateKnowledgeItem();
  const updateKnowledge = useUpdateKnowledgeItem();
  const deleteKnowledge = useDeleteKnowledgeItem();
  const uploadDoc = useUploadDocument();
  const createRule = useCreateBusinessRule();
  const deleteRule = useDeleteBusinessRule();
  const answerUnknown = useAnswerUnknownQuestion();

  // Sandbox Chat State
  const [sandboxMessages, setSandboxMessages] = useState<
    { id: string; role: "user" | "ai"; text: string; sources?: string[]; confidence?: number }[]
  >([
    {
      id: "intro",
      role: "ai",
      text: "Hello! I am your Central CRM AI Brain. Ask me any question regarding your company, services, pricing, policies, FAQs, or documents to see how I ground answers exclusively in your published knowledge.",
      confidence: 100,
    },
  ]);
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxThinking, setSandboxThinking] = useState(false);

  // Filtered knowledge items
  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(item.content).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Sandbox Ask
  async function askSandbox(q: string) {
    if (!q.trim() || sandboxThinking) return;
    const userMsg = { id: crypto.randomUUID(), role: "user" as const, text: q };
    setSandboxMessages((prev) => [...prev, userMsg]);
    setSandboxInput("");
    setSandboxThinking(true);

    try {
      const result = await executeAiBrainPipeline(q, leads[0]);
      setSandboxMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai" as const,
          text: result.replyText,
          sources: result.knowledgeSourcesUsed,
          confidence: result.confidence,
        },
      ]);
    } catch {
      setSandboxMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai" as const,
          text: "An error occurred retrieving knowledge from the AI Brain.",
          confidence: 50,
        },
      ]);
    } finally {
      setSandboxThinking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="from-[#008069] to-[#00a884] grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br text-white shadow-lg shadow-[#008069]/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">CRM AI Brain</h1>
              <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {stats.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Single central source of truth for company knowledge across all CRM channels</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Island
            variant="primary"
            className="px-4 py-2.5 text-xs font-semibold hover:scale-105 transition"

            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setAddType("service");
              setIsAddModalOpen(true);
            }}
          >
            + Add Knowledge
          </Island>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b border-border/80 pb-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badgeCount =
            tab.id === "unknown"
              ? unknownQuestions.filter((q) => q.status === "UNANSWERED").length
              : tab.id === "documents"
              ? documents.length
              : tab.id === "rules"
              ? rules.length
              : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0",
                isActive
                  ? "bg-[#008069] text-white shadow-md shadow-[#008069]/20 font-semibold"
                  : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {badgeCount !== undefined && badgeCount > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-500"
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW DASHBOARD ───────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Knowledge Items</span>
              <strong className="text-xl font-bold text-foreground">{stats.knowledgeItemsCount}</strong>
              <span className="text-[10px] text-emerald-500 font-semibold block">● Published</span>
            </GlassCard>

            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Services</span>
              <strong className="text-xl font-bold text-foreground">{stats.servicesCount}</strong>
              <span className="text-[10px] text-muted-foreground block">Catalogue</span>
            </GlassCard>

            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Products</span>
              <strong className="text-xl font-bold text-foreground">{stats.productsCount}</strong>
              <span className="text-[10px] text-muted-foreground block">Active Tiers</span>
            </GlassCard>

            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">FAQs & Policies</span>
              <strong className="text-xl font-bold text-foreground">{stats.faqsCount + stats.policiesCount}</strong>
              <span className="text-[10px] text-muted-foreground block">Grounded Info</span>
            </GlassCard>

            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Documents</span>
              <strong className="text-xl font-bold text-foreground">{stats.documentsCount}</strong>
              <span className="text-[10px] text-muted-foreground block">Parsed RAG</span>
            </GlassCard>

            <GlassCard className="p-3.5 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Business Rules</span>
              <strong className="text-xl font-bold text-foreground">{stats.businessRulesCount}</strong>
              <span className="text-[10px] text-muted-foreground block">Safeguards</span>
            </GlassCard>
          </div>

          {/* AI Brain Health & Statistics */}
          <div className="grid lg:grid-cols-3 gap-4">
            <GlassCard className="space-y-4 lg:col-span-2">
              <SectionTitle title="Central Knowledge Coverage & AI Accuracy" />
              <div className="grid sm:grid-cols-3 gap-3 text-center">
                <div className="glass rounded-xl p-3 border border-border/40">
                  <span className="text-xs text-muted-foreground block">Knowledge Coverage</span>
                  <strong className="text-2xl font-bold text-emerald-500">{stats.knowledgeCoverage}%</strong>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Calculated from published data</span>
                </div>
                <div className="glass rounded-xl p-3 border border-border/40">
                  <span className="text-xs text-muted-foreground block">Questions Answered</span>
                  <strong className="text-2xl font-bold text-foreground">{stats.questionsAnswered}</strong>
                  <span className="text-[10px] text-emerald-500 font-semibold block mt-0.5">Zero hallucinations</span>
                </div>
                <div className="glass rounded-xl p-3 border border-border/40">
                  <span className="text-xs text-muted-foreground block">Pending Unknown Questions</span>
                  <strong className="text-2xl font-bold text-amber-500">{stats.unknownQuestionsCount}</strong>
                  <span className="text-[10px] text-amber-500 block mt-0.5">Requires Admin Answer</span>
                </div>
              </div>

              {/* Architecture Graphic */}
              <div className="glass rounded-xl p-4 space-y-2 border border-border/50 bg-card/30">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-[#008069]" /> Single Source of Truth Engine
                  </span>
                  <span className="text-[10px] text-muted-foreground">Updated {stats.lastUpdated}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All AI features (WhatsApp, Webchat, Auto-reply, Sandbox) query this single central repository. Company policies and pricing override generic model assumptions.
                </p>
              </div>
            </GlassCard>

            {/* Quick Actions & Safeguards */}
            <GlassCard className="space-y-4">
              <SectionTitle title="Knowledge Operations" />
              <div className="space-y-2.5 text-xs">
                <button
                  onClick={() => setActiveTab("unknown")}
                  className="w-full flex items-center justify-between glass p-3 rounded-xl hover:scale-[1.02] transition border border-border/40"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-foreground">Review Unknown Questions</span>
                  </div>
                  <span className="text-xs font-bold bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                    {stats.unknownQuestionsCount} Pending
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("documents")}
                  className="w-full flex items-center justify-between glass p-3 rounded-xl hover:scale-[1.02] transition border border-border/40"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-foreground">Upload Company Documents</span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <button
                  onClick={() => setActiveTab("sandbox")}
                  className="w-full flex items-center justify-between glass p-3 rounded-xl hover:scale-[1.02] transition border border-border/40"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-[#008069]" />
                    <span className="font-semibold text-foreground">Test AI Brain Sandbox</span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ── TAB 2: COMPANY INFORMATION ─────────────────────────────── */}
      {activeTab === "company" && (
        <CompanyInformationView allItems={allItems} createKnowledge={createKnowledge} updateKnowledge={updateKnowledge} />
      )}

      {/* ── TABS 3 to 8: CATEGORIZED KNOWLEDGE ITEMS ───────────────── */}
      {["services", "products", "pricing", "offers", "policies", "faqs"].includes(activeTab) && (
        <CategorizedKnowledgeView
          categoryTab={activeTab as KnowledgeType}
          items={filteredItems.filter((i) => {
            if (activeTab === "services") return i.type === "service";
            if (activeTab === "products") return i.type === "product";
            if (activeTab === "pricing") return i.type === "pricing";
            if (activeTab === "offers") return i.type === "offer";
            if (activeTab === "policies") return i.type === "policy";
            if (activeTab === "faqs") return i.type === "faq";
            return true;
          })}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onAddClick={(t) => {
            setAddType(t);
            setIsAddModalOpen(true);
          }}
          updateKnowledge={updateKnowledge}
          deleteKnowledge={deleteKnowledge}
        />
      )}

      {/* ── TAB 9: DOCUMENTS ────────────────────────────────────────── */}
      {activeTab === "documents" && (
        <DocumentsView documents={documents} uploadDoc={uploadDoc} />
      )}

      {/* ── TAB 10: BUSINESS RULES ──────────────────────────────────── */}
      {activeTab === "rules" && (
        <BusinessRulesView rules={rules} createRule={createRule} deleteRule={deleteRule} />
      )}

      {/* ── TAB 11: UNKNOWN QUESTIONS ────────────────────────────────── */}
      {activeTab === "unknown" && (
        <UnknownQuestionsView
          questions={unknownQuestions}
          onAnswerClick={(q) => {
            setSelectedUnansweredQ(q);
            setApprovedAnswerInput("");
          }}
        />
      )}

      {/* ── TAB 12: AI SANDBOX ──────────────────────────────────────── */}
      {activeTab === "sandbox" && (
        <AiSandboxView
          messages={sandboxMessages}
          input={sandboxInput}
          setInput={setSandboxInput}
          thinking={sandboxThinking}
          ask={askSandbox}
        />
      )}

      {/* ── ADD KNOWLEDGE MODAL ─────────────────────────────────────── */}
      {isAddModalOpen && (
        <AddKnowledgeModal
          type={addType}
          setType={setAddType}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={async (data) => {
            await createKnowledge.mutateAsync(data);
            toast.success(`Published ${addType.toUpperCase()} to CRM AI Brain`);
            setIsAddModalOpen(false);
          }}
        />
      )}

      {/* ── ANSWER UNKNOWN QUESTION MODAL ────────────────────────────── */}
      {selectedUnansweredQ && (
        <AnswerUnknownModal
          question={selectedUnansweredQ}
          answerInput={approvedAnswerInput}
          setAnswerInput={setApprovedAnswerInput}
          onClose={() => setSelectedUnansweredQ(null)}
          onSubmit={async () => {
            if (!approvedAnswerInput.trim()) return;
            await answerUnknown.mutateAsync({
              id: selectedUnansweredQ.id,
              question: selectedUnansweredQ.question,
              approvedAnswer: approvedAnswerInput,
            });
            toast.success("Approved answer added & published to AI Brain!");
            setSelectedUnansweredQ(null);
          }}
        />
      )}
    </div>
  );
}

// ── SUB-COMPONENT: COMPANY INFORMATION VIEW ────────────────────────
function CompanyInformationView({
  allItems,
  createKnowledge,
  updateKnowledge,
}: {
  allItems: KnowledgeItem[];
  createKnowledge: any;
  updateKnowledge: any;
}) {
  const companyItem = allItems.find((i) => i.type === "company");
  const content = (companyItem?.content as Record<string, any>) || {};

  const [form, setForm] = useState({
    companyName: content.companyName || "SalesMind AI",
    industry: content.industry || "Enterprise SaaS",
    description: content.description || "Autonomous AI CRM & Pipeline Intelligence Platform",
    about: content.about || "SalesMind AI provides enterprise revenue automation.",
    locations: content.locations || "Bengaluru (HQ), San Francisco",
    businessHours: content.businessHours || "Mon – Fri, 9:00 AM – 7:00 PM IST",
    contactInfo: content.contactInfo || "support@salesmind.ai | +91 80 4920 1100",
    website: content.website || "https://salesmind.ai",
    socialLinks: content.socialLinks || "LinkedIn: salesmind-ai",
  });

  const [saving, setSaving] = useState(false);

  async function saveCompanyInfo() {
    setSaving(true);
    try {
      if (companyItem) {
        await updateKnowledge.mutateAsync({
          id: companyItem.id,
          data: {
            title: `${form.companyName} Company Information`,
            content: form,
            status: "PUBLISHED",
          },
        });
      } else {
        await createKnowledge.mutateAsync({
          type: "company",
          category: "Overview",
          title: `${form.companyName} Company Information`,
          content: form,
          status: "PUBLISHED",
          effectiveDate: new Date().toISOString(),
          sourceType: "Company Admin",
        });
      }
      toast.success("Company information saved & updated in AI Brain");
    } catch {
      toast.error("Failed to save company information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="space-y-5 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <SectionTitle title="Company Information Master Record" />
        <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
          Single Source of Truth
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="font-semibold text-foreground block mb-1">Company Name</label>
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1">Industry</label>
          <input
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="font-semibold text-foreground block mb-1">Short Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="font-semibold text-foreground block mb-1">About Company</label>
          <textarea
            rows={3}
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1">Office Locations</label>
          <input
            value={form.locations}
            onChange={(e) => setForm({ ...form, locations: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1">Business Hours</label>
          <input
            value={form.businessHours}
            onChange={(e) => setForm({ ...form, businessHours: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1">Contact Information</label>
          <input
            value={form.contactInfo}
            onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1">Website URL</label>
          <input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
          />
        </div>
      </div>

      <div className="flex justify-end pt-3">
        <button
          onClick={saveCompanyInfo}
          disabled={saving}
          className="bg-[#008069] hover:bg-[#00a884] text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition shadow-md cursor-pointer"
        >
          {saving ? "Saving..." : "Save Company Knowledge"}
        </button>
      </div>
    </GlassCard>
  );
}

// ── SUB-COMPONENT: CATEGORIZED KNOWLEDGE ITEMS VIEW ────────────────
function CategorizedKnowledgeView({
  categoryTab,
  items,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onAddClick,
  updateKnowledge,
  deleteKnowledge,
}: {
  categoryTab: KnowledgeType;
  items: KnowledgeItem[];
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onAddClick: (t: KnowledgeType) => void;
  updateKnowledge: any;
  deleteKnowledge: any;
}) {
  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-[16rem] flex-1">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${categoryTab}...`}
              className="w-full bg-card border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#008069]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer",
                statusFilter === st ? "bg-[#008069] text-white" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {st}
            </button>
          ))}

          <button
            onClick={() => onAddClick(categoryTab)}
            className="bg-[#008069] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-[#00a884] transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add {categoryTab}
          </button>
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <GlassCard className="p-8 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No {categoryTab} knowledge items found</p>
          <p className="text-xs text-muted-foreground">Click "+ Add {categoryTab}" to teach the CRM AI Brain.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const content = typeof item.content === "object" ? item.content : { text: item.content };

            return (
              <GlassCard key={item.id} className="p-4 space-y-3 flex flex-col justify-between border border-border/60">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {item.category || item.type}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                        item.status === "PUBLISHED"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : item.status === "DRAFT"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      v{item.version} · {item.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{item.title}</h3>

                  <div className="text-xs text-muted-foreground space-y-1 bg-card/40 p-2.5 rounded-xl border border-border/40">
                    {content.price && (
                      <div className="flex justify-between font-semibold text-foreground">
                        <span>Price:</span>
                        <span className="text-[#008069]">{content.price}</span>
                      </div>
                    )}
                    {content.deliveryTime && (
                      <div className="flex justify-between">
                        <span>Delivery:</span>
                        <span>{content.deliveryTime}</span>
                      </div>
                    )}
                    {content.question && (
                      <p className="font-semibold text-foreground italic">"{content.question}"</p>
                    )}
                    {content.answer && <p className="line-clamp-2">{content.answer}</p>}
                    {content.description && <p className="line-clamp-2">{content.description}</p>}
                    {content.refundPolicy && <p className="line-clamp-2">{content.refundPolicy}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <span className="text-[10px] text-muted-foreground">Source: {item.sourceType}</span>

                  <div className="flex items-center gap-1.5">
                    {item.status === "DRAFT" ? (
                      <button
                        onClick={() => {
                          updateKnowledge.mutate({ id: item.id, data: { status: "PUBLISHED" } });
                          toast.success("Published item to AI Brain");
                        }}
                        className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition"
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          updateKnowledge.mutate({ id: item.id, data: { status: "DRAFT" } });
                          toast.info("Moved item to Draft status");
                        }}
                        className="px-2 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-lg hover:text-foreground transition"
                      >
                        Unpublish
                      </button>
                    )}

                    <button
                      onClick={() => {
                        deleteKnowledge.mutate(item.id);
                        toast.success("Deleted knowledge item");
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive transition"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENT: DOCUMENTS VIEW ────────────────────────────────────
function DocumentsView({ documents, uploadDoc }: { documents: any[]; uploadDoc: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadDoc.mutateAsync(file);
      toast.success(`Uploaded and parsed ${file.name} for AI Brain RAG search`);
    } catch {
      toast.error("Failed to upload document");
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 text-center border-dashed border-2 border-border/80 space-y-3">
        <Upload className="h-8 w-8 text-[#008069] mx-auto" />
        <h3 className="text-sm font-bold text-foreground">Upload Company Documents</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Upload PDF, DOCX, TXT, or Markdown documents. Content will be parsed into chunks so the AI Brain can search text during customer interactions.
        </p>

        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleFileUpload} />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#008069] hover:bg-[#00a884] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
        >
          Select File to Process
        </button>
      </GlassCard>

      <SectionTitle title="Processed RAG Documents" />
      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No uploaded documents yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((d) => (
            <GlassCard key={d.id} className="p-4 space-y-2 border border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#008069]" />
                  <strong className="text-xs font-bold text-foreground">{d.title}</strong>
                </div>
                <span className="text-[10px] uppercase font-bold bg-muted px-2 py-0.5 rounded-md">
                  {d.fileType}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{d.rawContent}</p>
              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                <span>{d.chunkCount} Chunks Indexed</span>
                <span>v{d.version} · {d.status}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENT: BUSINESS RULES VIEW ───────────────────────────────
function BusinessRulesView({ rules, createRule, deleteRule }: { rules: any[]; createRule: any; deleteRule: any }) {
  const [ruleText, setRuleText] = useState("");
  const [ruleType, setRuleType] = useState<"do" | "dont" | "escalate" | "confidential">("dont");

  async function handleAddRule() {
    if (!ruleText.trim()) return;
    await createRule.mutateAsync({
      ruleType,
      ruleText,
      priority: rules.length + 1,
      status: "PUBLISHED",
    });
    setRuleText("");
    toast.success("Business rule active in AI Brain decision process");
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <GlassCard className="p-4 space-y-3">
        <SectionTitle title="Add AI Business Rule & Safeguard" />
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as any)}
            className="bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="dont">What AI CANNOT Say (Prohibited)</option>
            <option value="do">What AI MUST Say / Do</option>
            <option value="escalate">When Human Approval is Required</option>
            <option value="confidential">Confidential / Internal Only</option>
          </select>

          <input
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            placeholder="e.g. Never promise delivery dates unless documented in catalogue..."
            className="flex-1 bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          />

          <button
            onClick={handleAddRule}
            className="bg-[#008069] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#00a884] transition"
          >
            Add Rule
          </button>
        </div>
      </GlassCard>

      <div className="space-y-2">
        <SectionTitle title="Active Grounded Rules" />
        {rules.map((r, i) => (
          <GlassCard key={r.id} className="p-3 flex items-center justify-between border border-border/50">
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 grid place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                {i + 1}
              </span>
              <div>
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase px-2 py-0.5 rounded-md mr-2",
                    r.ruleType === "dont"
                      ? "bg-rose-500/15 text-rose-500"
                      : r.ruleType === "escalate"
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-emerald-500/15 text-emerald-500"
                  )}
                >
                  {r.ruleType}
                </span>
                <span className="text-xs text-foreground font-medium">{r.ruleText}</span>
              </div>
            </div>

            <button
              onClick={() => {
                deleteRule.mutate(r.id);
                toast.success("Rule removed");
              }}
              className="text-muted-foreground hover:text-destructive p-1 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ── SUB-COMPONENT: UNKNOWN QUESTIONS VIEW ────────────────────────────
function UnknownQuestionsView({ questions, onAnswerClick }: { questions: any[]; onAnswerClick: (q: any) => void }) {
  const unanswered = questions.filter((q) => q.status === "UNANSWERED");
  const resolved = questions.filter((q) => q.status === "RESOLVED");

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <GlassCard className="p-4 space-y-2 bg-amber-500/10 border-amber-500/30">
        <div className="flex items-center gap-2 text-amber-500 font-bold text-xs sm:text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>No-Hallucination Review Queue</span>
        </div>
        <p className="text-xs text-muted-foreground">
          When the AI cannot confidently answer a company-specific question from published knowledge, it logs the question here instead of guessing. Administrators provide approved answers which are then published to the AI Brain.
        </p>
      </GlassCard>

      <SectionTitle title={`Pending Review (${unanswered.length})`} />
      {unanswered.length === 0 ? (
        <GlassCard className="p-6 text-center text-xs text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
          All unknown questions have been resolved and added to the CRM Brain!
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {unanswered.map((q) => (
            <GlassCard key={q.id} className="p-4 flex flex-wrap items-center justify-between gap-3 border border-border/60">
              <div className="space-y-1">
                <strong className="text-sm font-bold text-foreground block">"{q.question}"</strong>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Customer: <strong>{q.customerName}</strong></span>
                  <span>Channel: <strong className="uppercase">{q.channel}</strong></span>
                  <span>Confidence: <strong className="text-rose-500">{q.confidence}%</strong></span>
                </div>
              </div>

              <button
                onClick={() => onAnswerClick(q)}
                className="bg-[#008069] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#00a884] transition"
              >
                + Add Answer
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-2 pt-4">
          <SectionTitle title={`Resolved Questions (${resolved.length})`} />
          {resolved.map((q) => (
            <GlassCard key={q.id} className="p-3 text-xs space-y-1 border border-border/40 opacity-80">
              <div className="flex justify-between font-bold text-foreground">
                <span>"{q.question}"</span>
                <span className="text-emerald-500">✔ RESOLVED & PUBLISHED</span>
              </div>
              <p className="text-muted-foreground bg-card/50 p-2 rounded-lg">Approved Answer: {q.approvedAnswer}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENT: AI SANDBOX VIEW ──────────────────────────────────
function AiSandboxView({
  messages,
  input,
  setInput,
  thinking,
  ask,
}: {
  messages: any[];
  input: string;
  setInput: (s: string) => void;
  thinking: boolean;
  ask: (q: string) => void;
}) {
  return (
    <GlassCard className="flex flex-col min-h-[30rem] p-0 overflow-hidden max-w-4xl mx-auto">
      <div className="p-3.5 border-b border-border/60 bg-card/30 flex items-center justify-between">
        <SectionTitle title="AI Brain Grounded Retrieval Test Sandbox" />
        <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
          Live RAG Retrieval
        </span>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[24rem]">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={cn(
                "max-w-[85%] text-xs sm:text-sm rounded-[18px] p-3 shadow-xs space-y-1.5",
                m.role === "user" ? "bg-[#008069] text-white rounded-br-xs" : "glass border border-border/60 text-foreground"
              )}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex flex-wrap gap-1">
                  <span className="font-bold">Sources:</span>
                  {m.sources.map((s: string) => (
                    <span key={s} className="bg-card px-1.5 py-0.5 rounded border border-border">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="glass px-3 py-2 text-xs text-[#008069] flex items-center gap-2 rounded-xl">
              <Sparkles className="h-3.5 w-3.5 animate-spin" /> Retrieving grounded knowledge from CRM AI Brain...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="p-3 border-t border-border/60 flex items-center gap-2 bg-card/20"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Test question (e.g. 'How much is Website Development?')"
          className="flex-1 bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
        />
        <button type="submit" className="bg-[#008069] text-white px-4 py-2 rounded-xl text-xs font-semibold">
          Ask Brain
        </button>
      </form>
    </GlassCard>
  );
}

// ── MODAL: ADD KNOWLEDGE ─────────────────────────────────────────────
function AddKnowledgeModal({
  type,
  setType,
  onClose,
  onSubmit,
}: {
  type: KnowledgeType;
  setType: (t: KnowledgeType) => void;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [status, setStatus] = useState<KnowledgeStatus>("PUBLISHED");

  // Type specific fields
  const [price, setPrice] = useState("");
  const [delivery, setDelivery] = useState("");
  const [support, setSupport] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let content: any = {};

    if (type === "service") {
      content = {
        serviceName: title,
        description,
        price: price || "₹50,000",
        pricingType: "Fixed Fee",
        deliveryTime: delivery || "15-30 days",
        supportPeriod: support || "3 months",
        features: features.split(",").map((f) => f.trim()).filter(Boolean),
      };
    } else if (type === "product") {
      content = {
        productName: title,
        description,
        price: price || "₹4,999/mo",
        specifications: features,
      };
    } else if (type === "pricing") {
      content = {
        productOrService: title,
        price,
        pricingConditions: description,
      };
    } else if (type === "faq") {
      content = {
        question: question || title,
        answer,
        category,
      };
    } else {
      content = { description, text: description };
    }

    await onSubmit({
      type,
      category,
      title: title || question || "New Knowledge Item",
      content,
      status,
      effectiveDate: new Date().toISOString(),
      sourceType: "Company Admin",
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xs p-4">
      <GlassCard className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <SectionTitle title="Add Knowledge to CRM AI Brain" />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-foreground block mb-1">Knowledge Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground font-semibold"
            >
              <option value="service">Service</option>
              <option value="product">Product</option>
              <option value="pricing">Pricing</option>
              <option value="offer">Offer</option>
              <option value="policy">Policy</option>
              <option value="faq">FAQ</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Title / Name</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website Development"
              className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Engineering, Pricing, Support"
              className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
            />
          </div>

          {type === "faq" ? (
            <>
              <div>
                <label className="font-semibold text-foreground block mb-1">Question</label>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. How much is your Pro package?"
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold text-foreground block mb-1">Answer</label>
                <textarea
                  rows={3}
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="e.g. Our Pro website package starts at ₹50,000."
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Price</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. ₹50,000"
                    className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Delivery Time</label>
                  <input
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    placeholder="e.g. 15-30 days"
                    className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details..."
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Features (comma separated)</label>
                <input
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  placeholder="Responsive design, SEO setup, Contact forms"
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
                />
              </div>
            </>
          )}

          <div>
            <label className="font-semibold text-foreground block mb-1">Initial Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground"
            >
              <option value="PUBLISHED">PUBLISHED (Available immediately to AI)</option>
              <option value="DRAFT">DRAFT (Hidden from AI until published)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-foreground">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#008069] text-white font-bold">
              Save Knowledge
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

// ── MODAL: ANSWER UNKNOWN QUESTION ───────────────────────────────────
function AnswerUnknownModal({
  question,
  answerInput,
  setAnswerInput,
  onClose,
  onSubmit,
}: {
  question: any;
  answerInput: string;
  setAnswerInput: (s: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xs p-4">
      <GlassCard className="w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <SectionTitle title="Approve & Publish Answer" />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="glass p-3 rounded-xl border border-border/60 space-y-1">
            <span className="text-[10px] text-amber-500 font-bold uppercase">Customer Question</span>
            <p className="font-bold text-foreground text-sm">"{question.question}"</p>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Approved Company Answer</label>
            <textarea
              rows={4}
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="e.g. Installation in Chennai costs ₹5,000 and is completed within 48 hours."
              className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-foreground focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-xl bg-muted text-foreground">
            Cancel
          </button>
          <button onClick={onSubmit} className="px-4 py-2 text-xs rounded-xl bg-[#008069] text-white font-bold">
            Publish to CRM AI Brain
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

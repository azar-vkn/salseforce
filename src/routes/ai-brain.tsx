import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, Send, Sparkles, RotateCcw, Sliders, ShieldCheck, Zap, Database } from "lucide-react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { getAiReply } from "@/lib/ai";
import { useLeads, useAiRules, useUpdateAiRules } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHAT_STORAGE_KEY = "salesmind-ai-brain-messages";

const aiSuggestions: string[] = [
  "Summarize my open deals and pipeline value",
  "Which leads are hot and ready to close today?",
  "Draft a high-converting follow-up for Asirvatha Arul Selvin",
  "Provide a battlecard to handle annual pricing objections",
  "Analyze buyer intent trends across qualified deals",
];

export const Route = createFileRoute("/ai-brain")({
  head: () => ({
    meta: [
      { title: "AI Brain & Intelligence Engine — SalesMind AI" },
      { name: "description", content: "Interactive AI executive assistant with live CRM context and customizable rules." },
      { property: "og:title", content: "AI Brain — SalesMind AI" },
      {
        property: "og:description",
        content: "Interactive AI executive assistant with live CRM context and customizable rules.",
      },
    ],
  }),
  component: AiBrain,
});

type Msg = { id: string; role: "user" | "ai"; text: string; timestamp?: string };

const introMessage: Msg = {
  id: "intro",
  role: "ai",
  text: "Hello! I'm your SalesMind AI Brain. I have continuous real-time access to your leads, task kanban, buyer DNA psychographics, and conversation history.\n\nAsk me anything to analyze deals, draft outreach, or evaluate pipeline velocity.",
  timestamp: "Just now",
};

function loadMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return [introMessage];
}

function saveMessages(msgs: Msg[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // Ignore storage errors
  }
}

function AiBrain() {
  const { data: leads = [] } = useLeads();
  const { data: aiRules } = useAiRules();
  const updateAiRulesMutation = useUpdateAiRules();

  const [messages, setMessages] = useState<Msg[]>(loadMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [customKnowledge, setCustomKnowledge] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiRules?.knowledgeBase) {
      setCustomKnowledge(aiRules.knowledgeBase);
    }
  }, [aiRules]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const startNewChat = useCallback(() => {
    const freshMessages = [introMessage];
    setMessages(freshMessages);
    setInput("");
    setThinking(false);
    inputRef.current?.focus();
    toast.info("Started new AI conversation session");
  }, []);

  async function ask(text: string) {
    if (!text.trim() || thinking) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text, timestamp: "Just now" };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const reply = await getAiReply(text);
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "ai", text: reply, timestamp: "Just now" }]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "ai", text: "I encountered an issue processing that query. Please check your network or try again.", timestamp: "Just now" },
      ]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  const hotLeads = leads.filter((l) => l.score >= 75);
  const totalVal = leads.reduce((acc, l) => acc + (parseFloat(l.value.replace(/[^0-9.]/g, "")) || 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="from-primary to-accent grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br shadow-md shadow-primary/20">
            <Bot className="text-primary-foreground h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">AI Sales Brain</h1>
            <p className="text-muted-foreground text-xs">Autonomous intelligence engine grounded in your real-time CRM pipeline</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Island
            variant="glass"
            className="px-3 py-2 text-xs hover:scale-105 transition"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={startNewChat}
          >
            New Session
          </Island>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Chat Stream */}
        <GlassCard className="flex min-h-[34rem] flex-col p-0 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[28rem]">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={cn(
                    "rise max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-line rounded-[22px] px-4 py-3 shadow-xs",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "glass rounded-bl-xs border border-border/60 text-foreground"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start rise">
                <div className="glass rounded-[22px] rounded-bl-xs px-4 py-2.5 text-xs text-primary flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  Synthesizing live CRM context & knowledge…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Chat Form */}
          <div className="border-border/60 space-y-3 border-t p-4 bg-card/20">
            <div className="flex flex-wrap gap-1.5">
              {aiSuggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="glass rounded-full px-3 py-1 text-[11px] font-medium transition hover:scale-105 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI about deals, draft responses, analyze buyer intent…"
                className="bg-background/80 focus:ring-primary/40 h-11 min-w-0 flex-1 rounded-[18px] px-4 text-xs sm:text-sm outline-none focus:ring-2 border border-border/60"
              />
              <Island type="submit" aria-label="Send" className="px-4 py-3">
                <Send className="h-4 w-4" />
              </Island>
            </form>
          </div>
        </GlassCard>

        {/* Sidebar: Pipeline Pulse & AI Rule Controls */}
        <div className="space-y-4">
          {/* Live Pipeline Pulse */}
          <GlassCard className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <SectionTitle title="Pipeline Pulse" />
              <Zap className="h-4 w-4 text-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="glass rounded-xl p-2.5">
                <span className="text-[10px] text-muted-foreground block">Active Pipeline</span>
                <strong className="text-sm font-bold text-foreground">₹{totalVal.toFixed(1)}L</strong>
              </div>
              <div className="glass rounded-xl p-2.5">
                <span className="text-[10px] text-muted-foreground block">Hot Deals</span>
                <strong className="text-sm font-bold text-primary">{hotLeads.length} Leads</strong>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span>Top Lead</span>
                <strong className="text-foreground">{hotLeads[0]?.name || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span>Avg Lead Score</span>
                <strong className="text-foreground">
                  {leads.length ? Math.round(leads.reduce((a, b) => a + b.score, 0) / leads.length) : 0}/100
                </strong>
              </div>
            </div>
          </GlassCard>

          {/* AI Autonomous Controls */}
          <GlassCard className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <SectionTitle title="Agent Safeguards" />
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between glass rounded-xl p-2.5">
                <span>Autonomous Auto-Reply</span>
                <button
                  onClick={() => {
                    const current = aiRules?.autoReplyEnabled ?? true;
                    updateAiRulesMutation.mutate({ autoReplyEnabled: !current });
                    toast.success(`Autonomous auto-reply set to ${!current ? "Enabled" : "Disabled"}`);
                  }}
                  className={cn(
                    "text-[10px] px-2.5 py-1 rounded-lg font-bold transition",
                    (aiRules?.autoReplyEnabled ?? true) ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                  )}
                >
                  {(aiRules?.autoReplyEnabled ?? true) ? "ACTIVE" : "PAUSED"}
                </button>
              </div>

              <div className="glass rounded-xl p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Confidence Threshold</span>
                  <strong className="text-primary font-bold">{aiRules?.minConfidenceThreshold ?? 85}%</strong>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={aiRules?.minConfidenceThreshold ?? 85}
                  onChange={(e) => updateAiRulesMutation.mutate({ minConfidenceThreshold: parseInt(e.target.value) })}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-muted-foreground block">Queries below this threshold trigger human approval</span>
              </div>
            </div>
          </GlassCard>

          {/* Quick Prompts */}
          <GlassCard className="space-y-2 p-4">
            <SectionTitle title="Strategic Prompts" />
            <div className="flex flex-col gap-1.5">
              {aiSuggestions.slice(3).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-left text-xs transition hover:border-primary/40 text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="text-primary h-3 w-3 shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

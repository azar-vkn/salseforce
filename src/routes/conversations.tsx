import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  PhoneCall,
  CalendarPlus,
  FileText,
  BookOpen,
  Forward,
  ArrowLeft,
  Bot,
  Sparkles,
  MessageSquare,
  Check,
  CheckCheck,
  Globe,
  Mail,
  Smartphone,
  Sliders,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { GlassCard, Island, Ring, SectionTitle } from "@/components/glass";
import { type Message, type ChannelType } from "@/lib/types";
import { useLeads, useConversations, useAddMessage, useUpdateLead, useAiRules } from "@/hooks/use-supabase";
import { useRealtimePresence } from "@/hooks/use-realtime";
import { generateAutonomousReply } from "@/lib/ai-service";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [
      { title: "Realtime Omnichannel Conversations — SalesMind AI" },
      { name: "description", content: "Live omnichannel chat with AI autonomous responses, delivery tracking, and Buyer DNA extraction." },
      { property: "og:title", content: "Realtime Conversations — SalesMind AI" },
      {
        property: "og:description",
        content: "Live omnichannel chat with AI autonomous responses, delivery tracking, and Buyer DNA extraction.",
      },
    ],
  }),
  component: Conversations,
});

const sampleLeadQueries = [
  { text: "What are your enterprise pricing packages and seat discounts?", channel: "whatsapp" as ChannelType },
  { text: "Can we schedule a live product demo tomorrow at 11am?", channel: "email" as ChannelType },
  { text: "Do you support custom SLA, SOC2 Type II, and EU GDPR compliance?", channel: "webchat" as ChannelType },
  { text: "Can I get a 20% discount for an annual upfront contract?", channel: "whatsapp" as ChannelType },
  { text: "How long does onboarding take for a team of 40 sales reps?", channel: "email" as ChannelType },
];

function Conversations() {
  const { data: serverLeads = [], isLoading: loadingLeads } = useLeads();
  const { data: serverThreads = [], isLoading: loadingThreads } = useConversations();
  const { data: aiRules } = useAiRules();
  const addMessageMutation = useAddMessage();
  const updateLeadMutation = useUpdateLead();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [activeChannel, setActiveChannel] = useState<"all" | ChannelType>("all");
  const [autoReply, setAutoReply] = useState(true);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [suggestedDraft, setSuggestedDraft] = useState<{ text: string; confidence: number } | null>(null);

  const { typingUsers, sendTyping } = useRealtimePresence(activeId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverLeads.length > 0 && !activeId) {
      setActiveId(serverLeads[0].id);
    }
  }, [serverLeads, activeId]);

  const lead = serverLeads.find((l) => l.id === activeId) || serverLeads[0];
  const activeThread = serverThreads.find((t) => t.id === activeId);
  const messages: Message[] = activeThread?.messages ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiReplying, suggestedDraft]);

  if (loadingLeads || loadingThreads) {
    return <div className="p-8 text-center text-muted-foreground">Loading realtime conversations...</div>;
  }

  if (!serverLeads.length) {
    return <div className="p-8 text-center text-muted-foreground">No leads found in pipeline.</div>;
  }

  // ── AI Autonomous Query Handler ──────────────────────────────────
  async function handleIncomingQuery(queryText: string, channel: ChannelType = "whatsapp") {
    if (!activeId || !lead) return;

    const incomingMsg: Message = {
      id: crypto.randomUUID(),
      from: "them",
      text: queryText,
      time: "Just now",
      channel,
      status: "read",
    };

    addMessageMutation.mutate({ leadId: activeId, message: incomingMsg });
    toast.info(`📩 [${channel.toUpperCase()}] New query from ${lead.name}: "${queryText}"`);

    // Evaluate AI Auto-reply
    if (autoReply) {
      setIsAiReplying(true);
      try {
        const result = await generateAutonomousReply(queryText, lead, aiRules);
        const threshold = aiRules?.minConfidenceThreshold ?? 85;

        // If confidence meets threshold -> auto reply
        if (result.confidence >= threshold) {
          setTimeout(() => {
            const aiMsg: Message = {
              id: crypto.randomUUID(),
              from: "ai_agent",
              text: result.replyText,
              time: "Just now",
              channel,
              status: "sent",
              aiConfidence: result.confidence,
            };

            addMessageMutation.mutate({ leadId: activeId, message: aiMsg });

            // Apply dynamic Buyer DNA updates & emotion
            if (result.updatedDna || result.suggestedAction || result.detectedEmotion) {
              updateLeadMutation.mutate({
                id: activeId,
                data: {
                  ...(result.updatedDna ? { dna: { ...lead.dna, ...result.updatedDna } } : {}),
                  ...(result.suggestedAction ? { nextAction: result.suggestedAction } : {}),
                  ...(result.detectedEmotion ? { emotion: result.detectedEmotion } : {}),
                  status: "Replied",
                },
              });
            }

            toast.success(`🤖 Auto-replied (${result.confidence}% confidence) & updated Buyer DNA`);
            setIsAiReplying(false);
          }, 1200);
        } else {
          // If confidence is lower -> show draft for rep review
          setIsAiReplying(false);
          setSuggestedDraft({ text: result.replyText, confidence: result.confidence });
          toast.warning(`⚠️ AI Confidence (${result.confidence}%) < ${threshold}% threshold — Rep review required`);
        }
      } catch {
        setIsAiReplying(false);
        toast.error("Failed to generate AI response");
      }
    }
  }

  // ── Send Rep Message ─────────────────────────────────────────────
  function send(text: string) {
    if (!text.trim() || !activeId) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      from: "me",
      text,
      time: "Just now",
      channel: "whatsapp",
      status: "delivered",
    };

    addMessageMutation.mutate({ leadId: activeId, message: newMessage });
    
    // Update lead status
    updateLeadMutation.mutate({ id: activeId, data: { status: "Replied" } });

    // Dispatch out over Meta WhatsApp Cloud API if phone & token present
    const targetPhone = lead?.phone || lead?.whatsapp;
    if (targetPhone) {
      sendWhatsAppTextMessage({ to: targetPhone, body: text }).then((res) => {
        if (res.success) {
          if (res.messageId && !res.messageId.startsWith("sim_")) {
            toast.success(`📱 WhatsApp sent to ${targetPhone} via Meta API!`);
          }
        } else if (res.error) {
          toast.error(`WhatsApp Error: ${res.error}`);
        }
      });
    } else {
      toast.warning("⚠️ No phone number saved for this lead. Go to Leads tab and edit this lead to add their phone number.");
    }


    setDraft("");
    setSuggestedDraft(null);
    sendTyping(false);
  }


  // Channel helper icon
  const getChannelIcon = (ch?: ChannelType) => {
    switch (ch) {
      case "email":
        return <Mail className="h-3 w-3 text-blue-400" />;
      case "webchat":
        return <Globe className="h-3 w-3 text-purple-400" />;
      case "sms":
        return <Smartphone className="h-3 w-3 text-amber-400" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-emerald-500" />;
    }
  };

  const filteredLeads = serverLeads;

  return (
    <div className="space-y-4">
      {/* Top Bar with Omnichannel Stats & AI Autopilot Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Realtime Omnichannel Hub</h1>
          <p className="text-muted-foreground text-xs">
            Sub-second synchronization across WhatsApp, Email, & Webchat with Gemini 2.0 autonomous agent
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAutoReply((v) => !v)}
            className={cn(
              "glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition hover:scale-105",
              autoReply ? "border-primary/50 text-primary bg-primary/10" : "text-muted-foreground"
            )}
          >
            <Bot className="h-4 w-4" />
            <span>{autoReply ? "Autonomous AI: ON (≥85% Conf.)" : "Autonomous AI: OFF"}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_19rem]">
        {/* Column 1: Inbox Sidebar */}
        <GlassCard className={cn("p-3", mobilePane === "chat" && "hidden lg:block")}>
          <div className="flex items-center justify-between px-1">
            <SectionTitle title="Active Channels" hint={`${serverLeads.length}`} />
          </div>

          {/* Channel Filters */}
          <div className="mt-2 flex gap-1 rounded-xl bg-background/50 p-1 text-[11px]">
            {(["all", "whatsapp", "email", "webchat"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={cn(
                  "flex-1 rounded-lg py-1 text-center font-medium capitalize transition",
                  activeChannel === ch ? "bg-primary/20 text-primary font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Lead Thread Items */}
          <div className="mt-3 space-y-1.5 max-h-[38rem] overflow-y-auto pr-1">
            {filteredLeads.map((l) => {
              const thread = serverThreads.find((t) => t.id === l.id);
              const latestMsg = thread?.messages?.at(-1);

              return (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveId(l.id);
                    setMobilePane("chat");
                    setSuggestedDraft(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition border border-transparent",
                    activeId === l.id
                      ? "bg-primary-soft border-primary/30 shadow-xs"
                      : "hover:bg-muted/60"
                  )}
                >
                  <div className="relative">
                    <span className="bg-primary/15 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold">
                      {l.initials}
                    </span>
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border text-[9px]">
                      {getChannelIcon(thread?.channel || "whatsapp")}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="block truncate text-xs font-bold">{l.name}</span>
                      <span className="text-[10px] text-muted-foreground">{l.value}</span>
                    </div>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {latestMsg ? latestMsg.text : "No messages yet"}
                    </span>
                  </div>

                  {l.status === "Unread" ? (
                    <span className="bg-primary h-2 w-2 shrink-0 rounded-full" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Column 2: Live Chat & Realtime Messaging */}
        <GlassCard className={cn("flex min-h-[34rem] flex-col p-0 overflow-hidden", mobilePane === "list" && "hidden lg:flex")}>
          {/* Header */}
          <div className="border-border/60 flex items-center justify-between border-b px-4 py-3 bg-card/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobilePane("list")}
                aria-label="Back to inbox"
                className="hover:bg-muted rounded-full p-2 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="bg-primary/15 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold">
                {lead.initials}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="block truncate text-sm font-semibold">{lead.name}</span>
                  <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <span className="text-muted-foreground block truncate text-xs">
                  {lead.company} · Stage: <strong className="text-foreground">{lead.stage}</strong> · Score: {lead.score}/100
                </span>
              </div>
            </div>

            {/* Inbound Simulator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const queryItem = sampleLeadQueries[Math.floor(Math.random() * sampleLeadQueries.length)];
                  handleIncomingQuery(queryItem.text, queryItem.channel);
                }}
                className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition hover:scale-105"
                title="Simulate incoming customer query across WhatsApp / Email"
              >
                <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
                Simulate Inbound Query
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4 max-h-[26rem]">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-6">
                <MessageSquare className="h-8 w-8 text-primary/40 mb-2" />
                <p className="text-xs">No conversation history yet with {lead.name}.</p>
                <p className="text-[11px] opacity-70">Click "Simulate Inbound Query" above or type a message below.</p>
              </div>
            ) : null}

            {messages.map((m) => {
              const isRep = m.from === "me";
              const isAi = m.from === "ai_agent";

              return (
                <div
                  key={m.id}
                  className={cn("rise flex", isRep || isAi ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[82%] rounded-[22px] px-4 py-2.5 text-sm leading-relaxed shadow-xs relative",
                      isRep
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : isAi
                        ? "bg-primary/20 border border-primary/40 text-foreground rounded-br-xs"
                        : "glass rounded-bl-xs"
                    )}
                  >
                    {isAi && (
                      <div className="flex items-center gap-1 text-[10px] text-primary font-bold mb-1">
                        <Sparkles className="h-3 w-3" />
                        Autonomous AI Reply {m.aiConfidence ? `(${m.aiConfidence}% Conf.)` : ""}
                      </div>
                    )}
                    
                    <p className="text-xs leading-relaxed sm:text-sm">{m.text}</p>
                    
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      <span>{m.time}</span>
                      {isRep || isAi ? (
                        m.status === "read" ? (
                          <CheckCheck className="h-3 w-3 text-cyan-400" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck className="h-3 w-3 opacity-60" />
                        ) : (
                          <Check className="h-3 w-3 opacity-60" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing status */}
            {isAiReplying ? (
              <div className="flex justify-start rise">
                <div className="glass rounded-[22px] rounded-bl-xs px-4 py-2 text-xs text-primary flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  SalesMind AI is crafting response…
                </div>
              </div>
            ) : null}

            {typingUsers.length > 0 && (
              <div className="text-[11px] text-muted-foreground italic px-2">
                {typingUsers.join(", ")} is typing…
              </div>
            )}

            {/* AI Draft Suggestion Box (when confidence < threshold) */}
            {suggestedDraft && (
              <div className="glass border border-amber-500/30 rounded-2xl p-3 space-y-2 bg-amber-500/5 rise">
                <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-4 w-4" /> AI Suggested Draft ({suggestedDraft.confidence}% Confidence)
                  </span>
                  <span className="text-[10px] opacity-75">Requires Rep Approval</span>
                </div>
                <p className="text-xs text-foreground bg-background/60 p-2.5 rounded-xl">{suggestedDraft.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => send(suggestedDraft.text)}
                    className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-primary/90 transition"
                  >
                    Approve & Send
                  </button>
                  <button
                    onClick={() => {
                      setDraft(suggestedDraft.text);
                      setSuggestedDraft(null);
                    }}
                    className="glass text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-muted transition"
                  >
                    Edit Draft
                  </button>
                  <button
                    onClick={() => setSuggestedDraft(null)}
                    className="text-xs text-muted-foreground px-2 py-1 hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Action Toolbar & Chat Input */}
          <div className="border-border/60 space-y-3 border-t px-4 py-3 bg-card/20">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Call Lead", icon: PhoneCall, action: () => toast.success(`Calling ${lead.phone || lead.name}...`) },
                { label: "Book Demo", icon: CalendarPlus, action: () => send(`Hi ${lead.name.split(" ")[0]}, let's lock in a demo. Here's my calendar link: https://cal.com/salesmind/${lead.name.toLowerCase().replace(/\s+/g, "-")}`) },
                { label: "Send Quote", icon: FileText, action: () => send(`Hi ${lead.name.split(" ")[0]}, attached is your customized proposal of ${lead.value}.`) },
                { label: "Send SOC2 Paper", icon: ShieldCheck, action: () => send(`Attached is our latest SOC2 Type II compliance audit and security whitepaper.`) },
              ].map((q) => (
                <Island
                  key={q.label}
                  variant="glass"
                  className="px-2.5 py-1.5 text-xs hover:scale-105 transition"
                  icon={<q.icon className="h-3 w-3" />}
                  onClick={q.action}
                >
                  {q.label}
                </Island>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  sendTyping(e.target.value.length > 0);
                }}
                placeholder={`Reply to ${lead.name} on WhatsApp...`}
                className="bg-background/80 focus:ring-primary/40 h-11 min-w-0 flex-1 rounded-[18px] px-4 text-xs sm:text-sm outline-none focus:ring-2 border border-border/60"
              />
              <Island type="submit" aria-label="Send message" className="px-4 py-3">
                <Send className="h-4 w-4" />
              </Island>
            </form>
          </div>
        </GlassCard>

        {/* Column 3: Live Buyer DNA Intelligence & Dynamic Playbook */}
        <GlassCard className={cn("space-y-4 overflow-y-auto max-h-[38rem]", mobilePane === "list" && "hidden lg:block")}>
          <div>
            <div className="flex items-center justify-between">
              <SectionTitle title="Live Buyer DNA" />
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Score: {lead.score}/100
              </span>
            </div>
            
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Ring size={56} label="Intent" value={lead.dna.intent} />
              <Ring size={56} label="Trust" value={lead.dna.trust} />
              <Ring size={56} label="Urgency" value={lead.dna.urgency} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="glass rounded-xl p-2">
                <span className="text-muted-foreground block text-[9px]">Budget Level</span>
                <strong className="text-foreground">{lead.dna.budget}%</strong>
              </div>
              <div className="glass rounded-xl p-2">
                <span className="text-muted-foreground block text-[9px]">Price Sensitivity</span>
                <strong className="text-foreground">{lead.dna.priceSensitivity}%</strong>
              </div>
            </div>
          </div>

          {/* Psychology Profile */}
          <div className="space-y-1.5 text-xs">
            <div className="glass rounded-[14px] px-3 py-2">
              <span className="text-[10px] text-muted-foreground block">Communication Language</span>
              <span className="font-medium text-foreground">{lead.dna.language}</span>
            </div>
            <div className="glass rounded-[14px] px-3 py-2">
              <span className="text-[10px] text-muted-foreground block">Decision Maker Style</span>
              <span className="font-medium text-foreground">{lead.dna.style}</span>
            </div>
          </div>

          {/* AI Recommended Replies */}
          <div>
            <SectionTitle title="Instant Battlecards" />
            <div className="mt-2 space-y-1.5">
              {[
                `Hi ${lead.name.split(" ")[0]}, we can lock in the ₹${lead.value} tier if finalized this week.`,
                "Would a 10-minute walkthrough with our Solutions Architect help?",
                "We provide full data migration and dedicated onboarding support.",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="glass w-full rounded-[14px] px-3 py-2 text-left text-xs transition hover:scale-[1.02] hover:border-primary/40 text-muted-foreground hover:text-foreground"
                >
                  "{s}"
                </button>
              ))}
            </div>
          </div>

          {/* Next Best Action */}
          <div className="bg-primary/10 border border-primary/20 rounded-[18px] p-3 text-xs">
            <span className="text-primary font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Next Best Sales Action
            </span>
            <p className="mt-1 font-medium text-foreground">{lead.nextAction}</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

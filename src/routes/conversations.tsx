import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  PhoneCall,
  CalendarPlus,
  FileText,
  ArrowLeft,
  Bot,
  Sparkles,
  MessageSquare,
  Check,
  CheckCheck,
  Globe,
  Mail,
  Smartphone,
  ShieldCheck,
  Zap,
  Activity,
  User,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Settings as SettingsIcon,
  AlertTriangle,
} from "lucide-react";
import { GlassCard, Island, Ring, SectionTitle } from "@/components/glass";
import { type Message, type ChannelType, type Lead } from "@/lib/types";
import { useLeads, useConversations, useAddMessage, useUpdateConversation, useUpdateLead, useAiRules, useCreateLead, useCreateTask, useAutoReply, useSetAutoReply } from "@/hooks/use-supabase";
import { useRealtimePresence } from "@/hooks/use-realtime";
import { generateAutonomousReply } from "@/lib/ai-service";
import { sendWhatsAppTextMessage, sendWhatsAppTemplateMessage, getWhatsAppCredentials } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [
      { title: "Chats — SalesMind AI" },
      { name: "description", content: "WhatsApp realtime chat with AI autopilot responses and Buyer DNA." },
      { property: "og:title", content: "WhatsApp Chats — SalesMind AI" },
      {
        property: "og:description",
        content: "WhatsApp realtime chat with AI autopilot responses and Buyer DNA.",
      },
    ],
  }),
  component: Conversations,
});

const sampleLeadQueries = [
  { text: "What are your enterprise pricing packages and seat discounts?", channel: "whatsapp" as ChannelType },
  { text: "Can we schedule a live product demo tomorrow at 11am?", channel: "whatsapp" as ChannelType },
  { text: "Do you support custom SLA, SOC2 Type II, and EU GDPR compliance?", channel: "whatsapp" as ChannelType },
  { text: "Can I get a 20% discount for an annual upfront contract?", channel: "whatsapp" as ChannelType },
  { text: "How long does onboarding take for a team of 40 sales reps?", channel: "whatsapp" as ChannelType },
];

function Conversations() {
  const { data: serverLeads = [], isLoading: loadingLeads } = useLeads();
  const { data: serverThreads = [], isLoading: loadingThreads } = useConversations();
  const { data: aiRules } = useAiRules();
  const addMessageMutation = useAddMessage();
  const updateLeadMutation = useUpdateLead();
  const createLeadMutation = useCreateLead();
  const createTaskMutation = useCreateTask();
  const { data: autoReply = true } = useAutoReply();
  const setAutoReplyMutation = useSetAutoReply();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [suggestedDraft, setSuggestedDraft] = useState<{ text: string; confidence: number } | null>(null);

  const [editingPhone, setEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState("");

  const { typingUsers, sendTyping } = useRealtimePresence(activeId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const validLeads = serverLeads;

  useEffect(() => {
    if (validLeads.length > 0 && !activeId) {
      setActiveId(validLeads[0].id);
    }
  }, [validLeads, activeId]);

  const lead = validLeads.find((l) => l.id === activeId) || validLeads[0];
  const activeThread = serverThreads.find((t) => t.id === activeId);
  const messages: Message[] = activeThread?.messages ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiReplying, suggestedDraft]);

  if (loadingLeads || loadingThreads) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-lg bg-card border border-border px-4 py-3 shadow-xs">
          <div className="h-4 w-4 rounded-full border-2 border-[#008069] border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-foreground">Connecting to WhatsApp...</span>
        </div>
      </div>
    );
  }

  if (!validLeads.length) {
    return <div className="p-8 text-center text-muted-foreground text-sm">No chats found in pipeline.</div>;
  }

  // ── AI Autonomous Query Handler ──────────────────────────────────
  async function processAutoReply(queryText: string, targetLead: Lead, currentMessages: Message[], channel: ChannelType) {
    if (!autoReply) return;
    setIsAiReplying(true);
    try {
      const result = await generateAutonomousReply(queryText, targetLead, aiRules);
      const threshold = aiRules?.minConfidenceThreshold ?? 85;

      if (result.confidence >= threshold) {
        setTimeout(() => {
          const aiMsg: Message = {
            id: crypto.randomUUID(),
            from: "ai_agent",
            text: result.replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            channel,
            status: "sent",
            aiConfidence: result.confidence,
          };

          addMessageMutation.mutate({ leadId: targetLead.id, message: aiMsg });

          // Dispatch outbound message over Meta WhatsApp Cloud API if phone is configured
          const targetPhone =
            targetLead.phone ||
            targetLead.whatsapp ||
            targetLead.dna?.phone ||
            targetLead.dna?.whatsapp ||
            "";

          if (targetPhone) {
            sendWhatsAppTextMessage({ to: targetPhone, body: result.replyText }).then((res) => {
              if (res.success) {
                if (res.isSimulated) {
                  toast.info("💬 Outbound reply simulated (Configure Meta API in Settings for live delivery)");
                } else {
                  toast.success(`📱 Outbound WhatsApp delivered to +${targetPhone.replace(/\D/g, "")}`);
                }
              } else if (res.error) {
                toast.error(res.error, {
                  duration: 8000,
                  action: {
                    label: "Open Settings",
                    onClick: () => {
                      window.location.href = "/settings";
                    },
                  },
                });
              }
            });
          }

          if (result.updatedDna || result.suggestedAction || result.detectedEmotion) {
            updateLeadMutation.mutate({
              id: targetLead.id,
              data: {
                ...(result.updatedDna ? { dna: { ...targetLead.dna, ...result.updatedDna } } : {}),
                ...(result.suggestedAction ? { nextAction: result.suggestedAction } : {}),
                ...(result.detectedEmotion ? { emotion: result.detectedEmotion } : {}),
                status: "Replied",
              },
            });
          }

          if (result.task) {
            createTaskMutation.mutate({
              title: result.task.title,
              lead: targetLead.name,
              tag: "AI Task",
              column: "today",
              priority: result.task.priority,
            });
          }

          toast.success(`🤖 Auto-replied (${result.confidence}% conf.)`);
          setIsAiReplying(false);
        }, 1000);

      } else {
        setIsAiReplying(false);
        setSuggestedDraft({ text: result.replyText, confidence: result.confidence });
        toast.warning(`⚠️ AI Confidence (${result.confidence}%) < ${threshold}% threshold — Approval required`);
      }
    } catch {
      setIsAiReplying(false);
      toast.error("Failed to generate AI response");
    }
  }

  async function handleIncomingQuery(queryText: string, channel: ChannelType = "whatsapp") {
    if (!activeId || !lead) return;

    const incomingMsg: Message = {
      id: crypto.randomUUID(),
      from: "them",
      text: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channel,
      status: "read",
    };

    const updated = [...messages, incomingMsg];
    addMessageMutation.mutate({ leadId: activeId, message: incomingMsg });
    toast.info(`📩 [${channel.toUpperCase()}] New query from ${lead.name}: "${queryText}"`);

    await processAutoReply(queryText, lead, updated, channel);
  }

  async function handleUnknownInbound() {
    const randomPhone = `9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const queryText = "Hi, I'm looking for an enterprise CRM solution. Do you have a demo?";
    
    createLeadMutation.mutate(
      {
        name: `New Inquiry (+${randomPhone})`,
        company: "Unknown",
        initials: "NEW",
        score: 75,
        stage: "New",
        nextAction: "Review inbound message",
        emotion: "Curious",
        status: "Unread",
        value: "₹0",
        phone: randomPhone,
        whatsapp: randomPhone,
        dna: {
          budget: 60,
          intent: 80,
          trust: 50,
          priceSensitivity: 50,
          urgency: 70,
          language: "English",
          style: "Direct Inbound",
          confidence: 70,
        },
      },
      {
        onSuccess: (newLead) => {
          setActiveId(newLead.id);
          setMobilePane("chat");
          
          const incomingMsg: Message = {
            id: crypto.randomUUID(),
            from: "them",
            text: queryText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            channel: "whatsapp",
            status: "read",
          };
          
          const updatedMessages = [incomingMsg];
          addMessageMutation.mutate({ leadId: newLead.id, message: incomingMsg });
          toast.info(`📩 Auto-created new lead from WhatsApp: +${randomPhone}`);
          
          processAutoReply(queryText, newLead, updatedMessages, "whatsapp");
        },
      }
    );
  }

  // ── Send Rep Message ─────────────────────────────────────────────
  function send(text: string) {
    if (!text.trim() || !activeId) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      from: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channel: "whatsapp",
      status: "delivered",
    };

    addMessageMutation.mutate({ leadId: activeId, message: newMessage });
    
    // Update lead status
    updateLeadMutation.mutate({ id: activeId, data: { status: "Replied" } });

    // Dispatch out over Meta WhatsApp Cloud API if phone present
    const targetPhone =
      lead?.phone || lead?.whatsapp || lead?.dna?.phone || lead?.dna?.whatsapp || "";
    if (targetPhone) {
      sendWhatsAppTextMessage({ to: targetPhone, body: text }).then((res) => {
        if (res.success) {
          if (res.isSimulated) {
            toast.info("💬 Saved to CRM (Simulation mode: configure Meta API in Settings for live WhatsApp delivery)");
          } else if (res.messageId) {
            toast.success(`📱 Sent to Meta API (+${targetPhone.replace(/\D/g, "")})`);
          }
        } else if (res.error) {
          addMessageMutation.mutate({ leadId: activeId, message: { ...newMessage, status: "failed" } });
          
          toast.error(res.error, {
            duration: 10000,
            action: {
              label: "Open Settings",
              onClick: () => {
                window.location.href = "/settings";
              },
            },
          });
        }
      });
    } else {
      const candidatePhone = lead?.value && /^\d{7,}$/.test(lead.value.trim()) ? lead.value.trim() : "";
      setTempPhone(candidatePhone);
      setEditingPhone(true);
      toast.warning(`⚠️ Please save a WhatsApp phone number for ${lead?.name}`);
    }

    setDraft("");
    setSuggestedDraft(null);
    sendTyping(false);
  }

  async function handleSendTemplate() {
    const targetPhone = lead?.phone || lead?.whatsapp;
    if (!targetPhone) {
      toast.warning("Please save a phone number for this lead first.");
      return;
    }
    const tId = toast.loading("Sending WhatsApp template...");
    const res = await sendWhatsAppTemplateMessage({
      to: targetPhone,
      templateName: "jaspers_market_order_confirmation_v1",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: lead.name || "Customer" },
            { type: "text", text: "123456" },
            { type: "text", text: new Date().toLocaleDateString() },
          ],
        },
      ],
    });
    toast.dismiss(tId);
    if (res.success) {
      const tplMsg: Message = {
        id: crypto.randomUUID(),
        from: "me",
        text: `📋 [WhatsApp Template Delivered]: jaspers_market_order_confirmation_v1`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        channel: "whatsapp",
        status: "delivered",
      };
      addMessageMutation.mutate({ leadId: activeId!, message: tplMsg });
      if (res.isSimulated) {
        toast.info("📋 Template simulated (Configure Meta API in Settings for live delivery)");
      } else {
        toast.success(`📱 WhatsApp Template delivered!`);
      }
    } else {
      toast.error(res.error || "WhatsApp Template Error", {
        duration: 10000,
        action: {
          label: "Open Settings",
          onClick: () => {
            window.location.href = "/settings";
          },
        },
      });
    }
  }

  const filteredLeads = validLeads.filter(
    (l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const creds = getWhatsAppCredentials();
  const hasMetaCredentials = Boolean(creds.phoneId && creds.accessToken);

  return (
    <div className="space-y-3">
      {/* Top Bar with WhatsApp AI Autopilot Toggle & Meta Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card border border-border p-3 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#008069] text-white flex items-center justify-center font-bold text-xs">
            WA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">WhatsApp Omnichannel Hub</h1>
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-muted-foreground">
                Official Meta Cloud API v21.0 · Realtime Sync & AI Autopilot
              </p>
              <span className="text-muted-foreground text-[10px]">·</span>
              <Link
                to="/settings"
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition",
                  hasMetaCredentials
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                <SettingsIcon className="h-2.5 w-2.5" />
                {hasMetaCredentials ? `Phone ID: ${creds.phoneId.slice(0, 8)}...` : "Meta API: Setup Needed"}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAutoReplyMutation.mutate(!autoReply);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer border",
              autoReply
                ? "bg-[#008069]/10 text-[#008069] dark:text-[#00a884] border-[#008069]/30"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>{autoReply ? "AI Autopilot: ON (≥85%)" : "AI Autopilot: OFF"}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column WhatsApp Layout */}
      <div className="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)_18rem] h-[calc(100vh-12rem)] min-h-[38rem]">
        {/* Column 1: WhatsApp Chat List */}
        <div className={cn("bg-card border border-border rounded-lg flex flex-col overflow-hidden shadow-xs", mobilePane === "chat" && "hidden lg:flex")}>
          {/* Search Header */}
          <div className="p-2.5 border-b border-border bg-card">
            <div className="flex items-center gap-2 bg-muted rounded-md px-2.5 py-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or start new chat"
                className="w-full bg-transparent outline-none text-xs placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Chat Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filteredLeads.map((l) => {
              const thread = serverThreads.find((t) => t.id === l.id);
              const latestMsg = thread?.messages?.at(-1);
              const isSelected = activeId === l.id;

              return (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveId(l.id);
                    setMobilePane("chat");
                    setSuggestedDraft(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-muted dark:bg-[#202c33]"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#008069] text-white text-xs font-semibold">
                      {l.initials}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="block truncate text-xs font-semibold text-foreground">{l.name}</span>
                      <span className="text-[10px] text-muted-foreground">{latestMsg?.time || "10:00 AM"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-muted-foreground block truncate text-[11px] max-w-[140px]">
                        {latestMsg ? latestMsg.text : "No messages yet"}
                      </span>
                      {l.status === "Unread" ? (
                        <span className="h-2 w-2 rounded-full bg-[#25D366] shrink-0" />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Live WhatsApp Chat Window */}
        <div className={cn("bg-card border border-border rounded-lg flex flex-col overflow-hidden shadow-xs", mobilePane === "list" && "hidden lg:flex")}>
          {/* WhatsApp Chat Header */}
          <div className="bg-card dark:bg-[#202c33] border-b border-border px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobilePane("list")}
                aria-label="Back to chat list"
                className="hover:bg-muted rounded-full p-1.5 lg:hidden cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#008069] text-white text-xs font-semibold">
                {lead.initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="block truncate text-xs font-bold text-foreground">{lead.name}</span>
                </div>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {lead.company} · <span className="text-[#008069] dark:text-[#00a884] font-medium">Online</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const phone = lead.phone || lead.whatsapp;
                  if (phone) {
                    toast.info(`Calling ${lead.name} (${phone}) via human dialer…`);
                    window.location.href = `tel:${phone}`;
                  } else {
                    toast.warning("No phone number saved for this lead.");
                  }
                }}
                className="flex items-center gap-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                title="Normal human call flow"
              >
                <PhoneCall className="h-3 w-3 text-muted-foreground" />
                <span className="hidden sm:inline">Call</span>
              </button>
              <button
                onClick={() => {
                  toast.info(`Opening Call Autopilot for ${lead.name}…`);
                  window.location.href = "/call-autopilot";
                }}
                className="flex items-center gap-1 bg-[#008069] text-white hover:opacity-90 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition cursor-pointer"
                title="Initiate AI Voice Call with full CRM & Buyer DNA context"
              >
                <PhoneCall className="h-3 w-3" />
                <span className="hidden sm:inline">Call with AI</span>
              </button>
            </div>
          </div>

          {/* Quick Phone Edit Banner */}
          {(editingPhone || !/^\+?\d{7,}$/.test((lead?.phone || lead?.whatsapp || "").trim())) && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  {/^\+?\d{7,}$/.test((lead?.phone || lead?.whatsapp || "").trim())
                    ? "WhatsApp Number:"
                    : `Invalid WhatsApp Number ('${lead?.phone || lead?.whatsapp || "none"}'):`}
                </span>
                <input
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  placeholder="Enter your phone number e.g. 919876543210"
                  className="bg-card px-2.5 py-1 rounded border border-amber-500/40 text-xs w-64 outline-none font-medium"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const clean = tempPhone.replace(/\D/g, "");
                    if (!clean || clean.length < 7) {
                      toast.error("Please enter a valid phone number with country code (e.g. 919876543210)");
                      return;
                    }
                    updateLeadMutation.mutate(
                      { id: lead.id, data: { phone: clean, whatsapp: clean, value: `+${clean}` } },
                      {
                        onSuccess: () => {
                          toast.success(`Saved WhatsApp number +${clean}`);
                          setEditingPhone(false);
                        },
                      }
                    );
                  }}
                  className="bg-[#008069] text-white text-xs px-3 py-1 rounded font-bold cursor-pointer hover:bg-[#00a884] transition"
                >
                  Save Phone Number
                </button>
              </div>
            </div>
          )}


          {/* WhatsApp Messages Feed */}
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 bg-[#efeae2] dark:bg-[#0b141a]">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-6">
                <MessageSquare className="h-8 w-8 text-[#008069]/40 mb-2" />
                <p className="text-xs font-semibold text-foreground">No chat history yet with {lead.name}.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Click "Simulate Inbound" or send a template below.</p>
              </div>
            ) : null}

            {(() => {
              const seen = new Set<string>();
              return messages.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
              }).map((m, idx) => {
              const isRep = m.from === "me";
              const isAi = m.from === "ai_agent";

              return (
                <div
                  key={`${m.id}-${idx}`}
                  className={cn("flex", isRep || isAi ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-lg px-3 py-1.5 text-xs leading-relaxed shadow-xs relative",
                      isRep
                        ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none"
                        : isAi
                        ? "bg-[#dcf8c6] dark:bg-[#004d3e] text-[#111b21] dark:text-[#e9edef] rounded-tr-none border border-[#00a884]/30"
                        : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none"
                    )}
                  >
                    {isAi && (
                      <div className="flex items-center gap-1 text-[10px] text-[#008069] dark:text-[#25D366] font-bold mb-1">
                        <Sparkles className="h-3 w-3" />
                        AI Autopilot Reply {m.aiConfidence ? `(${m.aiConfidence}%)` : ""}
                      </div>
                    )}
                    
                    <p className="text-xs leading-relaxed">{m.text}</p>
                    
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground dark:text-[#8696a0]">
                      <span>{m.time}</span>
                      {isRep || isAi ? (
                        m.status === "read" ? (
                          <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : m.status === "failed" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })})()}

            {/* Typing status */}
            {isAiReplying ? (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#202c33] rounded-lg rounded-tl-none px-3 py-1.5 text-xs text-[#008069] dark:text-[#25D366] flex items-center gap-1.5 shadow-xs">
                  <Sparkles className="h-3 w-3 animate-spin" />
                  AI Autopilot is typing…
                </div>
              </div>
            ) : null}

            {typingUsers.length > 0 && (
              <div className="text-[11px] text-muted-foreground italic px-1">
                {typingUsers.join(", ")} is typing…
              </div>
            )}

            {/* AI Draft Suggestion Box */}
            {suggestedDraft && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-bold">
                  <span>AI Draft Suggestion ({suggestedDraft.confidence}% Confidence)</span>
                  <span className="text-[10px] uppercase">Approval Required</span>
                </div>
                <p className="text-xs text-foreground bg-card p-2 rounded border border-border">{suggestedDraft.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => send(suggestedDraft.text)}
                    className="bg-[#008069] text-white text-xs px-3 py-1 rounded font-medium cursor-pointer"
                  >
                    Approve & Send
                  </button>
                  <button
                    onClick={() => {
                      setDraft(suggestedDraft.text);
                      setSuggestedDraft(null);
                    }}
                    className="bg-card text-xs px-2.5 py-1 rounded border border-border hover:bg-muted cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setSuggestedDraft(null)}
                    className="text-xs text-muted-foreground px-2 py-1 hover:text-foreground cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* WhatsApp Action Toolbar & Chat Input */}
          <div className="bg-card dark:bg-[#202c33] border-t border-border p-2.5 space-y-2">
            {/* Input Bar */}
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
                placeholder="Type a message..."
                className="bg-muted dark:bg-[#2a3942] focus:ring-1 focus:ring-[#00a884] h-9 min-w-0 flex-1 rounded-md px-3 text-xs outline-none border border-border/50 text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="bg-[#008069] dark:bg-[#00a884] hover:opacity-90 text-white rounded-full p-2.5 transition cursor-pointer shadow-xs shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Column 3: WhatsApp CRM & Buyer DNA Panel */}
        <div className={cn("bg-card border border-border rounded-lg p-3.5 flex flex-col justify-between overflow-y-auto shadow-xs", mobilePane === "list" && "hidden lg:flex")}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[#008069] dark:text-[#00a884]" />
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Buyer DNA</h2>
              </div>
              <span className="text-[10px] font-bold text-[#008069] dark:text-[#00a884] bg-[#008069]/10 px-2 py-0.5 rounded">
                Score: {lead.score}/100
              </span>
            </div>
            
            {/* DNA Rings */}
            <div className="grid grid-cols-3 gap-2">
              <Ring size={52} label="Intent" value={lead.dna.intent} />
              <Ring size={52} label="Trust" value={lead.dna.trust} />
              <Ring size={52} label="Urgency" value={lead.dna.urgency} />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/60 p-2 rounded border border-border">
                <span className="text-muted-foreground block text-[10px] font-medium">Budget Tier</span>
                <strong className="text-foreground text-xs">{lead.dna.budget}%</strong>
              </div>
              <div className="bg-muted/60 p-2 rounded border border-border">
                <span className="text-muted-foreground block text-[10px] font-medium">Price Sensitivity</span>
                <strong className="text-foreground text-xs">{lead.dna.priceSensitivity}%</strong>
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-1.5 text-xs">
              <div className="bg-muted/60 px-2.5 py-1.5 rounded border border-border">
                <span className="text-[10px] text-muted-foreground block">Communication Style</span>
                <span className="font-medium text-foreground">{lead.dna.language}</span>
              </div>
              <div className="bg-muted/60 px-2.5 py-1.5 rounded border border-border">
                <span className="text-[10px] text-muted-foreground block">Decision Style</span>
                <span className="font-medium text-foreground">{lead.dna.style}</span>
              </div>
            </div>

            {/* Instant Battlecards */}
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1.5">Instant Battlecards</span>
              <div className="space-y-1">
                {[
                  `Hi ${lead.name.split(" ")[0]}, we can lock in the ₹${lead.value} tier this week.`,
                  "Would a 10-minute walkthrough with our team help?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-[11px] p-1.5 rounded bg-muted/60 hover:bg-muted border border-border text-foreground transition cursor-pointer"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Next Best Action */}
          <div className="bg-[#008069]/10 dark:bg-[#00a884]/15 border border-[#008069]/30 rounded p-2.5 text-xs mt-3">
            <span className="text-[#008069] dark:text-[#00a884] font-bold block text-[11px]">
              Next Best Action
            </span>
            <p className="mt-0.5 text-foreground text-[11px]">{lead.nextAction}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

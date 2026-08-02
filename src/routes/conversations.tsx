import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Send, PhoneCall, CalendarPlus, FileText, BookOpen, Forward, ArrowLeft } from "lucide-react";
import { GlassCard, Island, Ring, SectionTitle } from "@/components/glass";
import { type Message } from "@/lib/types";
import { useLeads, useConversations, useUpdateConversation } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — SalesMind AI" },
      { name: "description", content: "Chat with leads with AI insights and suggested replies." },
      { property: "og:title", content: "Conversations — SalesMind AI" },
      {
        property: "og:description",
        content: "Chat with leads with AI insights and suggested replies.",
      },
    ],
  }),
  component: Conversations,
});

function Conversations() {
  const { data: serverLeads = [], isLoading: loadingLeads } = useLeads();
  const { data: serverThreads = [], isLoading: loadingThreads } = useConversations();
  const updateConversationMutation = useUpdateConversation();

  const [activeId, setActiveId] = useState<string | null>(null);
  
  useEffect(() => {
    if (serverLeads.length > 0 && !activeId) {
      setActiveId(serverLeads[0].id);
    }
  }, [serverLeads, activeId]);

  const [draft, setDraft] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");

  if (loadingLeads || loadingThreads) {
    return <div className="p-8 text-center text-muted-foreground">Loading conversations...</div>;
  }

  if (!serverLeads.length) {
    return <div className="p-8 text-center text-muted-foreground">No leads found.</div>;
  }

  const lead = serverLeads.find((l) => l.id === activeId) || serverLeads[0];
  const activeThread = serverThreads.find(t => t.id === activeId);
  const messages: Message[] = activeThread?.messages ?? [];

  function send(text: string) {
    if (!text.trim() || !activeThread) return;
    const newMessage = { id: crypto.randomUUID(), from: "me", text, time: "Now" } as Message;
    const updatedMessages = [...messages, newMessage];
    
    // Update server
    updateConversationMutation.mutate({ id: activeId!, data: { messages: updatedMessages } });
    
    setDraft("");
  }

  const quick = [
    { label: "Call", icon: PhoneCall },
    { label: "Schedule", icon: CalendarPlus },
    { label: "Quote", icon: FileText },
    { label: "Brochure", icon: BookOpen },
    { label: "Transfer", icon: Forward },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Conversations</h1>

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <GlassCard
          className={cn("p-3", mobilePane === "chat" && "hidden lg:block")}
        >
          <SectionTitle title="Inbox" hint={`${serverLeads.length}`} />
          <div className="mt-2 space-y-1">
            {serverLeads.map((l) => {
              const latestMsg = serverThreads.find(t => t.id === l.id)?.messages?.at(-1)?.text;
              return (
              <button
                key={l.id}
                onClick={() => {
                  setActiveId(l.id);
                  setMobilePane("chat");
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[18px] px-2 py-2.5 text-left transition",
                  activeId === l.id ? "bg-primary-soft" : "hover:bg-muted/60",
                )}
              >
                <span className="bg-primary/15 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold">
                  {l.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {latestMsg ?? "No messages yet"}
                  </span>
                </span>
                {l.status === "Unread" ? (
                  <span className="bg-primary h-2 w-2 shrink-0 rounded-full" />
                ) : null}
              </button>
            );
          })}
          </div>
        </GlassCard>

        <GlassCard
          className={cn("flex min-h-[28rem] flex-col p-0", mobilePane === "list" && "hidden lg:flex")}
        >
          <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
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
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{lead.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {lead.company} · {lead.stage}
              </span>
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("rise flex", m.from === "me" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-[22px] px-4 py-2.5 text-sm leading-relaxed",
                    m.from === "me"
                      ? "bg-primary text-primary-foreground rounded-br-lg"
                      : "glass rounded-bl-lg",
                  )}
                >
                  {m.text}
                  <span className="mt-1 block text-[10px] opacity-70">{m.time}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-border/60 space-y-3 border-t px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <Island
                  key={q.label}
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<q.icon className="h-3.5 w-3.5" />}
                  onClick={() => toast(`${q.label} · ${lead.name}`)}
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
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                className="bg-background/60 focus:ring-ring/60 h-12 min-w-0 flex-1 rounded-[20px] px-4 text-sm outline-none focus:ring-2"
              />
              <Island type="submit" aria-label="Send message" className="px-4 py-3.5">
                <Send className="h-4 w-4" />
              </Island>
            </form>
          </div>
        </GlassCard>

        <GlassCard className={cn("space-y-5", mobilePane === "list" && "hidden lg:block")}>
          <div>
            <SectionTitle title="Buyer DNA" />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Ring size={62} label="Intent" value={lead.dna.intent} />
              <Ring size={62} label="Trust" value={lead.dna.trust} />
              <Ring size={62} label="Urgency" value={lead.dna.urgency} />
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <p className="glass rounded-[18px] px-3 py-2">{lead.dna.language}</p>
            <p className="glass rounded-[18px] px-3 py-2">{lead.dna.style}</p>
          </div>
          <div>
            <SectionTitle title="Suggested replies" />
            <div className="mt-2 space-y-2">
              {[
                `Hi ${lead.name.split(" ")[0]}, sending the revised numbers now.`,
                "Would a quick 10-minute call today help?",
                "I can hold this pricing until Friday.",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="glass w-full rounded-[18px] px-3 py-2 text-left text-xs transition hover:-translate-y-0.5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-primary/10 rounded-[18px] p-3 text-xs">
            <span className="text-primary font-semibold">Next best action</span>
            <p className="mt-1">{lead.nextAction}</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

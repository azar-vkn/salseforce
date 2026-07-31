import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { aiReply, aiSuggestions } from "@/lib/mock-data";

export const Route = createFileRoute("/ai-brain")({
  head: () => ({
    meta: [
      { title: "AI Brain — SalesMind AI" },
      { name: "description", content: "Ask your AI sales assistant anything about your pipeline." },
      { property: "og:title", content: "AI Brain — SalesMind AI" },
      {
        property: "og:description",
        content: "Ask your AI sales assistant anything about your pipeline.",
      },
    ],
  }),
  component: AiBrain,
});

type Msg = { id: string; role: "user" | "ai"; text: string };

function AiBrain() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "intro",
      role: "ai",
      text: "Good morning, John. Your pipeline is worth ₹18.2L in active negotiations. Ask me anything — or pick a suggestion below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function ask(text: string) {
    if (!text.trim() || thinking) return;
    setMessages((p) => [...p, { id: crypto.randomUUID(), role: "user", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "ai", text: aiReply(text) }]);
      setThinking(false);
      inputRef.current?.focus();
    }, 700);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="from-primary to-accent grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br">
          <Bot className="text-primary-foreground h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">AI Brain</h1>
          <p className="text-muted-foreground text-sm">Always on. Never intrusive.</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <GlassCard className="flex min-h-[30rem] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rise max-w-[80%] rounded-[22px] rounded-br-lg px-4 py-2.5 text-sm"
                      : "rise text-foreground/90 max-w-[85%] text-sm leading-relaxed whitespace-pre-line"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking ? (
              <p className="text-muted-foreground animate-[soft-pulse_1.2s_ease-in-out_infinite] text-sm">
                Thinking…
              </p>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-border/60 space-y-3 border-t p-4">
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="glass rounded-full px-3 py-1.5 text-xs transition hover:-translate-y-0.5"
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
                placeholder="Ask your AI assistant…"
                className="bg-background/60 focus:ring-ring/60 h-12 min-w-0 flex-1 rounded-[20px] px-4 text-sm outline-none focus:ring-2"
              />
              <Island type="submit" aria-label="Send" className="px-4 py-3.5">
                <Send className="h-4 w-4" />
              </Island>
            </form>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard delay={120}>
            <SectionTitle title="Daily briefing" />
            <ul className="text-foreground/90 mt-2 space-y-2 text-sm">
              <li>8 hot leads · 3 meetings · 12 follow-ups</li>
              <li>₹4.2L expected to close today</li>
              <li>2 leads at risk of going cold</li>
            </ul>
          </GlassCard>
          <GlassCard delay={180}>
            <SectionTitle title="Quick actions" />
            <div className="mt-3 flex flex-wrap gap-2">
              {aiSuggestions.slice(3).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition hover:-translate-y-0.5"
                >
                  <Sparkles className="text-primary h-3.5 w-3.5" />
                  {s}
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, X, Send } from "lucide-react";
import { Island, GlassCard } from "@/components/glass";
import { aiReply, aiSuggestions } from "@/lib/mock-data";

export function AskAiIsland() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  function ask(text: string) {
    if (!text.trim()) return;
    setThinking(true);
    setAnswer(null);
    setQ(text);
    setTimeout(() => {
      setAnswer(aiReply(text));
      setThinking(false);
    }, 650);
  }

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-24 z-40 flex justify-end lg:bottom-8">
        <Island
          aria-label="Ask AI"
          onClick={() => setOpen((v) => !v)}
          className="pointer-events-auto px-5 py-3.5"
          icon={<Bot className="h-5 w-5" />}
        >
          Ask AI
        </Island>
      </div>

      {open ? (
        <div className="fixed inset-x-3 bottom-40 z-50 sm:inset-x-auto sm:right-6 sm:w-[26rem] lg:bottom-24">
          <GlassCard className="rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="bg-primary/15 text-primary grid h-8 w-8 place-items-center rounded-2xl">
                  <Bot className="h-4 w-4" />
                </span>
                AI Brain
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close AI panel"
                className="hover:bg-muted rounded-full p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto text-sm">
              {thinking ? (
                <p className="text-muted-foreground animate-[soft-pulse_1.2s_ease-in-out_infinite]">
                  Thinking…
                </p>
              ) : answer ? (
                <p className="text-foreground/90 whitespace-pre-line">{answer}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {aiSuggestions.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="glass rounded-full px-3 py-1.5 text-xs transition hover:-translate-y-0.5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(q);
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask anything about your pipeline…"
                className="bg-background/60 focus:ring-ring/60 h-11 flex-1 rounded-[18px] px-4 text-sm outline-none focus:ring-2"
              />
              <Island type="submit" aria-label="Send" className="px-3.5 py-3">
                <Send className="h-4 w-4" />
              </Island>
            </form>
            <Link
              to="/ai-brain"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-primary mt-2 inline-block text-xs"
            >
              Open full AI Brain →
            </Link>
          </GlassCard>
        </div>
      ) : null}
    </>
  );
}

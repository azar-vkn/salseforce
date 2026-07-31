import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, Rows3, Plus, PhoneCall, MessageCircle, CalendarPlus, Search } from "lucide-react";
import { GlassCard, Island, Ring } from "@/components/glass";
import { leads, type Lead } from "@/lib/mock-data";
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
};

function LeadsPage() {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);

  const filtered = leads.filter((l) =>
    (l.name + l.company + l.stage).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Leads</h1>
          <p className="text-muted-foreground mt-1 text-sm">{filtered.length} active opportunities</p>
        </div>
        <Island icon={<Plus className="h-4 w-4" />} onClick={() => toast.success("New lead form opened")}>
          Add Lead
        </Island>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[20px] px-4">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads…"
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
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1">{l.value}</span>
              </div>

              <p className="text-muted-foreground mt-4 text-xs">
                Next action · <span className="text-foreground font-medium">{l.nextAction}</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2 opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
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
                  onClick={() => toast(`Message drafted for ${l.name}`)}
                >
                  Message
                </Island>
                <Island
                  variant="glass"
                  className="px-3 py-2 text-xs"
                  icon={<CalendarPlus className="h-3.5 w-3.5" />}
                  onClick={() => setSelected(l)}
                >
                  Buyer DNA
                </Island>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                {["Lead", "Company", "Stage", "Score", "Value", "Next action"].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="hover:bg-primary-soft/50 cursor-pointer transition"
                >
                  <td className="rounded-l-[16px] px-3 py-3 font-medium">{l.name}</td>
                  <td className="text-muted-foreground px-3 py-3">{l.company}</td>
                  <td className="px-3 py-3">{l.stage}</td>
                  <td className="text-primary px-3 py-3 font-semibold">{l.score}</td>
                  <td className="px-3 py-3">{l.value}</td>
                  <td className="text-muted-foreground rounded-r-[16px] px-3 py-3">{l.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="glass rise w-full max-w-lg rounded-[30px] p-6"
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
      ) : null}
    </div>
  );
}

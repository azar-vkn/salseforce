import { supabase } from "@/lib/supabase";
import type { Lead, Task, ConversationThread } from "@/lib/types";

const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Database context ────────────────────────────────────────────────
export type CrmContext = {
  leads: Lead[];
  tasks: Task[];
  conversations: ConversationThread[];
};

/** Fetch all CRM data from Supabase to feed into the AI prompt. */
export async function fetchCrmContext(): Promise<CrmContext> {
  const [leadsRes, tasksRes, convsRes] = await Promise.all([
    supabase.from("leads").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("conversations").select("*"),
  ]);

  return {
    leads: (leadsRes.data as Lead[]) ?? [],
    tasks: (tasksRes.data as Task[]) ?? [],
    conversations: (convsRes.data as ConversationThread[]) ?? [],
  };
}

// ── Build system prompt with live data ──────────────────────────────
function buildSystemPrompt(ctx: CrmContext): string {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Leads summary
  const leadsBlock =
    ctx.leads.length > 0
      ? ctx.leads
          .map(
            (l) =>
              `• ${l.name} (${l.company}) — Stage: ${l.stage}, Score: ${l.score}/100, Value: ${l.value}, Status: ${l.status}, Emotion: ${l.emotion}, Next: ${l.nextAction}`
          )
          .join("\n")
      : "No leads in the database yet.";

  // Tasks summary
  const todayTasks = ctx.tasks.filter((t) => t.column === "today");
  const tomorrowTasks = ctx.tasks.filter((t) => t.column === "tomorrow");
  const upcomingTasks = ctx.tasks.filter((t) => t.column === "upcoming");
  const completedTasks = ctx.tasks.filter((t) => t.column === "completed");

  const tasksBlock =
    ctx.tasks.length > 0
      ? [
          todayTasks.length > 0
            ? `Today:\n${todayTasks.map((t) => `  • ${t.title} (Lead: ${t.lead}, Tag: ${t.tag})`).join("\n")}`
            : null,
          tomorrowTasks.length > 0
            ? `Tomorrow:\n${tomorrowTasks.map((t) => `  • ${t.title} (Lead: ${t.lead}, Tag: ${t.tag})`).join("\n")}`
            : null,
          upcomingTasks.length > 0
            ? `Upcoming:\n${upcomingTasks.map((t) => `  • ${t.title} (Lead: ${t.lead}, Tag: ${t.tag})`).join("\n")}`
            : null,
          completedTasks.length > 0
            ? `Completed:\n${completedTasks.map((t) => `  • ${t.title} (Lead: ${t.lead}, Tag: ${t.tag})`).join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "No tasks in the database yet.";

  // Conversations summary (keep it concise — last 2 messages per thread)
  const convsBlock =
    ctx.conversations.length > 0
      ? ctx.conversations
          .map((c) => {
            const recent = c.messages.slice(-2);
            const msgs = recent
              .map((m) => `    [${m.from}] ${m.text}`)
              .join("\n");
            return `  Thread ${c.id}:\n${msgs}`;
          })
          .join("\n")
      : "No conversations yet.";

  // Pipeline stats
  const totalLeads = ctx.leads.length;
  const byStage = ctx.leads.reduce(
    (acc, l) => {
      acc[l.stage] = (acc[l.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const stagesSummary = Object.entries(byStage)
    .map(([stage, count]) => `${stage}: ${count}`)
    .join(", ");

  return `You are SalesMind AI — an intelligent, data-driven sales assistant embedded in a CRM application.
Today is ${today}.

You have LIVE access to the user's CRM data. Use it to answer questions accurately. Never say you don't have access to data.

═══ PIPELINE OVERVIEW ═══
Total leads: ${totalLeads}
Stages: ${stagesSummary || "N/A"}

═══ LEADS ═══
${leadsBlock}

═══ TASKS ═══
${tasksBlock}

═══ RECENT CONVERSATIONS ═══
${convsBlock}

═══ INSTRUCTIONS ═══
- Answer questions using the CRM data above. Be specific with names, values, and dates.
- When asked to draft emails, personalize them using lead details (name, company, emotion, stage).
- When summarizing, use bullet points and keep it concise.
- For pipeline questions, calculate totals and percentages from the data.
- If the data is empty, acknowledge it and suggest the user add data.
- Format currency in ₹ (Indian Rupees) unless the data shows otherwise.`;
}

// ── Main AI reply function ──────────────────────────────────────────
export async function getAiReply(prompt: string): Promise<string> {
  if (!apiKey) {
    return "Error: VITE_OPENROUTER_API_KEY is missing in your .env.local file. Please add it and restart the server.";
  }

  try {
    // Fetch live CRM data
    const ctx = await fetchCrmContext();
    const systemPrompt = buildSystemPrompt(ctx);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "SalesMind AI",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message =
        errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error("OpenRouter API Error:", message);
      return `AI Error: ${message}`;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.error("OpenRouter: No text in response", data);
      return "Sorry, the AI returned an empty response. Please try again.";
    }

    return text;
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    return `Sorry, I ran into an error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

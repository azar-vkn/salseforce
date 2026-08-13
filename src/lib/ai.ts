import { supabase } from "@/lib/supabase";
import type { Lead, Task, ConversationThread } from "@/lib/types";
import { INITIAL_LEADS, INITIAL_TASKS, INITIAL_CONVERSATIONS } from "@/hooks/use-supabase";
import { executeAiBrainPipeline } from "@/lib/ai-brain-engine";


const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Database context ────────────────────────────────────────────────
export type CrmContext = {
  leads: Lead[];
  tasks: Task[];
  conversations: ConversationThread[];
};

/** Fetch all CRM data with local storage fallback */
export async function fetchCrmContext(): Promise<CrmContext> {
  try {
    const [leadsRes, tasksRes, convsRes] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("conversations").select("*"),
    ]);

    const leads = (leadsRes.data as Lead[]) ?? [];
    const tasks = (tasksRes.data as Task[]) ?? [];
    const conversations = (convsRes.data as ConversationThread[]) ?? [];

    if (leads.length > 0) {
      return { leads, tasks, conversations };
    }
  } catch {
    // Ignore error
  }

  // Local storage cache fallback
  const getLocal = <T>(key: string, seed: T[]): T[] => {
    try {
      const raw = localStorage.getItem(`salesmind-${key}`);
      return raw ? JSON.parse(raw) : seed;
    } catch {
      return seed;
    }
  };

  return {
    leads: getLocal("leads", INITIAL_LEADS),
    tasks: getLocal("tasks", INITIAL_TASKS),
    conversations: getLocal("conversations", INITIAL_CONVERSATIONS),
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

  const leadsBlock =
    ctx.leads.length > 0
      ? ctx.leads
          .map(
            (l) =>
              `• ${l.name} (${l.company}) — Stage: ${l.stage}, Score: ${l.score}/100, Value: ${l.value}, Status: ${l.status}, Emotion: ${l.emotion}, Next: ${l.nextAction}`
          )
          .join("\n")
      : "No leads in the database yet.";

  const todayTasks = ctx.tasks.filter((t) => t.column === "today");
  const tomorrowTasks = ctx.tasks.filter((t) => t.column === "tomorrow");

  const tasksBlock =
    ctx.tasks.length > 0
      ? [
          todayTasks.length > 0
            ? `Today:\n${todayTasks.map((t) => `  • ${t.title} (Lead: ${t.lead})`).join("\n")}`
            : null,
          tomorrowTasks.length > 0
            ? `Tomorrow:\n${tomorrowTasks.map((t) => `  • ${t.title} (Lead: ${t.lead})`).join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "No tasks scheduled yet.";

  return `You are SalesMind AI — an intelligent, data-driven sales employee in a CRM.
Today is ${today}.

LIVE PIPELINE DATA:
Total leads: ${ctx.leads.length}
Leads:
${leadsBlock}

Scheduled Tasks:
${tasksBlock}

INSTRUCTIONS:
- Give concise, direct, helpful answers based on the live CRM data above.
- Mention specific names, values, and deal stages.
- Format money in ₹ (Lakhs / Thousands).`;
}

// ── Smart Local AI Fallback Generator ──────────────────────────────
function generateSmartFallback(prompt: string, ctx: CrmContext): string {
  const lower = prompt.toLowerCase();
  const hotLeads = ctx.leads.filter((l) => l.score >= 75);
  const totalValue = ctx.leads.reduce((acc, l) => acc + (parseFloat(l.value.replace(/[^0-9.]/g, "")) || 0), 0);

  if (lower.includes("summarize") || lower.includes("open deal") || lower.includes("pipeline")) {
    return `📊 **Pipeline Briefing**\n\n• **Active Opportunities**: ${ctx.leads.length} leads in pipeline\n• **Hot Deals**: ${hotLeads.length} leads with score > 75 (Top deal: ${hotLeads[0]?.name || "N/A"} at ${hotLeads[0]?.value || "₹0"})\n• **Estimated Pipeline Value**: ₹${totalValue.toFixed(1)} Lakhs\n• **Recommended Focus**: Follow up with ${hotLeads[0]?.name || "your top lead"} regarding "${hotLeads[0]?.nextAction || "next steps"}".`;
  }

  if (lower.includes("lead") || lower.includes("new")) {
    return `👥 **Lead Intelligence**\n\nYou currently have **${ctx.leads.length} active leads**.\n\n🔥 **Top Hot Leads:**\n${hotLeads.slice(0, 3).map((l) => `• **${l.name}** (${l.company}) — Score: ${l.score} | Stage: ${l.stage} | Next: ${l.nextAction}`).join("\n")}`;
  }

  if (lower.includes("email") || lower.includes("check-in") || lower.includes("draft") || lower.includes("rejection")) {
    const lead = ctx.leads[0];
    return `✉️ **AI Drafted Email for ${lead?.name || "Lead"}**\n\n**Subject**: Next Steps regarding ${lead?.company || "our partnership"}\n\nHi ${lead?.name?.split(" ")[0] || "there"},\n\nI hope you're having a productive week! Following up on our recent conversation regarding ${lead?.nextAction || "our platform"}.\n\nWe're eager to support ${lead?.company || "your team"} with our AI solution. Would a quick 10-minute touchpoint this Thursday work for you?\n\nBest regards,\nJohn Doe\nSalesMind AI`;
  }

  if (lower.includes("pitch") || lower.includes("tier") || lower.includes("price")) {
    return `💡 **Premium Pitch Strategy**\n\n1. **Highlight Automation & ROI**: SalesMind AI reduces admin tasks by 70% and boosts deal closing rate by 34%.\n2. **Focus on Buyer DNA**: Tailor key metrics to lead's buying style (e.g. data-driven ROI for Asirvatha, direct architecture walkthrough for Azar).\n3. **Offer Guarantee**: 30-day performance benchmark guarantee to ease price sensitivity.`;
  }

  return `🤖 **SalesMind AI Insight**\n\nBased on your live CRM context:\n• You have **${ctx.leads.length} leads** in your pipeline.\n• Top recommendation: Complete today's task **"${ctx.tasks[0]?.title || "Follow up with leads"}"**.\n\nHow else can I assist you with closing your deals today?`;
}

// ── Main AI reply function grounded in Central CRM AI Brain ─────────
export async function getAiReply(prompt: string): Promise<string> {
  const ctx = await fetchCrmContext();
  const brainResult = await executeAiBrainPipeline(prompt, ctx.leads[0]);

  if (brainResult.replyText) {
    return brainResult.replyText;
  }

  return generateSmartFallback(prompt, ctx);
}

export { generateAutonomousReply, type AutonomousReplyResult } from "./ai-service";


import { type Lead, type ConversationThread, type CallRecord } from "@/lib/types";

export interface CallAiContext {
  customerName: string;
  company: string;
  phone: string;
  stage: string;
  dealValue: string;
  nextAction: string;
  buyerDna: {
    budget: number;
    intent: number;
    trust: number;
    priceSensitivity: number;
    urgency: number;
    language: string;
    style: string;
  };
  previousObjections: string[];
  recentMessages: string[];
  previousCallSummaries: string[];
  promptInstructions: string;
}

/**
 * Builds structured AI context prior to an AI call.
 * Uses CRM lead data, Buyer DNA, message history, and past call summaries.
 * NEVER exposes internal scoring percentages directly to the customer.
 */
export function buildCallAiContext(
  lead: Lead,
  conversation?: ConversationThread | null,
  pastCalls: CallRecord[] = []
): CallAiContext {
  const phone = lead.phone || lead.whatsapp || "Unknown";
  
  // Extract previous messages
  const recentMsgs = (conversation?.messages || [])
    .slice(-5)
    .map((m) => `${m.from.toUpperCase()}: ${m.text}`);

  // Extract previous call summaries
  const prevSummaries = pastCalls
    .filter((c) => c.leadId === lead.id && c.summary)
    .slice(-3)
    .map((c) => `[${c.startedAt.slice(0, 10)}] ${c.summary}`);

  // Extract known objections from past call analysis
  const prevObjections: string[] = [];
  pastCalls.forEach((c) => {
    if (c.analysis?.objections) {
      c.analysis.objections.forEach((obj) => {
        if (!prevObjections.includes(obj)) prevObjections.push(obj);
      });
    }
  });

  const promptInstructions = `
You are SalesMind AI Voice Assistant representing SalesMind AI.
You are calling/speaking with ${lead.name} from ${lead.company}.
Current Deal Value: ${lead.value}. Stage: ${lead.stage}. Next Action: ${lead.nextAction}.

BUYER INTEL:
- Communication Preference: ${lead.dna.language}
- Decision Style: ${lead.dna.style}
${prevObjections.length > 0 ? `- Known Objections: ${prevObjections.join(", ")}` : ""}

BEHAVIOR GUIDELINES:
1. Speak naturally, warmly, and concisely.
2. Ask ONE clear question at a time.
3. Validate requirements, budget, price sensitivity, and urgency.
4. DO NOT reveal internal numerical scoring thresholds to the customer.
5. DO NOT invent fake prices, discounts, or promises without confirmation.
6. If the customer explicitly requests a human representative or is frustrated, offer an immediate transfer to a human supervisor.
`.trim();

  return {
    customerName: lead.name,
    company: lead.company,
    phone,
    stage: lead.stage,
    dealValue: lead.value,
    nextAction: lead.nextAction,
    buyerDna: {
      budget: lead.dna.budget,
      intent: lead.dna.intent,
      trust: lead.dna.trust,
      priceSensitivity: lead.dna.priceSensitivity,
      urgency: lead.dna.urgency,
      language: lead.dna.language,
      style: lead.dna.style,
    },
    previousObjections: prevObjections,
    recentMessages: recentMsgs,
    previousCallSummaries: prevSummaries,
    promptInstructions,
  };
}

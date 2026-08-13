import { executeAiBrainPipeline } from "@/lib/ai-brain-engine";
import { type Lead, type BuyerDna, type AiAgentRule } from "@/lib/types";
import { INITIAL_AI_RULES } from "@/hooks/use-supabase";

export interface AutonomousReplyResult {
  replyText: string;
  confidence: number;
  updatedDna?: Partial<BuyerDna>;
  suggestedAction?: string;
  detectedEmotion?: "Excited" | "Curious" | "Hesitant" | "Neutral" | "Frustrated";
}

/**
 * Autonomous AI Query Resolution Pipeline
 * Evaluates the query against the Central CRM AI Brain, enforces business rules, and outputs grounded responses
 */
export async function generateAutonomousReply(
  customerQuery: string,
  lead?: Lead,
  rules: AiAgentRule = INITIAL_AI_RULES
): Promise<AutonomousReplyResult> {
  const brainResult = await executeAiBrainPipeline(customerQuery, lead);

  return {
    replyText: brainResult.replyText,
    confidence: brainResult.confidence,
    suggestedAction: brainResult.suggestedAction,
    detectedEmotion: brainResult.confidence > 85 ? "Curious" : "Neutral",
    updatedDna: lead ? {
      intent: Math.min(100, Math.max(10, lead.dna.intent + (brainResult.confidence > 85 ? 5 : 0))),
      urgency: Math.min(100, Math.max(10, lead.dna.urgency + (brainResult.confidence > 85 ? 3 : 0))),
    } : undefined,
  };
}


function generateLocalAutonomousReply(query: string, lead?: Lead): AutonomousReplyResult {
  const q = query.toLowerCase();
  const name = lead?.name?.split(" ")[0] || "there";
  const company = lead?.company || "your company";

  if (q.includes("pricing") || q.includes("cost") || q.includes("package") || q.includes("price") || q.includes("rate")) {
    return {
      replyText: `Hi ${name}, our Growth plan starts at ₹4,999/mo per seat with full AI automation, and our Enterprise tier includes custom LLM fine-tuning and dedicated SLA support. Would you like me to send our complete tier breakdown for ${company}?`,
      confidence: 94,
      detectedEmotion: "Curious",
      suggestedAction: "Send custom pricing proposal deck",
      updatedDna: lead ? {
        budget: Math.min(100, lead.dna.budget + 5),
        intent: Math.min(100, lead.dna.intent + 8),
        priceSensitivity: Math.min(100, lead.dna.priceSensitivity + 10),
      } : undefined,
    };
  }

  if (q.includes("demo") || q.includes("schedule") || q.includes("call") || q.includes("meet") || q.includes("tomorrow")) {
    return {
      replyText: `We'd love to host a 15-minute live walkthrough for ${company}! I have open slots tomorrow at 11:30 AM or 4:00 PM IST — does either work for you?`,
      confidence: 96,
      detectedEmotion: "Excited",
      suggestedAction: "Book calendar slot on Google Calendar / Cal.com",
      updatedDna: lead ? {
        intent: Math.min(100, lead.dna.intent + 12),
        urgency: Math.min(100, lead.dna.urgency + 15),
        trust: Math.min(100, lead.dna.trust + 8),
      } : undefined,
    };
  }

  if (q.includes("soc2") || q.includes("sla") || q.includes("security") || q.includes("compliance") || q.includes("gdpr")) {
    return {
      replyText: `Yes, ${company}! SalesMind AI provides 99.95% uptime SLA, SOC2 Type II compliance, and full end-to-end data encryption with regional data residency. I can attach our Security Whitepaper right now.`,
      confidence: 92,
      detectedEmotion: "Curious",
      suggestedAction: "Share SOC2 compliance certificate & security whitepaper",
      updatedDna: lead ? {
        trust: Math.min(100, lead.dna.trust + 15),
        intent: Math.min(100, lead.dna.intent + 5),
      } : undefined,
    };
  }

  if (q.includes("discount") || q.includes("annual") || q.includes("cheaper") || q.includes("deal")) {
    return {
      replyText: `We offer a 20% savings on all annual billing commitments, plus complimentary onboarding support for your entire team at ${company}. Let's lock this in for your upcoming quarter.`,
      confidence: 90,
      detectedEmotion: "Hesitant",
      suggestedAction: "Prepare 20% annual billing quote with terms",
      updatedDna: lead ? {
        priceSensitivity: Math.min(100, lead.dna.priceSensitivity + 15),
        urgency: Math.min(100, lead.dna.urgency + 10),
      } : undefined,
    };
  }

  // General default fallback reply
  return {
    replyText: `Thanks for asking, ${name}! We can certainly tailor that to meet ${company}'s sales workflow requirements. Let me review your specifics with our solutions engineer and share full details shortly.`,
    confidence: 86,
    detectedEmotion: "Neutral",
    suggestedAction: "Review custom workflow requirements",
    updatedDna: lead ? {
      intent: Math.min(100, lead.dna.intent + 4),
    } : undefined,
  };
}

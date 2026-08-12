import { type Lead, type BuyerDna } from "@/lib/types";
import { calculateUpdatedBuyerDna } from "./buyer-dna-updater";

export interface CrmToolResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Secure CRM Tool: Retrieve customer details, company, deal stage, and value by phone number.
 */
export function getCustomerContextTool(leads: Lead[], phone: string): CrmToolResponse {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const matched = leads.find((l) => {
    const p1 = (l.phone || "").replace(/\D/g, "");
    const p2 = (l.whatsapp || "").replace(/\D/g, "");
    return (p1 && cleanPhone.endsWith(p1)) || (p2 && cleanPhone.endsWith(p2));
  });

  if (!matched) {
    return {
      success: false,
      message: `No existing CRM lead found matching phone ${phone}. New caller workflow initialized.`,
    };
  }

  return {
    success: true,
    data: {
      id: matched.id,
      name: matched.name,
      company: matched.company,
      stage: matched.stage,
      value: matched.value,
      nextAction: matched.nextAction,
      score: matched.score,
      emotion: matched.emotion,
      buyerDna: {
        budget: matched.dna.budget,
        intent: matched.dna.intent,
        trust: matched.dna.trust,
        priceSensitivity: matched.dna.priceSensitivity,
        urgency: matched.dna.urgency,
        language: matched.dna.language,
        style: matched.dna.style,
      },
    },
  };
}

/**
 * Secure CRM Tool: Retrieve Buyer DNA for a given lead ID.
 */
export function getBuyerDnaTool(lead: Lead): CrmToolResponse {
  return {
    success: true,
    data: {
      leadId: lead.id,
      name: lead.name,
      buyerDna: lead.dna,
    },
  };
}

/**
 * Secure CRM Tool: Update Buyer DNA through confidence-weighted scoring engine.
 */
export function updateBuyerDnaTool(
  currentDna: BuyerDna,
  signals: {
    intentScore?: number;
    budgetSignal?: number;
    trustSignal?: number;
    priceSensitivity?: number;
    urgencySignal?: number;
    confidence?: number;
  }
): CrmToolResponse {
  const analysisPayload = {
    callId: `call_tool_${Date.now()}`,
    confidence: signals.confidence ?? 85,
    intentScore: signals.intentScore,
    budgetSignal: signals.budgetSignal,
    trustSignal: signals.trustSignal,
    priceSensitivity: signals.priceSensitivity,
    urgencySignal: signals.urgencySignal,
  };

  const { updatedDna, hasSignificantChange, changesSummary } = calculateUpdatedBuyerDna(currentDna, analysisPayload);

  return {
    success: true,
    data: {
      updatedDna,
      hasSignificantChange,
      changesSummary,
    },
  };
}

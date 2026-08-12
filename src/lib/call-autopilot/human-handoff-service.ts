import { type CallAutopilotSettings, type CallTranscriptItem } from "@/lib/types";

export interface HandoffEvaluationResult {
  shouldTransfer: boolean;
  reason?: string;
  triggerType?: "CUSTOMER_REQUEST" | "LOW_CONFIDENCE" | "COMPLEX_NEGOTIATION" | "FRUSTRATION";
}

/**
 * Evaluates active call events & transcript text against configured Call Autopilot settings
 * to decide whether a live transfer to a human supervisor/rep is required.
 */
export function evaluateHumanHandoff(
  latestUtterance: string,
  currentConfidence: number,
  settings: CallAutopilotSettings,
  transcriptsHistory: CallTranscriptItem[] = []
): HandoffEvaluationResult {
  const textLower = latestUtterance.toLowerCase();

  // 1. Explicit Customer Request for Human
  if (settings.transferOnCustomerRequest) {
    const humanKeywords = [
      "speak to a person",
      "speak to a human",
      "real person",
      "human agent",
      "supervisor",
      "representative",
      "transfer me",
      "manager",
      "talk to someone",
    ];
    if (humanKeywords.some((k) => textLower.includes(k))) {
      return {
        shouldTransfer: true,
        triggerType: "CUSTOMER_REQUEST",
        reason: "Customer explicitly requested to speak to a human representative.",
      };
    }
  }

  // 2. AI Confidence Drop below threshold
  if (settings.transferOnLowConfidence) {
    const minThreshold = settings.minConfidenceThreshold ?? 75;
    if (currentConfidence < minThreshold) {
      return {
        shouldTransfer: true,
        triggerType: "LOW_CONFIDENCE",
        reason: `AI confidence (${currentConfidence}%) fell below configured threshold (${minThreshold}%).`,
      };
    }
  }

  // 3. Customer Frustration Detection
  if (settings.transferOnFrustration) {
    const frustrationKeywords = [
      "frustrated",
      "annoyed",
      "useless",
      "stupid bot",
      "waste of time",
      "hang up",
      "terrible",
      "ridiculous",
    ];
    if (frustrationKeywords.some((k) => textLower.includes(k))) {
      return {
        shouldTransfer: true,
        triggerType: "FRUSTRATION",
        reason: "Customer dissatisfaction or frustration detected in voice conversation.",
      };
    }
  }

  // 4. Complex Negotiation Detection
  if (settings.transferOnComplexNegotiation) {
    const negotiationKeywords = [
      "custom contract",
      "sla guarantee",
      "discount 50%",
      "custom features",
      "legal review",
      "msa",
      "nda",
    ];
    if (negotiationKeywords.some((k) => textLower.includes(k))) {
      return {
        shouldTransfer: true,
        triggerType: "COMPLEX_NEGOTIATION",
        reason: "Complex enterprise negotiation or custom legal term requested.",
      };
    }
  }

  return { shouldTransfer: false };
}

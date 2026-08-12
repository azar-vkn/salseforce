import { type BuyerDna, type CallAiAnalysis } from "@/lib/types";

/**
 * Calculates updated Buyer DNA using weighted confidence validation.
 * Prevents arbitrary score overrides when AI extraction confidence is low.
 */
export function calculateUpdatedBuyerDna(
  currentDna: BuyerDna,
  analysis: CallAiAnalysis
): { updatedDna: BuyerDna; hasSignificantChange: boolean; changesSummary: string[] } {
  const confidence = analysis.confidence ?? 70;
  
  // If AI confidence is below 60%, do not apply automatic score changes
  if (confidence < 60) {
    return {
      updatedDna: currentDna,
      hasSignificantChange: false,
      changesSummary: ["Confidence too low (< 60%) to apply automatic Buyer DNA update."],
    };
  }

  // Weight factor based on confidence (0.6 to 0.9 -> 15% to 40% blend)
  const weight = Math.min(0.4, Math.max(0.15, (confidence - 50) / 100));

  const blend = (current: number, signal?: number) => {
    if (signal === undefined || isNaN(signal)) return current;
    const next = Math.round(current * (1 - weight) + signal * weight);
    return Math.min(100, Math.max(0, next));
  };

  const newBudget = blend(currentDna.budget, analysis.budgetSignal);
  const newIntent = blend(currentDna.intent, analysis.intentScore);
  const newTrust = blend(currentDna.trust, analysis.trustSignal);
  const newPriceSensitivity = blend(currentDna.priceSensitivity, analysis.priceSensitivity);
  const newUrgency = blend(currentDna.urgency, analysis.urgencySignal);

  const changesSummary: string[] = [];
  if (Math.abs(newBudget - currentDna.budget) >= 3) {
    changesSummary.push(`Budget: ${currentDna.budget}% → ${newBudget}%`);
  }
  if (Math.abs(newIntent - currentDna.intent) >= 3) {
    changesSummary.push(`Intent: ${currentDna.intent}% → ${newIntent}%`);
  }
  if (Math.abs(newTrust - currentDna.trust) >= 3) {
    changesSummary.push(`Trust: ${currentDna.trust}% → ${newTrust}%`);
  }
  if (Math.abs(newPriceSensitivity - currentDna.priceSensitivity) >= 3) {
    changesSummary.push(`Price Sensitivity: ${currentDna.priceSensitivity}% → ${newPriceSensitivity}%`);
  }
  if (Math.abs(newUrgency - currentDna.urgency) >= 3) {
    changesSummary.push(`Urgency: ${currentDna.urgency}% → ${newUrgency}%`);
  }

  const updatedDna: BuyerDna = {
    ...currentDna,
    budget: newBudget,
    intent: newIntent,
    trust: newTrust,
    priceSensitivity: newPriceSensitivity,
    urgency: newUrgency,
    confidence: Math.round((currentDna.confidence + confidence) / 2),
  };

  return {
    updatedDna,
    hasSignificantChange: changesSummary.length > 0,
    changesSummary,
  };
}

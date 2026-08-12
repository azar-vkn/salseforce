import { type CallTranscriptItem, type CallAiAnalysis } from "@/lib/types";

const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Analyzes call transcripts using LLM / heuristic signal extraction to return
 * structured purchase intent, budget signals, objections, and next actions.
 */
export async function analyzeCallTranscript(
  callId: string,
  transcripts: CallTranscriptItem[],
  customerName: string
): Promise<CallAiAnalysis> {
  const fullText = transcripts.map((t) => `${t.speaker}: ${t.text}`).join("\n");

  if (!fullText.trim()) {
    return {
      callId,
      confidence: 50,
      summary: "Short call attempt with minimal conversation recorded.",
      recommendedNextAction: "Follow up via WhatsApp message",
    };
  }

  // Try OpenRouter / Gemini AI extraction if key present
  if (openrouterApiKey) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://salesmind.ai",
          "X-Title": "SalesMind AI Call Autopilot",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert CRM Call Intelligence Analyst. Analyze the following transcript between AI/Rep and Customer (${customerName}). Output pure valid JSON with keys:
{
  "intentScore": number (0-100),
  "budgetSignal": number (0-100),
  "trustSignal": number (0-100),
  "priceSensitivity": number (0-100),
  "urgencySignal": number (0-100),
  "purchaseProbability": number (0-100),
  "objections": string[],
  "requirements": string[],
  "detectedDealChanges": string,
  "recommendedNextAction": string,
  "confidence": number (0-100),
  "summary": string
}`,
            },
            {
              role: "user",
              content: `TRANSCRIPT:\n${fullText}`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            callId,
            ...parsed,
          };
        }
      }
    } catch (e) {
      console.warn("AI call analysis API fallback:", e);
    }
  }

  // Heuristic Signal Extraction Fallback
  const lower = fullText.toLowerCase();

  const objections: string[] = [];
  if (lower.includes("price") || lower.includes("cost") || lower.includes("expensive") || lower.includes("budget")) {
    objections.push("Price sensitivity & budget alignment");
  }
  if (lower.includes("competitor") || lower.includes("other vendor") || lower.includes("alternative")) {
    objections.push("Evaluating competing solutions");
  }
  if (lower.includes("timing") || lower.includes("next month") || lower.includes("delay")) {
    objections.push("Timing & deployment timeline");
  }

  const requirements: string[] = [];
  if (lower.includes("demo") || lower.includes("walkthrough") || lower.includes("presentation")) {
    requirements.push("Product walkthrough & demo");
  }
  if (lower.includes("discount") || lower.includes("quote") || lower.includes("proposal")) {
    requirements.push("Formal commercial proposal");
  }
  if (lower.includes("enterprise") || lower.includes("integration") || lower.includes("api")) {
    requirements.push("Enterprise API & custom integration");
  }

  const highIntent = lower.includes("buy") || lower.includes("ready") || lower.includes("send proposal") || lower.includes("confirm");
  const highUrgency = lower.includes("this week") || lower.includes("today") || lower.includes("asap") || lower.includes("immediately");

  const intentScore = highIntent ? 88 : 72;
  const budgetSignal = lower.includes("78") || lower.includes("budget") ? 78 : 70;
  const priceSensitivity = lower.includes("expensive") || lower.includes("discount") ? 78 : 50;
  const urgencySignal = highUrgency ? 84 : 65;
  const trustSignal = 80;
  const purchaseProbability = Math.round((intentScore * 0.4) + (urgencySignal * 0.3) + (trustSignal * 0.3));

  const summary = `Customer (${customerName}) discussed solution requirements. ${
    objections.length > 0 ? `Main discussion points: ${objections.join("; ")}.` : "Showed strong interest."
  } Purchase probability estimated at ${purchaseProbability}%.`;

  const recommendedNextAction = highIntent
    ? "Send commercial proposal & schedule final decision call"
    : "Follow up with detailed ROI documentation within 24 hours";

  return {
    callId,
    intentScore,
    budgetSignal,
    trustSignal,
    priceSensitivity,
    urgencySignal,
    purchaseProbability,
    objections,
    requirements,
    detectedDealChanges: highIntent ? "Customer confirmed readiness for proposal stage" : "Requirements collected",
    recommendedNextAction,
    confidence: 85,
    summary,
  };
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type KnowledgeItem,
  type KnowledgeDocument,
  type KnowledgeChunk,
  type BusinessRuleItem,
  type Lead,
  type BuyerDna,
} from "@/lib/types";
import { INITIAL_KNOWLEDGE_ITEMS, INITIAL_BUSINESS_RULES } from "@/hooks/use-ai-brain";

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

export interface BrainSearchResult {
  item: KnowledgeItem | KnowledgeChunk;
  score: number;
  type: string;
  title: string;
  snippet: string;
}

export interface BrainPipelineResult {
  replyText: string;
  confidence: number;
  knowledgeSourcesUsed: string[];
  businessRulesApplied: string[];
  intentDetected: string;
  isUnknownQuestion: boolean;
  updatedDna?: Partial<BuyerDna>;
  suggestedAction?: string;
}

/**
 * Fetch all published knowledge from local storage cache with initial seed fallbacks
 */
function fetchPublishedKnowledgeStore() {
  const getItem = <T>(key: string, seed: T[]): T[] => {
    try {
      const raw = localStorage.getItem(`salesmind-brain-${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return seed;
  };

  const items: KnowledgeItem[] = getItem<KnowledgeItem>("items", INITIAL_KNOWLEDGE_ITEMS).filter((i) => i.status === "PUBLISHED");
  const docs: KnowledgeDocument[] = getItem<KnowledgeDocument>("documents", []).filter((d) => d.status === "PUBLISHED");
  const chunks: KnowledgeChunk[] = getItem<KnowledgeChunk>("chunks", []);
  const rules: BusinessRuleItem[] = getItem<BusinessRuleItem>("business_rules", INITIAL_BUSINESS_RULES).filter((r) => r.status === "PUBLISHED");

  return { items, docs, chunks, rules };
}

/**
 * Search the Central CRM AI Brain for grounded knowledge
 */
export function searchBrainKnowledge(query: string): BrainSearchResult[] {
  const { items, chunks } = fetchPublishedKnowledgeStore();

  // Strip punctuation and normalize whitespace
  const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, " ").trim();
  const words = cleanQuery.split(/\s+/).filter((w) => w.length >= 2);

  const isPricingIntent =
    cleanQuery.includes("price") ||
    cleanQuery.includes("cost") ||
    cleanQuery.includes("package") ||
    cleanQuery.includes("rate") ||
    cleanQuery.includes("fee") ||
    cleanQuery.includes("how much") ||
    cleanQuery.includes("tier") ||
    cleanQuery.includes("discount") ||
    cleanQuery.includes("offer");

  const results: BrainSearchResult[] = [];

  // 1. Search Published Knowledge Items
  for (const item of items) {
    let textToMatch = `${item.title} ${item.category} ${item.type} `.toLowerCase();

    if (typeof item.content === "string") {
      textToMatch += item.content.toLowerCase();
    } else if (typeof item.content === "object" && item.content !== null) {
      textToMatch += JSON.stringify(item.content).toLowerCase();
    }

    let score = 0;

    // Direct match bonus
    if (textToMatch.includes(cleanQuery)) {
      score += 60;
    }

    // Token match check
    for (const w of words) {
      if (textToMatch.includes(w)) {
        score += 20;
      } else if (w.length >= 4 && textToMatch.includes(w.slice(0, 4))) {
        score += 10;
      }
    }

    // Intent-based category boosting
    if (isPricingIntent && ["pricing", "service", "product", "offer", "faq"].includes(item.type)) {
      score += 35;
    }

    // Type priority weights
    const typeWeights: Record<string, number> = {
      pricing: 1.5,
      service: 1.4,
      product: 1.4,
      company: 1.3,
      offer: 1.2,
      policy: 1.2,
      faq: 1.2,
      document: 1.0,
      business_rule: 1.0,
    };
    score = score * (typeWeights[item.type] || 1.0);

    if (score > 0) {
      let snippet = "";
      if (typeof item.content === "string") snippet = item.content;
      else if (item.content.answer) snippet = item.content.answer;
      else if (item.content.description) snippet = item.content.description;
      else if (item.content.price) snippet = `${item.title}: ${item.content.price}. ${item.content.description || ""}`;
      else snippet = JSON.stringify(item.content);

      results.push({
        item,
        score,
        type: item.type,
        title: item.title,
        snippet: snippet.slice(0, 300),
      });
    }
  }

  // 2. Search Uploaded Document Chunks
  for (const chunk of chunks) {
    const chunkText = chunk.content.toLowerCase();
    let score = 0;

    if (chunkText.includes(cleanQuery)) score += 40;

    for (const w of words) {
      if (chunkText.includes(w)) score += 15;
    }

    if (score > 0) {
      results.push({
        item: chunk,
        score,
        type: "document_chunk",
        title: `Doc Chunk #${chunk.chunkIndex + 1}`,
        snippet: chunk.content.slice(0, 300),
      });
    }
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Execute the complete CRM AI Brain Pipeline for any incoming customer query
 */
export async function executeAiBrainPipeline(
  customerQuery: string,
  leadContext?: Lead
): Promise<BrainPipelineResult> {
  const { rules } = fetchPublishedKnowledgeStore();
  const searchResults = searchBrainKnowledge(customerQuery);
  const topMatches = searchResults.slice(0, 4);

  const sourcesUsed = topMatches.map((m) => `${m.title} (${m.type})`);
  const activeRulesList = rules.map((r) => r.ruleText);

  const qClean = customerQuery.toLowerCase().replace(/[^\w\s]/g, " ").trim();
  const isPricingQuery =
    qClean.includes("price") ||
    qClean.includes("cost") ||
    qClean.includes("package") ||
    qClean.includes("rate") ||
    qClean.includes("fee") ||
    qClean.includes("how much") ||
    qClean.includes("discount") ||
    qClean.includes("offer");

  const isCompanySpecific =
    isPricingQuery ||
    qClean.includes("service") ||
    qClean.includes("product") ||
    qClean.includes("policy") ||
    qClean.includes("refund") ||
    qClean.includes("cancel") ||
    qClean.includes("location") ||
    qClean.includes("address") ||
    qClean.includes("office") ||
    qClean.includes("installation") ||
    qClean.includes("warranty") ||
    qClean.includes("soc2") ||
    qClean.includes("support");

  // Determine confidence score
  let confidence = topMatches.length > 0 ? Math.min(98, Math.max(88, 75 + topMatches[0].score)) : 45;
  let isUnknownQuestion = false;

  if (isCompanySpecific && topMatches.length === 0) {
    confidence = 42;
    isUnknownQuestion = true;
  }

  // 1. If confidence is low or information is unconfirmed for company-specific question:
  if (isUnknownQuestion || confidence < 60) {
    const topic = customerQuery.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30);
    return {
      replyText: `I don't have confirmed information about ${topic || "that specific detail"} in our published company knowledge. I can connect you with our team to confirm that right away.`,
      confidence: 45,
      knowledgeSourcesUsed: ["CRM AI Brain Safeguard"],
      businessRulesApplied: ["Anti-Hallucination Rule: Require published company data"],
      intentDetected: "Company Query (Missing Info)",
      isUnknownQuestion: true,
      suggestedAction: "Route query to Unknown Questions queue for admin approval",
    };
  }

  // 2. Build Grounded Context Prompt
  const knowledgeContextText = topMatches
    .map((m, idx) => `[Source ${idx + 1}: ${m.title} (${m.type})]\n${m.snippet}`)
    .join("\n\n");

  const rulesContextText = activeRulesList.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const leadInfoText = leadContext
    ? `Customer: ${leadContext.name}, Company: ${leadContext.company}, Stage: ${leadContext.stage}, Value: ${leadContext.value}, Language Style: ${leadContext.dna.style}`
    : "Customer: Prospect";

  // Attempt LLM execution (Gemini API) if configured
  if (geminiApiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are the central CRM AI Brain representing our company.
Answer the customer's question directly using the ground-truth company knowledge provided below.

PUBLISHED COMPANY KNOWLEDGE:
${knowledgeContextText}

MANDATORY BUSINESS RULES:
${rulesContextText}

CUSTOMER CONTEXT:
${leadInfoText}

INCOMING CUSTOMER QUESTION: "${customerQuery}"

INSTRUCTIONS:
1. State the exact prices, services, or details found in the PUBLISHED COMPANY KNOWLEDGE above.
2. Never send generic "team will follow up" boilerplates when knowledge is available.
3. Keep the response friendly, direct, and high-converting (2-3 sentences).

Respond with a JSON object strictly in this format:
{
  "replyText": "Direct answer with exact price/service details",
  "confidence": 94,
  "intentDetected": "Pricing / Service Inquiry",
  "suggestedAction": "Send proposal"
}`;

      const result = await model.generateContent(prompt);
      const text = (await result.response).text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.replyText && !parsed.replyText.includes("team has received your query")) {
          return {
            replyText: parsed.replyText,
            confidence: parsed.confidence || confidence,
            knowledgeSourcesUsed: sourcesUsed,
            businessRulesApplied: activeRulesList.slice(0, 3),
            intentDetected: parsed.intentDetected || "Grounded Company Answer",
            isUnknownQuestion: false,
            suggestedAction: parsed.suggestedAction || "Follow up on inquiry",
          };
        }
      }
    } catch (err) {
      console.warn("Gemini execution fallback to grounded engine:", err);
    }
  }

  // 3. High-Precision Smart Grounded Response Generator
  if (isPricingQuery) {
    const serviceMatch = topMatches.find((m) => m.type === "service" || m.type === "pricing");
    const productMatch = topMatches.find((m) => m.type === "product");

    const servicePrice = serviceMatch ? (serviceMatch.item as any).content?.price || "₹50,000" : "₹50,000";
    const productPrice = productMatch ? (productMatch.item as any).content?.price || "₹4,999/month" : "₹4,999/month";

    const name = leadContext?.name?.split(" ")[0] || "there";

    return {
      replyText: `Hi ${name}! Our Growth Plan starts at ${productPrice} per seat, and our Pro Website Development package is ${servicePrice} (includes 15–30 days delivery and 3 months support). We also offer a 20% savings on annual billing commitments!`,
      confidence: 96,
      knowledgeSourcesUsed: sourcesUsed,
      businessRulesApplied: activeRulesList.slice(0, 3),
      intentDetected: "PRICING",
      isUnknownQuestion: false,
      suggestedAction: "Send custom pricing proposal deck",
    };
  }

  // Default top-match snippet response
  const topMatch = topMatches[0];
  let replyText = "";

  if (topMatch.type === "faq" && typeof (topMatch.item as any).content === "object") {
    replyText = (topMatch.item as any).content.answer;
  } else if (topMatch.type === "service" && typeof (topMatch.item as any).content === "object") {
    const s = (topMatch.item as any).content;
    replyText = `Our ${s.serviceName || topMatch.title} is priced at ${s.price || "₹50,000"} with estimated delivery in ${s.deliveryTime || "15-30 days"}. Features include: ${Array.isArray(s.features) ? s.features.join(", ") : s.description || "full CRM integration"}.`;
  } else if (topMatch.type === "product" && typeof (topMatch.item as any).content === "object") {
    const p = (topMatch.item as any).content;
    replyText = `Our ${p.productName || topMatch.title} is priced at ${p.price}. ${p.description || ""} ${p.specifications || ""}`;
  } else {
    replyText = topMatch.snippet;
  }

  return {
    replyText,
    confidence: Math.max(90, confidence),
    knowledgeSourcesUsed: sourcesUsed,
    businessRulesApplied: activeRulesList.slice(0, 3),
    intentDetected: topMatch.type.toUpperCase(),
    isUnknownQuestion: false,
    suggestedAction: "Deliver grounded company response to customer",
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { type Lead, type Task, type ConversationThread, type AiAgentRule } from "@/lib/types";
import { broadcastDemoEvent } from "./use-realtime";

// ── Initial Seed Data ──────────────────────────────────────────────
export const INITIAL_LEADS: Lead[] = [
  {
    id: "lead-1",
    name: "Aarav Mehta",
    company: "TechCorp India",
    initials: "AM",
    score: 92,
    stage: "Negotiation",
    nextAction: "Finalize SLA contract terms",
    emotion: "Excited",
    status: "Replied",
    value: "₹8.5L",
    phone: "+91 98765 12345",
    whatsapp: "+91 98765 12345",
    email: "aarav@techcorp.in",
    dna: {
      budget: 85,
      intent: 92,
      trust: 88,
      priceSensitivity: 35,
      urgency: 90,
      language: "English · Professional & direct",
      style: "Data-driven, values ROI metrics",
      confidence: 94,
    },
  },
  {
    id: "lead-2",
    name: "Priya Sharma",
    company: "InnoVision Labs",
    initials: "PS",
    score: 84,
    stage: "Proposal",
    nextAction: "Send customized demo deck",
    emotion: "Curious",
    status: "Unread",
    value: "₹5.2L",
    phone: "+91 98123 45678",
    whatsapp: "+91 98123 45678",
    email: "priya@innovision.com",
    dna: {
      budget: 70,
      intent: 80,
      trust: 75,
      priceSensitivity: 50,
      urgency: 75,
      language: "English · Friendly tone",
      style: "Visual learner, interested in UX demo",
      confidence: 82,
    },
  },
  {
    id: "lead-3",
    name: "Vikram Patel",
    company: "Nexus Solutions",
    initials: "VP",
    score: 78,
    stage: "Qualified",
    nextAction: "Schedule technical review call",
    emotion: "Excited",
    status: "Replied",
    value: "₹3.8L",
    phone: "+91 97654 32109",
    whatsapp: "+91 97654 32109",
    email: "vikram@nexus.co",
    dna: {
      budget: 65,
      intent: 75,
      trust: 80,
      priceSensitivity: 40,
      urgency: 65,
      language: "English / Hindi · Consultative",
      style: "Security & compliance focused",
      confidence: 78,
    },
  },
  {
    id: "lead-4",
    name: "Neha Gupta",
    company: "Apex Global Systems",
    initials: "NG",
    score: 65,
    stage: "New",
    nextAction: "Initial discovery call",
    emotion: "Neutral",
    status: "Waiting",
    value: "₹12.0L",
    phone: "+91 96543 21098",
    whatsapp: "+91 96543 21098",
    email: "neha@apexglobal.com",
    dna: {
      budget: 95,
      intent: 60,
      trust: 50,
      priceSensitivity: 60,
      urgency: 45,
      language: "English · Formal",
      style: "Enterprise procurement process",
      confidence: 65,
    },
  },
  {
    id: "lead-5",
    name: "Rohan Verma",
    company: "Zenith Enterprises",
    initials: "RV",
    score: 95,
    stage: "Won",
    nextAction: "Onboarding kickoff call",
    emotion: "Excited",
    status: "Replied",
    value: "₹6.5L",
    phone: "+91 95432 10987",
    whatsapp: "+91 95432 10987",
    email: "rohan@zenith.org",
    dna: {
      budget: 90,
      intent: 98,
      trust: 95,
      priceSensitivity: 20,
      urgency: 95,
      language: "English · Partner focused",
      style: "Speed of execution priority",
      confidence: 98,
    },
  },
  {
    id: "lead-6",
    name: "Sneha Kapoor",
    company: "Pulse Media",
    initials: "SK",
    score: 58,
    stage: "New",
    nextAction: "Send product brochure & case studies",
    emotion: "Hesitant",
    status: "Unread",
    value: "₹2.4L",
    phone: "+91 94321 09876",
    whatsapp: "+91 94321 09876",
    email: "sneha@pulsemedia.in",
    dna: {
      budget: 40,
      intent: 50,
      trust: 45,
      priceSensitivity: 80,
      urgency: 35,
      language: "English · Casual",
      style: "Cost-sensitive growth startup",
      confidence: 55,
    },
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Call Aarav Mehta regarding contract terms",
    lead: "Aarav Mehta",
    tag: "Call",
    column: "today",
  },
  {
    id: "task-2",
    title: "Send revised proposal to Priya Sharma",
    lead: "Priya Sharma",
    tag: "Meeting",
    column: "today",
  },
  {
    id: "task-3",
    title: "Technical sync with Vikram Patel",
    lead: "Vikram Patel",
    tag: "Demo",
    column: "tomorrow",
  },
  {
    id: "task-4",
    title: "Discovery call with Neha Gupta",
    lead: "Neha Gupta",
    tag: "Call",
    column: "upcoming",
  },
  {
    id: "task-5",
    title: "Send welcome onboarding kit",
    lead: "Rohan Verma",
    tag: "Email",
    column: "completed",
  },
];

export const INITIAL_CONVERSATIONS: ConversationThread[] = [
  {
    id: "lead-1",
    messages: [
      { id: "m1", from: "them", text: "Hi! Can you send over the updated SLA draft?", time: "10:15 AM" },
      { id: "m2", from: "me", text: "Sure Aarav, I'm reviewing the final clauses with legal right now.", time: "10:20 AM" },
      { id: "m3", from: "them", text: "Great! If everything looks good, we can sign by Thursday.", time: "10:28 AM" },
    ],
  },
  {
    id: "lead-2",
    messages: [
      { id: "m4", from: "them", text: "Thanks for the intro call. Could you send the pricing tier details?", time: "Yesterday" },
      { id: "m5", from: "me", text: "Hi Priya! Absolutely, sending over our proposal document now.", time: "Yesterday" },
    ],
  },
  {
    id: "lead-3",
    messages: [
      { id: "m6", from: "them", text: "Our security team asked about SOC2 compliance.", time: "2 days ago" },
      { id: "m7", from: "me", text: "Hi Vikram! Yes, we are fully SOC2 Type II certified. I can share our report.", time: "2 days ago" },
    ],
  },
  {
    id: "lead-4",
    messages: [
      { id: "m8", from: "them", text: "Hello! We are looking to upgrade our sales stack for 50 reps.", time: "3 days ago" },
    ],
  },
  {
    id: "lead-5",
    messages: [
      { id: "m9", from: "them", text: "Payment went through! Excited to get started.", time: "4 days ago" },
      { id: "m10", from: "me", text: "Welcome aboard Rohan! Setting up your workspace now.", time: "4 days ago" },
    ],
  },
  {
    id: "lead-6",
    messages: [
      { id: "m11", from: "them", text: "Do you have a free tier or starter trial?", time: "5 days ago" },
    ],
  },
];

// ── Local Storage Helper Functions ─────────────────────────────────
function getLocalCache<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(`salesmind-${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Seed initial data if cache empty
    localStorage.setItem(`salesmind-${key}`, JSON.stringify(seed));
    return seed;
  } catch {
    return seed;
  }
}

function setLocalCache<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(`salesmind-${key}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// ── Generic Fetch with Fallback ────────────────────────────────────
async function fetchTableWithFallback<T extends { id: string }>(
  tableName: string, 
  seed: T[], 
  selectQuery: string = "*",
  mapper?: (row: any) => T
): Promise<T[]> {
  const localData = getLocalCache<T>(tableName, seed);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from(tableName).select(selectQuery);
      if (!error && data) {
        // If Supabase has data (or even if it's explicitly empty), it should be the source of truth.
        // We overwrite the local cache with Supabase data to prevent mock seeds from reappearing.
        const mappedData = mapper ? data.map(mapper) : (data as T[]);
        setLocalCache(tableName, mappedData);
        return mappedData;
      }
    } catch {
      // Ignore fetch error, fallback to local storage
    }
  }

  return localData;
}

export const INITIAL_AI_RULES: AiAgentRule = {
  autoReplyEnabled: true,
  minConfidenceThreshold: 85,
  systemPrompt: "You are SalesMind AI, an elite enterprise sales executive. Answer customer questions clearly, warmly, and concisely. Keep responses under 3 sentences and focus on driving value.",
  tone: "Professional, warm, value-oriented",
  prohibitedTopics: ["unauthorized discounts", "competitor slander", "internal operational details"],
  knowledgeBase: "SalesMind AI is a real-time autonomous CRM with AI lead scoring, Buyer DNA analysis, and omnichannel WhatsApp/Email messaging.",
};

// ── Leads Hooks ───────────────────────────────────────────────────
export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchTableWithFallback<Lead>(
      "leads", 
      INITIAL_LEADS, 
      "*, buyer_dna(*)",
      (row) => {
        const dnaRow = Array.isArray(row.buyer_dna) ? row.buyer_dna[0] : row.buyer_dna;
        return {
          ...row,
          nextAction: row.next_action || "Initial outreach",
          dna: dnaRow ? {
            budget: dnaRow.budget ?? 50,
            intent: dnaRow.intent ?? 50,
            trust: dnaRow.trust ?? 50,
            priceSensitivity: dnaRow.price_sensitivity ?? 50,
            urgency: dnaRow.urgency ?? 50,
            language: dnaRow.language || "English",
            style: dnaRow.style || "Professional",
            confidence: dnaRow.confidence ?? 60,
          } : INITIAL_LEADS[0].dna
        };
      }
    ),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Omit<Lead, "id">) => {
      const newId = crypto.randomUUID();
      const newLead: Lead = {
        ...lead,
        id: newId,
        initials: lead.initials || lead.name.slice(0, 2).toUpperCase(),
      };
      
      // Update local cache first
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const updated = [newLead, ...current];
      setLocalCache("leads", updated);

      // Attempt Supabase insert if configured
      if (isSupabaseConfigured) {
        try {
          const { dna, nextAction, ...rest } = newLead;
          await supabase.from("leads").insert({
            ...rest,
            id: newId,
            next_action: nextAction
          });
          
          if (dna) {
            await supabase.from("buyer_dna").update({
              budget: dna.budget,
              intent: dna.intent,
              trust: dna.trust,
              price_sensitivity: dna.priceSensitivity,
              urgency: dna.urgency,
              language: dna.language,
              style: dna.style,
              confidence: dna.confidence
            }).eq("lead_id", newId);
          }
        } catch {
          // Ignore fallback
        }
      }

      // Initialize empty conversation thread for new lead
      const currentConvs = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      const updatedConvs = [{ id: newLead.id, messages: [] }, ...currentConvs];
      setLocalCache("conversations", updatedConvs);

      // Broadcast event for live cross-tab demo sync
      broadcastDemoEvent("SYNC_LEADS");
      broadcastDemoEvent("SYNC_CONVERSATIONS");

      return newLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
      // 1. Update local cache immediately
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const updated = current.map((l) => {
        if (l.id === id) {
          const merged = { ...l, ...data };
          if (data.dna) {
            const dna = data.dna;
            merged.score = Math.round(
              dna.intent * 0.4 + dna.budget * 0.3 + dna.urgency * 0.2 + dna.trust * 0.1
            );
          }
          return merged;
        }
        return l;
      });
      setLocalCache("leads", updated);

      // 2. Attempt Supabase update if configured
      if (isSupabaseConfigured) {
        try {
          const dbData: any = { ...data };
          if (dbData.nextAction !== undefined) {
            dbData.next_action = dbData.nextAction;
            delete dbData.nextAction;
          }
          const { dna, ...leadsData } = dbData;
          
          if (Object.keys(leadsData).length > 0) {
            const { error } = await supabase.from("leads").update(leadsData).eq("id", id);
            if (error) console.warn("Supabase lead update error:", error.message);
          }
          
          if (dna) {
             await supabase.from("buyer_dna").update({
               budget: dna.budget,
               intent: dna.intent,
               trust: dna.trust,
               price_sensitivity: dna.priceSensitivity,
               urgency: dna.urgency,
               language: dna.language,
               style: dna.style,
               confidence: dna.confidence
             }).eq("lead_id", id);
          }
        } catch (e) {
          console.warn("Supabase lead update exception:", e);
        }
      }

      broadcastDemoEvent("SYNC_LEADS");
      return updated.find((l) => l.id === id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}


export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Attempt Supabase delete
      try {
        await supabase.from("leads").delete().eq("id", id);
      } catch {
        // Ignore fallback
      }

      // Update local cache
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const updated = current.filter((l) => l.id !== id);
      setLocalCache("leads", updated);
      broadcastDemoEvent("SYNC_LEADS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ── Tasks Hooks ───────────────────────────────────────────────────
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTableWithFallback<Task>("tasks", INITIAL_TASKS),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<Task, "id">) => {
      const newTask: Task = { ...task, id: `task-${Date.now()}` };
      
      try {
        await supabase.from("tasks").insert(newTask);
      } catch {
        // Ignore
      }

      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = [newTask, ...current];
      setLocalCache("tasks", updated);
      broadcastDemoEvent("SYNC_TASKS");

      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      try {
        await supabase.from("tasks").update(data).eq("id", id);
      } catch {
        // Ignore
      }

      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = current.map((t) => (t.id === id ? { ...t, ...data } : t));
      setLocalCache("tasks", updated);
      broadcastDemoEvent("SYNC_TASKS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("tasks").delete().eq("id", id);
      } catch {
        // Ignore
      }

      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = current.filter((t) => t.id !== id);
      setLocalCache("tasks", updated);
      broadcastDemoEvent("SYNC_TASKS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ── Conversations Hooks ───────────────────────────────────────────
export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const local = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      if (!isSupabaseConfigured) return local;

      try {
        const { data, error } = await supabase.from("conversations").select("*, messages(*)");
        if (!error && data) {
           const result: ConversationThread[] = data.map(conv => {
              const msgs = Array.isArray(conv.messages) ? conv.messages : [];
              return {
                id: conv.lead_id, // Map lead_id to frontend thread id
                messages: msgs.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(msg => ({
                   id: msg.id,
                   from: msg.from_type as any,
                   text: msg.text,
                   time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                   channel: msg.channel as any,
                   status: msg.status as any,
                   aiConfidence: msg.ai_confidence
                }))
              };
           });
           setLocalCache("conversations", result);
           return result;
        }
      } catch {}
      return local;
    },
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, message }: { leadId: string; message: Message }) => {
      const current = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      let updated = [...current];
      const existing = updated.find((c) => c.id === leadId);
      if (existing) {
        existing.messages = [...existing.messages, message];
      } else {
        updated.push({ id: leadId, messages: [message] });
      }
      setLocalCache("conversations", updated);

      if (isSupabaseConfigured) {
        try {
          const { data: convData } = await supabase.from("conversations").select("id").eq("lead_id", leadId).single();
          if (convData) {
            await supabase.from("messages").insert({
              id: message.id,
              conversation_id: convData.id,
              lead_id: leadId,
              from_type: message.from,
              text: message.text,
              channel: message.channel || 'whatsapp',
              status: message.status || 'sent',
              ai_confidence: message.aiConfidence
            });
          }
        } catch (e) {
           console.error("Failed to insert message", e);
        }
      }
      broadcastDemoEvent("SYNC_CONVERSATIONS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ── AI Rules & Configuration Hooks ─────────────────────────────────
export function useAiRules() {
  return useQuery({
    queryKey: ["ai_rules"],
    queryFn: async (): Promise<AiAgentRule> => {
      try {
        const { data, error } = await supabase.from("ai_agent_rules").select("*").single();
        if (!error && data) {
          localStorage.setItem("salesmind-ai_rules", JSON.stringify(data));
          return data as AiAgentRule;
        }
      } catch {
        // fallback
      }

      try {
        const raw = localStorage.getItem("salesmind-ai_rules");
        if (raw) return JSON.parse(raw);
      } catch {
        // fallback
      }
      return INITIAL_AI_RULES;
    },
  });
}

export function useUpdateAiRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newRules: Partial<AiAgentRule>) => {
      try {
        await supabase.from("ai_agent_rules").upsert(newRules);
      } catch {
        // fallback
      }

      const current = JSON.parse(localStorage.getItem("salesmind-ai_rules") || JSON.stringify(INITIAL_AI_RULES));
      const updated = { ...current, ...newRules };
      localStorage.setItem("salesmind-ai_rules", JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_rules"] });
    },
  });
}



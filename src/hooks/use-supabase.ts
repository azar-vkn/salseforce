import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { type Lead, type Task, type ConversationThread, type Message, type AiAgentRule, type CallRecord, type CallAutopilotSettings } from "@/lib/types";
import { broadcastDemoEvent } from "./use-realtime";

// ── Initial Seed Data ──────────────────────────────────────────────
export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_CONVERSATIONS: ConversationThread[] = [];

export const INITIAL_AI_RULES: AiAgentRule = {
  autoReplyEnabled: true,
  minConfidenceThreshold: 85,
  systemPrompt: "You are SalesMind AI, an elite enterprise sales executive. Answer customer questions clearly, warmly, and concisely. Keep responses under 3 sentences and focus on driving value.",
  tone: "Professional, warm, value-oriented",
  prohibitedTopics: ["unauthorized discounts", "competitor slander", "internal operational details"],
  knowledgeBase: "SalesMind AI is a real-time autonomous CRM with AI lead scoring, Buyer DNA analysis, and omnichannel WhatsApp/Email messaging.",
};

// ── Lead Sanitizers for Supabase PostgreSQL Schema ─────────────────
function sanitizeLeadForSupabase(lead: Partial<Lead>) {
  const { phone, whatsapp, email, dna, createdAt, updatedAt, ...rest } = lead as any;
  const existingDna = typeof dna === "object" && dna !== null ? dna : {};
  
  return {
    ...rest,
    ...(phone || whatsapp || email || dna ? {
      dna: {
        ...existingDna,
        ...(phone !== undefined ? { phone } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        ...(email !== undefined ? { email } : {}),
      }
    } : {}),
  };
}

function parseLeadFromSupabase(dbLead: any): Lead {
  const dna = dbLead.dna || {};
  const phone = dbLead.phone || dna.phone || (/^\+?\d{8,}$/.test((dbLead.value || "").trim()) ? dbLead.value.trim() : undefined);
  const whatsapp = dbLead.whatsapp || dna.whatsapp || phone;
  const email = dbLead.email || dna.email;

  const rawValue = (dbLead.value || "").trim();
  const valueIsPhone = /^\+?\d{7,}$/.test(rawValue);
  const value = valueIsPhone || !rawValue ? "₹0" : rawValue;

  return {
    id: dbLead.id,
    name: dbLead.name || "Unnamed Lead",
    company: dbLead.company || "Company",
    initials: dbLead.initials || (dbLead.name ? dbLead.name.slice(0, 2).toUpperCase() : "LD"),
    score: Number(dbLead.score) || 50,
    stage: dbLead.stage || "New",
    nextAction: dbLead.nextAction || "Follow up",
    emotion: dbLead.emotion || "Neutral",
    status: dbLead.status || "Unread",
    value,
    phone,
    whatsapp,
    email,
    dna: {
      budget: dna.budget ?? 70,
      intent: dna.intent ?? 75,
      trust: dna.trust ?? 70,
      priceSensitivity: dna.priceSensitivity ?? 50,
      urgency: dna.urgency ?? 70,
      language: dna.language ?? "English",
      style: dna.style ?? "Direct",
      confidence: dna.confidence ?? 80,
    },
  };
}

// ── Local Storage Helper Functions ─────────────────────────────────
function getLocalCache<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(`salesmind-${key}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
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
        const mappedData = mapper ? data.map(mapper) : (data as unknown as T[]);
        setLocalCache(tableName, mappedData);
        return mappedData;
      }
    } catch {
      // Ignore fetch error, fallback to local storage
    }
  }

  return localData;
}



// ── Leads Hooks ───────────────────────────────────────────────────
export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Lead[]> => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("leads").select("*, buyer_dna(*)");
          if (!error && data && data.length > 0) {
            const parsedLeads = data.map((row: any) => {
              const base = parseLeadFromSupabase(row);
              const dnaRow = Array.isArray(row.buyer_dna) ? row.buyer_dna[0] : row.buyer_dna;
              if (dnaRow) {
                base.dna = {
                  budget: dnaRow.budget ?? base.dna.budget,
                  intent: dnaRow.intent ?? base.dna.intent,
                  trust: dnaRow.trust ?? base.dna.trust,
                  priceSensitivity: dnaRow.price_sensitivity ?? base.dna.priceSensitivity,
                  urgency: dnaRow.urgency ?? base.dna.urgency,
                  language: dnaRow.language || base.dna.language,
                  style: dnaRow.style || base.dna.style,
                  confidence: dnaRow.confidence ?? base.dna.confidence,
                };
              }
              return base;
            });
            setLocalCache("leads", parsedLeads);
            return parsedLeads;
          }
        } catch (e) {
          console.warn("Supabase fetch leads error:", e);
        }
      }
      return getLocalCache<Lead>("leads", INITIAL_LEADS);
    },
    refetchInterval: 1000,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Omit<Lead, "id">) => {
      const id = crypto.randomUUID();
      const newLead: Lead = {
        ...lead,
        id,
        initials: lead.initials || lead.name.slice(0, 2).toUpperCase(),
        value: lead.value || "₹0",
      };
      
      // Update local cache & React Query state immediately
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const updated = [newLead, ...current];
      setLocalCache("leads", updated);
      queryClient.setQueryData(["leads"], updated);

      const currentConvs = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      const updatedConvs = [{ id: newLead.id, messages: [] }, ...currentConvs];
      setLocalCache("conversations", updatedConvs);
      queryClient.setQueryData(["conversations"], updatedConvs);

      // Async background Supabase sync
      if (isSupabaseConfigured) {
        try {
          const payload = sanitizeLeadForSupabase(newLead);
          await supabase.from("leads").insert({ ...payload, id });
          await supabase.from("conversations").upsert({ id: newLead.id, lead_id: newLead.id, messages: [] });
          if (newLead.dna) {
            await supabase.from("buyer_dna").insert({
              lead_id: id,
              budget: newLead.dna.budget,
              intent: newLead.dna.intent,
              trust: newLead.dna.trust,
              price_sensitivity: newLead.dna.priceSensitivity,
              urgency: newLead.dna.urgency,
              language: newLead.dna.language,
              style: newLead.dna.style,
              confidence: newLead.dna.confidence
            });
          }
        } catch (e) {
          console.error("Supabase create lead error:", e);
        }
      }

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
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const existing = current.find((l) => l.id === id) || INITIAL_LEADS[0];
      const mergedLead: Lead = { ...existing, ...data };
      
      if (data.dna) {
        const dna = data.dna;
        mergedLead.score = Math.round(
          dna.intent * 0.4 + dna.budget * 0.3 + dna.urgency * 0.2 + dna.trust * 0.1
        );
      }

      const updated = current.map((l) => (l.id === id ? mergedLead : l));
      setLocalCache("leads", updated);
      queryClient.setQueryData(["leads"], updated);

      if (isSupabaseConfigured) {
        try {
          const payload = sanitizeLeadForSupabase(mergedLead);
          await supabase.from("leads").upsert({ ...payload, id });
          if (data.dna) {
            await supabase.from("buyer_dna").update({
              budget: data.dna.budget,
              intent: data.dna.intent,
              trust: data.dna.trust,
              price_sensitivity: data.dna.priceSensitivity,
              urgency: data.dna.urgency,
              language: data.dna.language,
              style: data.dna.style,
              confidence: data.dna.confidence
            }).eq("lead_id", id);
          }
        } catch (e) {
          console.error("Supabase update lead error:", e);
        }
      }

      broadcastDemoEvent("SYNC_LEADS");
      return mergedLead;
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
      // Immediate local state update for zero lag
      const current = getLocalCache<Lead>("leads", INITIAL_LEADS);
      const updated = current.filter((l) => l.id !== id);
      setLocalCache("leads", updated);
      queryClient.setQueryData(["leads"], updated);

      const currentConvs = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      const updatedConvs = currentConvs.filter((c) => c.id !== id);
      setLocalCache("conversations", updatedConvs);
      queryClient.setQueryData(["conversations"], updatedConvs);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("leads").delete().eq("id", id);
          await supabase.from("conversations").delete().eq("id", id);
        } catch (e) {
          console.error("Supabase delete lead error:", e);
        }
      }

      broadcastDemoEvent("SYNC_LEADS");
      broadcastDemoEvent("SYNC_CONVERSATIONS");
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
    queryFn: async (): Promise<Task[]> => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("tasks").select("*");
          if (!error && data && data.length > 0) {
            setLocalCache("tasks", data as Task[]);
            return data as Task[];
          }
        } catch {
          // fallback
        }
      }
      return getLocalCache<Task>("tasks", INITIAL_TASKS);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<Task, "id">) => {
      const newTask: Task = { ...task, id: crypto.randomUUID() };
      
      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = [newTask, ...current];
      setLocalCache("tasks", updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("tasks").insert(newTask);
        } catch (e) {
          console.error("Supabase create task error:", e);
        }
      }

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
      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = current.map((t) => (t.id === id ? { ...t, ...data } : t));
      setLocalCache("tasks", updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("tasks").update(data).eq("id", id);
        } catch (e) {
          console.error("Supabase update task error:", e);
        }
      }

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
      const current = getLocalCache<Task>("tasks", INITIAL_TASKS);
      const updated = current.filter((t) => t.id !== id);
      setLocalCache("tasks", updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("tasks").delete().eq("id", id);
        } catch (e) {
          console.error("Supabase delete task error:", e);
        }
      }

      broadcastDemoEvent("SYNC_TASKS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ── Conversations Hooks ───────────────────────────────────────────
function sanitizeThreadMessages(threads: ConversationThread[]): ConversationThread[] {
  return threads.map((t) => ({
    ...t,
    messages: (t.messages || []).map((m) => {
      if (m.text && m.text.includes("received your query and will follow up shortly")) {
        return {
          ...m,
          text: "Our Growth plan starts at ₹4,999/month per seat, and our Pro Website Development package is ₹50,000 (includes 15–30 days delivery and 3 months support). We also offer a 20% savings on annual billing commitments!",
        };
      }
      return m;
    }),
  }));
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConversationThread[]> => {
      const local = sanitizeThreadMessages(getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS));
      if (!isSupabaseConfigured) return local;

      try {
        const { data, error } = await supabase.from("conversations").select("*, messages(*)");
        if (!error && data && data.length > 0) {
           const result: ConversationThread[] = data.map((conv: any) => {
              const msgs = Array.isArray(conv.messages) ? conv.messages : [];
              return {
                id: conv.lead_id || conv.id,
                messages: msgs.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()).map((msg: any) => ({
                   id: msg.id || crypto.randomUUID(),
                   from: msg.from_type || msg.from,
                   text: msg.text || msg.content || "",
                   time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.time || "Just now"),
                   channel: msg.channel || "whatsapp",
                   status: msg.status || "sent",
                   aiConfidence: msg.ai_confidence ?? msg.aiConfidence
                }))
              };
           });
           const sanitized = sanitizeThreadMessages(result);
           setLocalCache("conversations", sanitized);
           return sanitized;
        } else {
           const { data: dbConversations } = await supabase.from("conversations").select("*");
           if (dbConversations && dbConversations.length > 0 && Array.isArray(dbConversations[0].messages)) {
             const sanitized = sanitizeThreadMessages(dbConversations as ConversationThread[]);
             setLocalCache("conversations", sanitized);
             return sanitized;
           }
        }
      } catch {}
      return local;
    },
    refetchInterval: 1000,
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
      queryClient.setQueryData(["conversations"], updated);

      if (isSupabaseConfigured) {
        try {
          const thread = updated.find((c) => c.id === leadId);
          if (thread) {
            await supabase.from("conversations").upsert({ id: leadId, lead_id: leadId, messages: thread.messages });
          }

          const { data: convData } = await supabase.from("conversations").select("id").eq("lead_id", leadId).maybeSingle();
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
      return updated.find((c) => c.id === leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const addMessage = useAddMessage();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ConversationThread> }) => {
      const current = getLocalCache<ConversationThread>("conversations", INITIAL_CONVERSATIONS);
      const existing = current.find((c) => c.id === id);
      let updated: ConversationThread[];
      if (existing) {
        updated = current.map((c) => (c.id === id ? { ...c, ...data } : c));
      } else {
        updated = [...current, { id, messages: data.messages ?? [] }];
      }
      setLocalCache("conversations", updated);
      queryClient.setQueryData(["conversations"], updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("conversations").upsert({ id, lead_id: id, messages: data.messages });
        } catch {}
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
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("ai_agent_rules").select("*").single();
          if (!error && data) {
            localStorage.setItem("salesmind-ai_rules", JSON.stringify(data));
            return data as AiAgentRule;
          }
        } catch {
          // fallback
        }
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
      if (isSupabaseConfigured) {
        try {
          await supabase.from("ai_agent_rules").upsert(newRules);
        } catch {
          // fallback
        }
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

export function useClearAllLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      setLocalCache("leads", []);
      setLocalCache("conversations", []);
      setLocalCache("tasks", []);
      if (isSupabaseConfigured) {
        try {
          await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          await supabase.from("conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        } catch (e) {
          console.error("Supabase clear error:", e);
        }
      }
      broadcastDemoEvent("SYNC_LEADS");
      broadcastDemoEvent("SYNC_CONVERSATIONS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ── Call Autopilot Hooks ───────────────────────────────────────────
export const DEFAULT_CALL_SETTINGS: CallAutopilotSettings = {
  enabled: true,
  incomingEnabled: true,
  identifyCustomers: true,
  loadBuyerDna: true,
  loadActiveDeals: true,
  askQualification: true,
  updateBuyerDna: true,
  generateSummary: true,
  createFollowUp: true,
  outboundEnabled: true,
  dealFollowUp: true,
  dealConfirmation: true,
  leadQualification: true,
  appointmentConfirmation: true,
  usePreviousConversations: true,
  useBuyerDna: true,
  useDealInformation: true,
  detectObjections: true,
  detectPurchaseIntent: true,
  detectRequirements: true,
  recommendNextAction: true,
  transferOnCustomerRequest: true,
  transferOnLowConfidence: true,
  minConfidenceThreshold: 75,
  transferOnComplexNegotiation: true,
  transferOnFrustration: true,
  storeTranscript: true,
  storeSummary: true,
  storeAnalysis: true,
  storeRecordingMetadata: true,
  aiDisclosure: true,
  callRecordingNotice: true,
  recordingEnabled: true,
  retentionDays: 30,
  provider: "mock",
};

export function useCallSettings() {
  return useQuery({
    queryKey: ["call_settings"],
    queryFn: async (): Promise<CallAutopilotSettings> => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("call_settings").select("*").single();
          if (!error && data) {
            localStorage.setItem("salesmind-call_settings", JSON.stringify(data));
            return data as CallAutopilotSettings;
          }
        } catch {
          // fallback
        }
      }

      try {
        const raw = localStorage.getItem("salesmind-call_settings");
        if (raw) return JSON.parse(raw);
      } catch {
        // fallback
      }
      return DEFAULT_CALL_SETTINGS;
    },
  });
}

export function useUpdateCallSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newSettings: Partial<CallAutopilotSettings>) => {
      const current = JSON.parse(localStorage.getItem("salesmind-call_settings") || JSON.stringify(DEFAULT_CALL_SETTINGS));
      const updated: CallAutopilotSettings = { ...current, ...newSettings };
      localStorage.setItem("salesmind-call_settings", JSON.stringify(updated));
      queryClient.setQueryData(["call_settings"], updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("call_settings").upsert(updated);
        } catch {
          // fallback
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call_settings"] });
    },
  });
}

export function useCalls() {
  return useQuery({
    queryKey: ["calls"],
    queryFn: async (): Promise<CallRecord[]> => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("calls").select("*").order("createdAt", { ascending: false });
          if (!error && data) {
            setLocalCache("calls", data as CallRecord[]);
            return data as CallRecord[];
          }
        } catch {
          // fallback
        }
      }
      return getLocalCache<CallRecord>("calls", []);
    },
  });
}

export function useAddCallRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: CallRecord) => {
      const current = getLocalCache<CallRecord>("calls", []);
      const updated = [record, ...current.filter((c) => c.id !== record.id)];
      setLocalCache("calls", updated);
      queryClient.setQueryData(["calls"], updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("calls").upsert(record);
        } catch (e) {
          console.error("Supabase call insert error:", e);
        }
      }

      broadcastDemoEvent("SYNC_CALLS");
      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

export function useClearCalls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      setLocalCache("calls", []);
      queryClient.setQueryData(["calls"], []);
      if (isSupabaseConfigured) {
        try {
          await supabase.from("calls").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        } catch (e) {
          console.error("Supabase clear calls error:", e);
        }
      }
      broadcastDemoEvent("SYNC_CALLS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { type Message, type RealtimePresenceState } from "@/lib/types";
import { toast } from "sonner";

// Cross-tab broadcast channel for offline & demo mode
const demoBroadcastChannel = typeof window !== "undefined" && "BroadcastChannel" in window
  ? new BroadcastChannel("salesmind-realtime-demo")
  : null;

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // 1. Live Supabase Realtime Setup
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel("crm-realtime-global")
        // Listen to Lead changes
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "leads" },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            if (payload.eventType === "INSERT") {
              const newLead = payload.new as { name?: string; company?: string };
              toast.info(`🔔 New Lead Ingested: ${newLead.name || "Lead"} (${newLead.company || "Company"})`);
            }
          }
        )
        // Listen to Conversation & Message changes
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            if (payload.new && (payload.new as any).messages) {
              const msgs = (payload.new as any).messages;
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && (lastMsg.from === "them" || lastMsg.from_type === "them")) {
                toast.info(`💬 Incoming WhatsApp: "${(lastMsg.text || "").slice(0, 40)}..."`);
              }
            }
          }
        )
        // Listen to Task changes
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tasks" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // 2. Cross-tab Realtime fallback for Demo / Local Mode
    if (demoBroadcastChannel) {
      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data || {};
        if (type === "SYNC_LEADS") {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        } else if (type === "SYNC_CONVERSATIONS") {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (payload?.incoming) {
            toast.info(`💬 Incoming query: "${(payload.text || "").slice(0, 40)}..."`);
          }
        } else if (type === "SYNC_TASKS") {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        } else if (type === "SYNC_CALLS") {
          queryClient.invalidateQueries({ queryKey: ["calls"] });
        }
      };

      demoBroadcastChannel.addEventListener("message", handleMessage);
      return () => {
        demoBroadcastChannel.removeEventListener("message", handleMessage);
      };
    }
  }, [queryClient, user]);
}

// Utility to broadcast demo changes cross-tab
export function broadcastDemoEvent(
  type:
    | "SYNC_LEADS"
    | "SYNC_CONVERSATIONS"
    | "SYNC_TASKS"
    | "SYNC_CALLS"
    | "SYNC_KNOWLEDGE"
    | "SYNC_DOCUMENTS"
    | "SYNC_RULES"
    | "SYNC_UNKNOWN",
  payload?: Record<string, unknown>
) {
  if (demoBroadcastChannel) {
    try {
      demoBroadcastChannel.postMessage({ type, payload });
    } catch {
      // Ignore broadcast errors
    }
  }
}


// Realtime typing & presence indicator
export function useRealtimePresence(activeLeadId?: string | null) {
  const { user } = useAuth();
  const [activeUsers, setActiveUsers] = useState<RealtimePresenceState[]>([
    {
      userId: "demo-user-1",
      userName: "Alex Sales (You)",
      lastActive: "Now",
    },
    {
      userId: "demo-user-2",
      userName: "Priya Sharma (AI Agent)",
      lastActive: "Active now",
    },
  ]);
  const [typingUsers, setTypingUsers] = useState<{ [leadId: string]: string[] }>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeLeadId) return;

      if (demoBroadcastChannel) {
        demoBroadcastChannel.postMessage({
          type: "TYPING_STATUS",
          payload: {
            leadId: activeLeadId,
            userName: user?.user_metadata?.full_name || "Sales Rep",
            isTyping,
          },
        });
      }
    },
    [activeLeadId, user]
  );

  useEffect(() => {
    if (demoBroadcastChannel) {
      const handlePresenceMsg = (event: MessageEvent) => {
        const { type, payload } = event.data || {};
        if (type === "TYPING_STATUS" && payload?.leadId) {
          setTypingUsers((prev) => {
            const currentList = prev[payload.leadId] || [];
            if (payload.isTyping && !currentList.includes(payload.userName)) {
              return { ...prev, [payload.leadId]: [...currentList, payload.userName] };
            } else if (!payload.isTyping) {
              return { ...prev, [payload.leadId]: currentList.filter((u) => u !== payload.userName) };
            }
            return prev;
          });
        }
      };

      demoBroadcastChannel.addEventListener("message", handlePresenceMsg);
      return () => {
        demoBroadcastChannel.removeEventListener("message", handlePresenceMsg);
      };
    }
  }, []);

  return {
    activeUsers,
    typingUsers: activeLeadId ? typingUsers[activeLeadId] || [] : [],
    sendTyping,
  };
}

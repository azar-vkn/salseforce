import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type Lead, type Task, type ConversationThread } from "@/lib/types";

// ---------------------------
// Generic Fetch Hook
// ---------------------------
async function fetchTable<T>(tableName: string): Promise<T[]> {
  const { data, error } = await supabase.from(tableName).select("*");
  if (error) {
    if (error.code === "PGRST205") {
      console.warn(`Table '${tableName}' not found. Returning empty array.`);
      return [];
    }
    console.error(`Error fetching ${tableName}:`, error);
    throw new Error(error.message);
  }
  return data as T[];
}

// ---------------------------
// Leads Hooks
// ---------------------------
export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchTable<Lead>("leads"),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Omit<Lead, "id">) => {
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...lead, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
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
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

// ---------------------------
// Tasks Hooks
// ---------------------------
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTable<Task>("tasks"),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<Task, "id">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
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
      const { error } = await supabase.from("tasks").update(data).eq("id", id);
      if (error) throw new Error(error.message);
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
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ---------------------------
// Conversations Hooks
// ---------------------------
export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchTable<ConversationThread>("conversations"),
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ConversationThread> }) => {
      const { error } = await supabase.from("conversations").update(data).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// @ts-nocheck
// Supabase Edge Function: Vapi Voice AI Webhook & Tool Execution Server
// Follows Deno edge runtime conventions for Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vapi-secret",
};

serve(async (req: Request) => {
  // Handle CORS preflight options
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate environment & initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const webhookSecret = Deno.env.get("VAPI_WEBHOOK_SECRET");

    if (webhookSecret) {
      const authHeader = req.headers.get("authorization") || req.headers.get("x-vapi-secret") || "";
      if (!authHeader.includes(webhookSecret)) {
        console.warn("Vapi Webhook Authorization failed.");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const message = body?.message || body;
    const messageType = message?.type;

    console.log(`[Vapi Webhook] Processing event type: ${messageType || "unknown"}`);

    // Helper: Normalize phone numbers to digits only
    const normalizePhone = (p?: string) => (p || "").replace(/\D/g, "");

    // Helper: Find lead by phone number
    async function findLeadByPhone(rawPhone?: string) {
      const digits = normalizePhone(rawPhone);
      if (!digits) return null;

      const { data: allLeads } = await supabase.from("leads").select("*, buyer_dna(*)");
      if (!allLeads) return null;

      return allLeads.find((l: any) => {
        const p1 = normalizePhone(l.phone);
        const p2 = normalizePhone(l.whatsapp);
        const dnaP = normalizePhone(l.dna?.phone || l.buyer_dna?.[0]?.phone);
        return (p1 && digits.endsWith(p1)) || (p2 && digits.endsWith(p2)) || (dnaP && digits.endsWith(dnaP)) || digits === p1 || digits === p2;
      }) || null;
    }

    // ─────────────────────────────────────────────────────────────────
    // A. HANDLE VAPI TOOL / FUNCTION CALLS
    // ─────────────────────────────────────────────────────────────────
    if (messageType === "tool-calls" || messageType === "function-call" || message?.toolCalls || message?.functionCall) {
      const toolCalls = message?.toolCalls || (message?.functionCall ? [{ id: "call_1", function: message.functionCall }] : []);
      const results = [];

      for (const toolCall of toolCalls) {
        const fnName = toolCall?.function?.name || toolCall?.name;
        const rawArgs = toolCall?.function?.arguments || toolCall?.arguments || {};
        const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        const toolCallId = toolCall?.id;

        console.log(`[Vapi Tool Call] Invoking tool '${fnName}' with args:`, args);

        let resultData = {};

        // 1. Tool: find_customer
        if (fnName === "find_customer" || fnName === "search_customer") {
          const matchedLead = await findLeadByPhone(args?.phone || args?.phoneNumber || message?.call?.customer?.number);
          if (matchedLead) {
            resultData = {
              found: true,
              leadId: matchedLead.id,
              name: matchedLead.name,
              company: matchedLead.company,
              stage: matchedLead.stage,
              emotion: matchedLead.emotion,
              buyerDna: matchedLead.dna || matchedLead.buyer_dna?.[0] || {
                budget: 70,
                intent: 75,
                trust: 70,
                urgency: 70,
                language: "English",
              },
            };
          } else {
            resultData = { found: false, message: "No existing lead found for this phone number." };
          }
        }

        // 2. Tool: create_lead
        else if (fnName === "create_lead") {
          const rawPhone = args?.phone || args?.phoneNumber || message?.call?.customer?.number || "";
          const phoneDigits = normalizePhone(rawPhone);
          const newLeadId = crypto.randomUUID();

          const newLeadObj = {
            id: newLeadId,
            name: args?.name || `Voice Inquiry (+${phoneDigits.slice(-4) || "Call"})`,
            company: args?.company || "Inbound Voice Call",
            initials: (args?.name || "VC").slice(0, 2).toUpperCase(),
            score: Number(args?.score) || 75,
            stage: "New",
            nextAction: args?.requirement || args?.nextAction || "Follow up on Vapi AI voice call",
            emotion: (args?.emotion as any) || "Curious",
            status: "Unread",
            value: args?.budget ? `₹${args.budget.toLocaleString()}` : "₹0",
            phone: rawPhone,
            whatsapp: rawPhone,
            email: args?.email || undefined,
            dna: {
              budget: Number(args?.budget) || 70,
              intent: Number(args?.intent) || 80,
              trust: 70,
              priceSensitivity: 50,
              urgency: Number(args?.urgency) || 70,
              language: args?.language || "English",
              style: "Voice Call Inbound",
              confidence: 80,
            },
          };

          const { data: insertedLead, error: leadErr } = await supabase.from("leads").insert(newLeadObj).select().single();
          if (leadErr) {
            console.error("[Vapi Webhook] Error creating lead:", leadErr);
          }

          // Insert Buyer DNA row if table exists
          await supabase.from("buyer_dna").insert({
            lead_id: newLeadId,
            budget: newLeadObj.dna.budget,
            intent: newLeadObj.dna.intent,
            trust: newLeadObj.dna.trust,
            price_sensitivity: newLeadObj.dna.priceSensitivity,
            urgency: newLeadObj.dna.urgency,
            language: newLeadObj.dna.language,
            style: newLeadObj.dna.style,
            confidence: newLeadObj.dna.confidence,
          }).catch(() => {});

          // Initialize conversation thread
          await supabase.from("conversations").upsert({ id: newLeadId, lead_id: newLeadId, messages: [] }).catch(() => {});

          resultData = {
            success: true,
            leadId: newLeadId,
            name: newLeadObj.name,
            message: "Successfully created CRM Lead from Vapi Voice Call",
          };
        }

        // 3. Tool: update_customer
        else if (fnName === "update_customer" || fnName === "update_lead") {
          let targetLead = args?.leadId ? { id: args.leadId } : await findLeadByPhone(args?.phone || message?.call?.customer?.number);

          if (targetLead?.id) {
            const updates: any = {};
            if (args?.name) updates.name = args.name;
            if (args?.email) updates.email = args.email;
            if (args?.company) updates.company = args.company;
            if (args?.nextAction || args?.requirement) updates.nextAction = args.nextAction || args.requirement;
            if (args?.emotion) updates.emotion = args.emotion;
            if (args?.stage) updates.stage = args.stage;

            if (Object.keys(updates).length > 0) {
              await supabase.from("leads").update(updates).eq("id", targetLead.id);
            }

            if (args?.budget || args?.intent || args?.urgency) {
              const dnaUpdates: any = {};
              if (args?.budget) dnaUpdates.budget = Number(args.budget);
              if (args?.intent) dnaUpdates.intent = Number(args.intent);
              if (args?.urgency) dnaUpdates.urgency = Number(args.urgency);

              await supabase.from("buyer_dna").update(dnaUpdates).eq("lead_id", targetLead.id).catch(() => {});
            }

            resultData = { success: true, leadId: targetLead.id, message: "Updated customer CRM records successfully" };
          } else {
            resultData = { success: false, message: "Lead not found to update." };
          }
        }

        // Unknown tool fallback
        else {
          resultData = { success: true, message: `Tool ${fnName} acknowledged.` };
        }

        results.push({
          toolCallId,
          result: resultData,
        });
      }

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // B. HANDLE END OF CALL REPORT
    // ─────────────────────────────────────────────────────────────────
    if (messageType === "end-of-call-report" || messageType === "call-ended") {
      const callData = message?.call || {};
      const vapiCallId = callData?.id || message?.id || `vapi_${Date.now()}`;
      const customerPhone = callData?.customer?.number || message?.customer?.number || message?.phoneNumber || "";
      const direction = callData?.type === "outboundPhoneCall" ? "OUTBOUND" : "INBOUND";
      const duration = Math.round(callData?.durationSeconds || message?.durationSeconds || message?.duration || 0);
      const startedAt = callData?.createdAt || message?.createdAt || new Date().toISOString();
      const endedAt = callData?.endedAt || message?.endedAt || new Date().toISOString();
      const transcript = message?.transcript || callData?.transcript || (Array.isArray(message?.messages) ? message.messages.map((m: any) => `${m.role || m.speaker}: ${m.message || m.text}`).join("\n") : "");
      const summary = message?.summary || message?.analysis?.summary || callData?.summary || "Vapi AI Voice Call completed.";
      const recordingUrl = message?.recordingUrl || callData?.recordingUrl || message?.stereoRecordingUrl || "";
      const status = callData?.endedReason === "customer-ended-call" || callData?.endedReason === "assistant-ended-call" ? "COMPLETED" : "COMPLETED";

      // Match lead or auto-create
      let matchedLead = await findLeadByPhone(customerPhone);
      let leadId = matchedLead?.id;

      if (!matchedLead && customerPhone) {
        const phoneDigits = normalizePhone(customerPhone);
        const newLeadId = crypto.randomUUID();
        const newLeadObj = {
          id: newLeadId,
          name: `Voice Call (+${phoneDigits.slice(-4) || "Customer"})`,
          company: "Inbound Vapi Call",
          initials: "VC",
          score: 70,
          stage: "New",
          nextAction: "Review Vapi call transcript",
          emotion: "Curious",
          status: "Unread",
          value: "₹0",
          phone: customerPhone,
          whatsapp: customerPhone,
          dna: {
            budget: 70,
            intent: 75,
            trust: 70,
            priceSensitivity: 50,
            urgency: 70,
            language: "English",
            style: "Voice Call Inbound",
            confidence: 75,
          },
        };

        const { data: createdLead } = await supabase.from("leads").insert(newLeadObj).select().single();
        if (createdLead) leadId = createdLead.id;
      }

      // Construct Call Record
      const callRecord = {
        id: `call_${vapiCallId.replace(/\W/g, "_")}`,
        lead_id: leadId || "",
        leadId: leadId || "",
        direction,
        status,
        started_at: startedAt,
        ended_at: endedAt,
        startedAt,
        endedAt,
        duration,
        provider: "vapi",
        provider_call_id: vapiCallId,
        providerCallId: vapiCallId,
        recording_url: recordingUrl,
        recordingUrl,
        transcript,
        summary,
        humanHandoff: false,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Idempotent upsert into calls table
      const { error: callErr } = await supabase.from("calls").upsert(callRecord, { onConflict: "id" });
      if (callErr) {
        console.error("[Vapi Webhook] Error persisting call record:", callErr);
      } else {
        console.log(`[Vapi Webhook] Call record successfully saved for callId: ${vapiCallId}`);
      }

      // Update lead Buyer DNA if analysis / structured data returned by Vapi
      const structuredData = message?.analysis?.structuredData || {};
      if (leadId && (structuredData.intent || structuredData.budget || structuredData.urgency || summary)) {
        const dnaUpdates: any = {};
        if (structuredData.intent) dnaUpdates.intent = Number(structuredData.intent);
        if (structuredData.budget) dnaUpdates.budget = Number(structuredData.budget);
        if (structuredData.urgency) dnaUpdates.urgency = Number(structuredData.urgency);

        await supabase.from("buyer_dna").update(dnaUpdates).eq("lead_id", leadId).catch(() => {});
        await supabase.from("leads").update({ status: "Unread", nextAction: summary.slice(0, 100) }).eq("id", leadId).catch(() => {});
      }

      return new Response(JSON.stringify({ status: "success", callId: vapiCallId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default response for other Vapi lifecycle events (status-update, call-started, etc.)
    return new Response(JSON.stringify({ status: "acknowledged", type: messageType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    console.error("[Vapi Webhook] Execution error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

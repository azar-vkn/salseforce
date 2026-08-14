// @ts-nocheck
// Supabase Edge Function: bolna-webhook
// Receives Bolna AI webhook callbacks (call status updates, transcripts,
// structured extraction results) and updates the `calls` table in real time.
// Also creates/updates leads and schedules follow-up tasks from extracted data.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Environment & Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Parse the webhook payload
    const payload = await req.json();

    // Log raw payload for debugging — essential for verifying Bolna's exact field names
    console.log(
      `[bolna-webhook] Raw payload received:`,
      JSON.stringify(payload)
    );

    // 3. Extract key fields from Bolna webhook
    // ⚠️ VERIFY: Bolna webhooks match on `id` field (the execution ID)
    const bolnaExecutionId = payload.id;

    if (!bolnaExecutionId) {
      console.warn(
        `[bolna-webhook] No 'id' field in payload. Skipping. Keys: ${Object.keys(payload).join(", ")}`
      );
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ⚠️ VERIFY: Phone numbers are nested under telephony_data
    const telephonyData = payload.telephony_data || {};
    const toNumber = telephonyData.to_number || null;
    const fromNumber = telephonyData.from_number || null;
    const recordingUrl = telephonyData.recording_url || null;

    // Status: scheduled → queued → in-progress → completed
    const callStatus = payload.status || null;
    const transcript = payload.transcript || null;
    const summary = payload.summary || null;

    // ⚠️ VERIFY: Bolna does NOT have a generic `extracted_data` field.
    // Structured extraction fields appear as their own top-level keys in the payload.
    // We collect everything that isn't a known Bolna system field into extracted_data.
    const KNOWN_BOLNA_FIELDS = new Set([
      "id",
      "status",
      "transcript",
      "summary",
      "telephony_data",
      "agent_id",
      "created_at",
      "updated_at",
      "duration",
      "recording_url",
    ]);
    const extractedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!KNOWN_BOLNA_FIELDS.has(key)) {
        extractedData[key] = value;
      }
    }
    const hasExtractedData = Object.keys(extractedData).length > 0;

    console.log(
      `[bolna-webhook] Execution ID: ${bolnaExecutionId}, Status: ${callStatus}, Has extraction: ${hasExtractedData}`
    );

    // 4. Find matching call record
    const { data: existingCall, error: findError } = await supabase
      .from("calls")
      .select("*")
      .eq("bolna_execution_id", bolnaExecutionId)
      .maybeSingle();

    if (findError) {
      console.error(
        `[bolna-webhook] Error finding call record:`,
        JSON.stringify(findError)
      );
    }

    // 5. Build update payload for calls table
    const callUpdate: Record<string, any> = {};
    if (callStatus) callUpdate.status = callStatus;
    if (transcript) callUpdate.transcript = transcript;
    if (summary) callUpdate.summary = summary;
    if (recordingUrl) callUpdate.recording_url = recordingUrl;
    if (hasExtractedData) {
      // Merge with existing extracted_data if any
      callUpdate.extracted_data = {
        ...(existingCall?.extracted_data || {}),
        ...extractedData,
      };
    }

    if (existingCall) {
      // Update existing call record
      const { error: updateError } = await supabase
        .from("calls")
        .update(callUpdate)
        .eq("bolna_execution_id", bolnaExecutionId);

      if (updateError) {
        console.error(
          `[bolna-webhook] Error updating call:`,
          JSON.stringify(updateError)
        );
      } else {
        console.log(
          `[bolna-webhook] Updated call ${existingCall.id} with status: ${callStatus}`
        );
      }
    } else {
      // No matching call found — likely an inbound call. Create one.
      const direction = fromNumber ? "inbound" : "outbound";
      const newCall = {
        bolna_execution_id: bolnaExecutionId,
        direction,
        status: callStatus || "initiated",
        transcript,
        summary,
        recording_url: recordingUrl,
        extracted_data: hasExtractedData ? extractedData : null,
      };

      const { data: insertedCall, error: insertError } = await supabase
        .from("calls")
        .insert(newCall)
        .select()
        .single();

      if (insertError) {
        console.error(
          `[bolna-webhook] Error inserting new call:`,
          JSON.stringify(insertError)
        );
      } else {
        console.log(
          `[bolna-webhook] Created new ${direction} call record: ${insertedCall.id}`
        );
      }
    }

    // 6. Post-completion processing
    if (callStatus === "completed" && hasExtractedData) {
      const leadId = existingCall?.lead_id || null;

      // 6a. If call has a lead_id, update the lead from extracted data
      if (leadId) {
        const leadUpdate: Record<string, any> = {};

        // ⚠️ VERIFY: These field names depend on YOUR Bolna extraction schema.
        // Update these keys once you configure extractions in the Bolna dashboard.
        if (extractedData.customer_name) leadUpdate.name = extractedData.customer_name;
        if (extractedData.lead_status) leadUpdate.status = extractedData.lead_status;
        if (extractedData.notes) leadUpdate.next_action = extractedData.notes;

        if (Object.keys(leadUpdate).length > 0) {
          const { error: leadUpdateError } = await supabase
            .from("leads")
            .update(leadUpdate)
            .eq("id", leadId);

          if (leadUpdateError) {
            console.error(
              `[bolna-webhook] Error updating lead ${leadId}:`,
              JSON.stringify(leadUpdateError)
            );
          } else {
            console.log(
              `[bolna-webhook] Updated lead ${leadId} with extracted data`
            );
          }
        }
      }

      // 6b. If no lead_id (inbound call), create a new lead
      if (!leadId && fromNumber) {
        const newLeadName =
          extractedData.customer_name || `Caller ${fromNumber}`;
        const newLeadCompany =
          extractedData.company || "Unknown Company";

        // Look up any org to attach the lead to — use the first org available
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id")
          .limit(1);
        const orgId = orgs?.[0]?.id || null;

        if (orgId) {
          const { data: newLead, error: newLeadError } = await supabase
            .from("leads")
            .insert({
              org_id: orgId,
              name: newLeadName,
              company: newLeadCompany,
              phone: fromNumber,
              whatsapp: fromNumber,
              stage: "New",
              status: "Unread",
              emotion: "Neutral",
              score: 50,
              value: "₹0",
            })
            .select()
            .single();

          if (newLeadError) {
            console.error(
              `[bolna-webhook] Error creating lead from inbound call:`,
              JSON.stringify(newLeadError)
            );
          } else {
            console.log(
              `[bolna-webhook] Created new lead ${newLead.id} from inbound call`
            );

            // Link the call to the new lead
            await supabase
              .from("calls")
              .update({ lead_id: newLead.id })
              .eq("bolna_execution_id", bolnaExecutionId);
          }
        }
      }

      // 6c. If extracted data includes a preferred slot / booking time, create a call_task
      // ⚠️ VERIFY: These field names depend on YOUR Bolna extraction schema.
      const preferredSlot =
        extractedData.preferred_slot ||
        extractedData.booking_time ||
        extractedData.appointment_time ||
        null;

      if (preferredSlot) {
        const taskLeadId = leadId || existingCall?.lead_id || null;

        if (taskLeadId) {
          const { error: taskError } = await supabase
            .from("call_tasks")
            .insert({
              lead_id: taskLeadId,
              type: "booking",
              due_at: preferredSlot,
            });

          if (taskError) {
            console.error(
              `[bolna-webhook] Error creating call task:`,
              JSON.stringify(taskError)
            );
          } else {
            console.log(
              `[bolna-webhook] Created booking task for lead ${taskLeadId} at ${preferredSlot}`
            );
          }
        }
      }
    }

    // 7. Return 200 OK
    return new Response(JSON.stringify({ received: true, success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[bolna-webhook] Unexpected error:`, err);
    // Always return 200 to prevent Bolna from retrying
    return new Response(
      JSON.stringify({ received: true, error: String(err) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

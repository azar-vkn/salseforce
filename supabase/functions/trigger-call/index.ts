// @ts-nocheck
// Supabase Edge Function: trigger-call
// Triggers an outbound Bolna AI voice call to a lead's phone number.
// Accepts POST { lead_id, phone_number }
// Calls Bolna's outbound call API and inserts a tracking row into the `calls` table.

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
    const bolnaApiKey = Deno.env.get("BOLNA_API_KEY") ?? "";
    const bolnaAgentId = Deno.env.get("BOLNA_AGENT_ID") ?? "";

    if (!bolnaApiKey || !bolnaAgentId) {
      console.error("[trigger-call] Missing BOLNA_API_KEY or BOLNA_AGENT_ID");
      return new Response(
        JSON.stringify({
          error: "Server misconfigured: missing Bolna credentials",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Parse request body
    const body = await req.json();
    const { action = "trigger", lead_id, phone_number, execution_id, call_id } = body;

    // ── Handle Stop / Cancel Call Action ──────────────────────
    if (action === "stop" || action === "cancel") {
      console.log(`[trigger-call] Stopping call execution ${execution_id || call_id}`);
      if (execution_id) {
        try {
          await fetch(`https://api.bolna.ai/call/${execution_id}/stop`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bolnaApiKey}`,
              "Content-Type": "application/json",
            },
          });
        } catch (e) {
          console.warn("[trigger-call] Error stopping Bolna call:", e);
        }
      }
      if (call_id) {
        await supabase
          .from("calls")
          .update({ status: "failed", summary: "Call cancelled by user" })
          .eq("id", call_id);
      }
      return new Response(
        JSON.stringify({ success: true, message: "Call stopped successfully" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Handle Purge All Queued Calls Action ─────────────────
    if (action === "purge_all") {
      console.log("[trigger-call] Purging all active/queued Bolna calls...");
      let stoppedCount = 0;
      try {
        const res = await fetch(`https://api.bolna.ai/agent/${bolnaAgentId}/executions`, {
          headers: { Authorization: `Bearer ${bolnaApiKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          const active = data.filter((e: any) =>
            ["queued", "scheduled", "rescheduled", "in-progress", "ringing"].includes(e.status)
          );
          for (const e of active) {
            try {
              await fetch(`https://api.bolna.ai/call/${e.id}/stop`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${bolnaApiKey}`,
                  "Content-Type": "application/json",
                },
              });
              stoppedCount++;
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[trigger-call] Error querying Bolna for purge:", e);
      }

      await supabase
        .from("calls")
        .update({ status: "failed", summary: "Purged / Cancelled by user" })
        .in("status", ["initiated", "scheduled", "queued", "in-progress"]);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Purged and stopped ${stoppedCount} queued call(s)`,
          stoppedCount,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: "phone_number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize phone number to E.164 format (+country_code_number)
    let formattedPhone = phone_number.toString().trim().replace(/[\s\-()]/g, "");
    if (!formattedPhone.startsWith("+")) {
      // If 10 digits starting with 6/7/8/9, assume Indian mobile (+91)
      if (/^[6-9]\d{9}$/.test(formattedPhone)) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    console.log(
      `[trigger-call] Initiating outbound call to ${formattedPhone} (raw: ${phone_number}) for lead ${lead_id || "unknown"}`
    );

    // 3. Call Bolna's outbound call API
    const bolnaResponse = await fetch("https://api.bolna.ai/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bolnaApiKey}`,
      },
      body: JSON.stringify({
        agent_id: bolnaAgentId,
        recipient_phone_number: formattedPhone,
      }),
    });

    if (!bolnaResponse.ok) {
      const errorText = await bolnaResponse.text();
      let parsedMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMessage = parsed.message || parsed.error || errorText;
      } catch {}

      console.error(
        `[trigger-call] Bolna API error (${bolnaResponse.status}): ${errorText}`
      );
      return new Response(
        JSON.stringify({
          error: "Failed to initiate call via Bolna",
          details: parsedMessage,
        }),
        {
          status: bolnaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bolnaData = await bolnaResponse.json();

    // ⚠️ VERIFY: Bolna's response should return an `id` field as the execution ID.
    const bolnaExecutionId = bolnaData.id || bolnaData.execution_id;

    console.log(
      `[trigger-call] Bolna call initiated. Execution ID: ${bolnaExecutionId}`
    );
    console.log(
      `[trigger-call] Full Bolna response:`,
      JSON.stringify(bolnaData)
    );

    // 4. Insert call record into Supabase
    const callRecord = {
      lead_id: lead_id || null,
      bolna_execution_id: bolnaExecutionId,
      direction: "outbound",
      status: "initiated",
    };

    const { data: insertedCall, error: insertError } = await supabase
      .from("calls")
      .insert(callRecord)
      .select()
      .single();

    if (insertError) {
      console.error(
        `[trigger-call] Supabase insert error:`,
        JSON.stringify(insertError)
      );
      // Still return success since the Bolna call was initiated
      return new Response(
        JSON.stringify({
          success: true,
          bolna_execution_id: bolnaExecutionId,
          warning: "Call initiated but failed to save tracking record",
          error_detail: insertError.message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[trigger-call] Call record saved. ID: ${insertedCall.id}`
    );

    // 5. Return the created call record
    return new Response(JSON.stringify({ success: true, call: insertedCall }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[trigger-call] Unexpected error:`, err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

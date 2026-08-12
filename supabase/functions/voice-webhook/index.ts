// @ts-nocheck
// Follows Deno edge runtime conventions for Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { From, To, CallSid, event } = body;

    // 1. Fetch Call Autopilot Master Settings
    const { data: settingsData } = await supabase
      .from("call_settings")
      .select("*")
      .single();

    const masterEnabled = settingsData?.enabled ?? true;

    // 2. Check Master Switch
    if (!masterEnabled) {
      console.log("Call Autopilot Master Switch is OFF. Routing to normal human call flow.");
      return new Response(
        JSON.stringify({
          action: "ROUTE_HUMAN",
          message: "AI Call Autopilot disabled. Routing call to business human lines.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerPhone = (From || "").replace(/\D/g, "");

    // 3. Identify Customer from CRM
    const { data: leads } = await supabase.from("leads").select("*");
    const matchedLead = leads?.find((l) => {
      const p1 = (l.phone || "").replace(/\D/g, "");
      const p2 = (l.whatsapp || "").replace(/\D/g, "");
      return (p1 && callerPhone.endsWith(p1)) || (p2 && callerPhone.endsWith(p2));
    });

    let leadId = matchedLead?.id;

    // 4. Auto-create lead if unmatched & incoming configuration permits
    if (!matchedLead && settingsData?.incomingEnabled) {
      const newLeadId = crypto.randomUUID();
      const newLeadObj = {
        id: newLeadId,
        name: `Inbound Call (+${callerPhone || "Unknown"})`,
        company: "Inbound Phone Call",
        initials: "IC",
        score: 70,
        stage: "New",
        nextAction: "Review inbound AI call transcript",
        emotion: "Curious",
        status: "Unread",
        value: "₹0",
        phone: callerPhone,
        whatsapp: callerPhone,
        dna: {
          budget: 70,
          intent: 75,
          trust: 70,
          priceSensitivity: 50,
          urgency: 70,
          language: "English",
          style: "Voice Call Inbound",
          confidence: 70,
        },
      };

      const { data: createdLead } = await supabase
        .from("leads")
        .insert(newLeadObj)
        .select()
        .single();

      if (createdLead) leadId = createdLead.id;
    }

    // 5. Construct Initial Voice TwiML / Media Stream response
    const callRecord = {
      id: `call_in_${Date.now()}`,
      leadId: leadId || "",
      direction: "INBOUND",
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      duration: 0,
      provider: "twilio",
      providerCallId: CallSid || `sid_${Date.now()}`,
      humanHandoff: false,
      createdAt: new Date().toISOString(),
      summary: "Inbound AI Call initiated",
    };

    if (leadId) {
      await supabase.from("calls").insert(callRecord);
    }

    return new Response(
      JSON.stringify({
        action: "START_AI_VOICE_AGENT",
        callId: callRecord.id,
        leadId,
        leadName: matchedLead?.name || "Customer",
        dealValue: matchedLead?.value || "₹0",
        buyerDna: matchedLead?.dna || null,
        status: "ACTIVE",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Voice Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

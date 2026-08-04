// @ts-nocheck
// Supabase Edge Function for WhatsApp Cloud API & Twilio Inbound Webhook Automation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "salesmind_webhook_secret";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // 1. Meta Webhook Verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge || "ok", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Incoming WhatsApp Message Handling (POST)
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      // Extract message from Meta WhatsApp Cloud API payload
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (!message || message.type !== "text") {
        return new Response(JSON.stringify({ status: "ignored_non_text" }), { status: 200 });
      }

      const senderPhone = message.from;
      const senderName = contact?.profile?.name || "WhatsApp Lead";
      const messageText = message.text?.body || "";

      // Find or create lead in Supabase
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("phone", senderPhone)
        .maybeSingle();

      let lead = existingLead;

      if (!lead) {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            name: senderName,
            phone: senderPhone,
            company: "Inbound Prospect",
            stage: "New",
            status: "Unread",
            value: "₹2.5L",
            emotion: "Curious",
            score: 70,
            next_action: "Send welcome intro deck",
          })
          .select()
          .single();
        lead = newLead;
      }

      // Fetch the actual conversation thread for this lead
      const { data: convData } = await supabase.from("conversations").select("id").eq("lead_id", lead?.id).maybeSingle();

      // Append incoming message to messages table
      if (lead && convData) {
        await supabase.from("messages").insert({
          conversation_id: convData.id,
          lead_id: lead.id,
          from_type: "them",
          text: messageText,
          channel: "whatsapp",
          status: "read",
        });
      }

      // Generate Autonomous AI Reply
      let aiReply = "Thank you for reaching out to SalesMind AI! Our solutions team will review your query and share a customized walkthrough shortly.";

      if (GEMINI_API_KEY) {
        try {
          const prompt = `You are an elite enterprise AI Sales Representative for SalesMind AI. Lead: ${senderName}. Inbound Query: "${messageText}". Respond in max 2-3 warm, professional, high-converting sentences.`;
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

          const geminiRes = await fetch(geminiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
            }),
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedText) {
              aiReply = generatedText;
            }
          }
        } catch (e) {
          console.error("Gemini Edge execution failed:", e);
        }
      }

      // Save AI reply in Supabase
      if (lead && convData) {
        await supabase.from("messages").insert({
          conversation_id: convData.id,
          lead_id: lead.id,
          from_type: "ai_agent",
          text: aiReply,
          channel: "whatsapp",
          status: "sent",
          ai_confidence: 92,
        });
      }

      // Dispatch Outbound Message to Meta WhatsApp API if token configured
      const phoneNumberId = change?.metadata?.phone_number_id;
      if (WHATSAPP_ACCESS_TOKEN && phoneNumberId) {
        await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: senderPhone,
            type: "text",
            text: {
              body: aiReply,
            },
          }),
        });
      }

      return new Response(JSON.stringify({ status: "success", reply: aiReply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

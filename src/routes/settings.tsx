import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAiRules, useUpdateAiRules } from "@/hooks/use-supabase";
import { inspectWhatsAppAccount, sendWhatsAppTextMessage, type WhatsAppInspectionResult } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Database, Key, Webhook, Bot, Shield, CheckCircle2, Copy, Send, Loader2, AlertCircle, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Enterprise Settings & Webhooks — SalesMind AI" },
      { name: "description", content: "Configure organization profile, Supabase Realtime credentials, WhatsApp webhooks, and AI rules." },
      { property: "og:title", content: "Settings — SalesMind AI" },
      { property: "og:description", content: "Configure organization profile, Supabase Realtime credentials, WhatsApp webhooks, and AI rules." },
    ],
  }),
  component: SettingsPage,
});

function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // Ignore
    }
  };

  return [storedValue, setValue];
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-background/60 focus:ring-primary/40 mt-1.5 h-11 w-full rounded-[18px] px-4 text-xs sm:text-sm outline-none focus:ring-2 border border-border/60"
      />
    </label>
  );
}

function Toggle({ id, label, hint, defaultChecked = true }: { id: string; label: string; hint: string; defaultChecked?: boolean }) {
  const [on, setOn] = useLocalStorage(`salesmind-settings-${id}`, defaultChecked);
  return (
    <button
      onClick={() => {
        setOn((v) => !v);
        toast.info(`${label} set to ${!on ? "Enabled" : "Disabled"}`);
      }}
      className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs sm:text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 shadow-xs",
            on ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const [name, setName] = useLocalStorage("salesmind-settings-name", "Alex Sales");
  const [email, setEmail] = useLocalStorage("salesmind-settings-email", "alex@enterprise-crm.com");
  const [company, setCompany] = useLocalStorage("salesmind-settings-company", "TechVision Global");
  const [webhookSecret] = useState(() => "whsec_" + Math.random().toString(36).slice(2, 14));

  const [whatsappToken, setWhatsappToken] = useLocalStorage("salesmind-whatsapp-token", "");
  const [whatsappPhoneId, setWhatsappPhoneId] = useLocalStorage("salesmind-whatsapp-phone-id", "");
  const [whatsappWabaId, setWhatsappWabaId] = useLocalStorage("salesmind-whatsapp-waba-id", "");
  const [webhookVerifyToken, setWebhookVerifyToken] = useLocalStorage("salesmind-webhook-verify-token", "salesmind_verify_token_2026");

  const [testingConnection, setTestingConnection] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<WhatsAppInspectionResult | null>(null);
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [sendingTestMessage, setSendingTestMessage] = useState(false);

  const { data: aiRules } = useAiRules();
  const updateAiRulesMutation = useUpdateAiRules();
  const [knowledgeBase, setKnowledgeBase] = useState(aiRules?.knowledgeBase || "SalesMind AI real-time sales intelligence platform.");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const testWhatsAppConnection = async () => {
    if (!whatsappToken) {
      toast.error("Please enter a WhatsApp Access Token first.");
      return;
    }
    setTestingConnection(true);
    try {
      const result = await inspectWhatsAppAccount(whatsappPhoneId, whatsappToken, whatsappWabaId);
      setInspectionResult(result);

      if (result.isValid && result.phoneDetails) {
        toast.success(
          `Connected! Sender Phone: ${result.phoneDetails.displayPhoneNumber || result.phoneDetails.id} (${result.phoneDetails.verifiedName || "Verified"})`
        );
      } else if (result.isWabaIdInstead) {
        toast.warning(
          `Detected WhatsApp Business Account ID instead of Phone Number ID! Found ${result.discoveredPhoneNumbers?.length || 0} phone numbers.`
        );
      } else if (result.isTokenExpired) {
        toast.error("Meta WhatsApp Access Token has expired. Please provide a fresh token.");
      } else if (result.error) {
        toast.error(result.diagnosticAdvice || result.error);
      }
    } catch {
      toast.error("Could not reach Meta Graph API. Please verify your internet connection.");
    } finally {
      setTestingConnection(false);
    }
  };

  const sendTestWhatsAppMessage = async () => {
    if (!testRecipientPhone.trim()) {
      toast.warning("Please enter a recipient phone number with country code (e.g. 919876543210).");
      return;
    }
    setSendingTestMessage(true);
    try {
      const res = await sendWhatsAppTextMessage({
        to: testRecipientPhone.trim(),
        body: "🧪 Test message from SalesMind AI WhatsApp Hub! Your Meta Cloud API integration is successfully active.",
        phoneId: whatsappPhoneId,
        accessToken: whatsappToken,
      });

      if (res.success) {
        toast.success(`🎉 Test WhatsApp message dispatched to +${testRecipientPhone.replace(/\D/g, "")}!`);
      } else {
        toast.error(res.error || "Failed to deliver test message");
      }
    } finally {
      setSendingTestMessage(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Enterprise Settings & Infrastructure</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Multi-tenant organization controls, Meta WhatsApp Cloud API integration, Supabase Realtime status, and AI knowledge boundaries.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Organization & Profile */}
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <SectionTitle title="Organization & Profile" />
            <div className="space-y-3">
              <Field label="Full Name" value={name} onChange={setName} />
              <Field label="Work Email" value={email} onChange={setEmail} />
              <Field label="Organization / Workspace Name" value={company} onChange={setCompany} />
              <Island onClick={() => toast.success("Organization profile saved successfully")}>
                Save Workspace Profile
              </Island>
            </div>

            <div className="border-t border-border/60 pt-4">
              <SectionTitle title="Live Database & Realtime Status" />
              <div className="mt-3 flex items-center justify-between glass rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <span className="text-xs font-semibold block">
                      {isSupabaseConfigured ? "Connected to Supabase PostgreSQL" : "Local Realtime Broadcast Engine"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isSupabaseConfigured ? "Live WAL Realtime Subscriptions & RLS active" : "Multi-tab sub-second sync active via BroadcastChannel"}
                    </span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  ONLINE
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Meta WhatsApp Cloud API Credentials */}
          <GlassCard delay={80} className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle title="Meta WhatsApp Cloud API Setup" />
              <Webhook className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enter your credentials from <strong className="text-foreground">developers.facebook.com → WhatsApp → API Setup</strong> to send live WhatsApp messages.
            </p>

            {/* Diagnostic Alert Banner */}
            {inspectionResult && (
              <div className={cn(
                "rounded-xl p-3 text-xs border space-y-2",
                inspectionResult.isValid && inspectionResult.phoneDetails
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : inspectionResult.isWabaIdInstead
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              )}>
                <div className="flex items-start gap-2">
                  {inspectionResult.isValid && inspectionResult.phoneDetails ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-semibold block">
                      {inspectionResult.isValid && inspectionResult.phoneDetails
                        ? `Meta Cloud API Connected (${inspectionResult.phoneDetails.displayPhoneNumber || "Active"})`
                        : inspectionResult.isWabaIdInstead
                        ? "WABA ID Detected Instead of Phone Number ID"
                        : inspectionResult.isTokenExpired
                        ? "Access Token Expired"
                        : "Configuration Issue"}
                    </span>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {inspectionResult.diagnosticAdvice || inspectionResult.error}
                    </p>
                  </div>
                </div>

                {/* Discovered Phone Numbers List */}
                {inspectionResult.discoveredPhoneNumbers && inspectionResult.discoveredPhoneNumbers.length > 0 && (
                  <div className="mt-2 space-y-1.5 pt-2 border-t border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-200 block uppercase tracking-wide">
                      Available Phone Numbers Under this WABA:
                    </span>
                    {inspectionResult.discoveredPhoneNumbers.map((pn) => (
                      <div
                        key={pn.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-background/50 p-2 rounded-lg border border-amber-500/30"
                      >
                        <div className="text-[11px]">
                          <strong className="text-foreground">+{pn.displayPhoneNumber}</strong>
                          <span className="text-muted-foreground ml-1.5">({pn.verifiedName || "Phone Node"})</span>
                          <span className="block text-[10px] font-mono text-muted-foreground">ID: {pn.id}</span>
                        </div>
                        <button
                          onClick={() => {
                            setWhatsappWabaId(whatsappPhoneId); // save previous as WABA
                            setWhatsappPhoneId(pn.id); // set real phone ID
                            toast.success(`Selected Phone Number ID: ${pn.id}`);
                            testWhatsAppConnection();
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer"
                        >
                          Use this Phone ID
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <Field
                label="WhatsApp System User Access Token"
                value={whatsappToken}
                onChange={setWhatsappToken}
                placeholder="EAATHf..."
                type="password"
              />
              <Field
                label="Phone Number ID (Step 1 'Phone number ID' in Meta API Setup)"
                value={whatsappPhoneId}
                onChange={setWhatsappPhoneId}
                placeholder="e.g. 615852441616853"
              />
              <Field
                label="WhatsApp Business Account ID (WABA ID)"
                value={whatsappWabaId}
                onChange={setWhatsappWabaId}
                placeholder="e.g. 1276074385581968"
              />

              {/* Helpful ID Distinction Note */}
              <div className="bg-muted/40 rounded-xl p-2.5 border border-border/50 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 font-semibold text-foreground text-[11px]">
                  <HelpCircle className="h-3 w-3 text-primary" />
                  <span>Important: Phone Number ID vs. WABA ID</span>
                </div>
                <p>
                  • <strong>Phone Number ID</strong>: The specific 15-digit numerical ID for the sender phone number. Required for sending messages.
                </p>
                <p>
                  • <strong>WABA ID</strong>: The business container ID. If you enter this as the Phone Number ID, Meta returns <em>"Unsupported post request / Object ID does not exist"</em>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => toast.success("WhatsApp credentials saved to your workspace session.")}
                  className="bg-primary text-primary-foreground text-xs px-3.5 py-2 rounded-xl font-semibold hover:bg-primary/90 transition cursor-pointer"
                >
                  Save Credentials
                </button>
                <button
                  onClick={testWhatsAppConnection}
                  disabled={testingConnection}
                  className="glass text-xs px-3.5 py-2 rounded-xl font-semibold hover:bg-muted transition flex items-center gap-1.5 cursor-pointer"
                >
                  {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-primary" />}
                  Test API Connection
                </button>
              </div>

              {/* Direct Test Message Sender */}
              <div className="border-t border-border/50 pt-2.5 space-y-2">
                <span className="text-[11px] font-semibold text-foreground block">
                  Send Test Outbound Message:
                </span>
                <div className="flex gap-2">
                  <input
                    value={testRecipientPhone}
                    onChange={(e) => setTestRecipientPhone(e.target.value)}
                    placeholder="Recipient phone (e.g. 918778948875)"
                    className="bg-background/60 text-xs px-3 py-1.5 rounded-xl border border-border/60 flex-1 outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={sendTestWhatsAppMessage}
                    disabled={sendingTestMessage}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    {sendingTestMessage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send Test
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Omnichannel Inbound Webhooks & AI Model Config */}
        <div className="space-y-4">
          {/* Omnichannel Ingestion Webhook */}
          <GlassCard delay={60} className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle title="Inbound Webhook Configuration" />
              <Webhook className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configure these exact endpoints in Meta Webhooks or Twilio to route incoming customer replies directly to the AI agent.
            </p>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px]">Meta Webhook Callback URL</span>
                <div className="flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-[11px] font-mono">
                  <span className="truncate flex-1">https://xwjbneqqhzoslyrbapdp.supabase.co/functions/v1/whatsapp-webhook</span>
                  <button
                    onClick={() => copyToClipboard("https://xwjbneqqhzoslyrbapdp.supabase.co/functions/v1/whatsapp-webhook", "Webhook URL")}
                    className="hover:text-primary transition p-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px]">Verify Token (Enter this into Meta Webhook Verify field)</span>
                <div className="flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-[11px] font-mono">
                  <span className="truncate flex-1">{webhookVerifyToken}</span>
                  <button
                    onClick={() => copyToClipboard(webhookVerifyToken, "Verify Token")}
                    className="hover:text-primary transition p-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* AI Knowledge Base */}
          <GlassCard delay={120} className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle title="AI Knowledge Base & Playbook" />
              <Bot className="h-4 w-4 text-primary" />
            </div>

            <textarea
              rows={3}
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder="Paste company pricing details, FAQ answers, SLA terms, and prohibited topics..."
              className="w-full bg-background/60 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary/40 border border-border/60"
            />

            <button
              onClick={() => {
                updateAiRulesMutation.mutate({ knowledgeBase });
                toast.success("AI Knowledge Base updated successfully");
              }}
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-xl px-3 py-1.5 text-xs font-semibold transition"
            >
              Update AI Playbook
            </button>
          </GlassCard>

          {/* Automation & Notification Toggles */}
          <GlassCard delay={180}>
            <SectionTitle title="Pipeline Automation" />
            <div className="divide-border/60 mt-1 divide-y">
              <Toggle id="auto-dna" label="Realtime Buyer DNA Extraction" hint="Extract intent and budget signals automatically from incoming messages" />
              <Toggle id="auto-score" label="Dynamic Lead Scoring" hint="Recalculate lead score instantly after each buyer interaction" />
              <Toggle id="hot-alerts" label="Hot Lead Instant Alerts" hint="Dispatch browser notification when a lead intent exceeds 85%" />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAiRules, useUpdateAiRules } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Database, Key, Webhook, Bot, Shield, CheckCircle2, Copy, Send, Loader2 } from "lucide-react";

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

  const { data: aiRules } = useAiRules();
  const updateAiRulesMutation = useUpdateAiRules();
  const [knowledgeBase, setKnowledgeBase] = useState(aiRules?.knowledgeBase || "SalesMind AI real-time sales intelligence platform.");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const testWhatsAppConnection = async () => {
    if (!whatsappToken || !whatsappPhoneId) {
      toast.error("Please enter both WhatsApp Access Token and Phone Number ID first.");
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}`, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
      });
      const data = await res.json();
      if (res.ok && data.id) {
        toast.success(`Connected to Meta WhatsApp Cloud API! Number: ${data.display_phone_number || data.verified_name || "Verified"}`);
      } else {
        toast.error(`Meta API Error: ${data.error?.message || "Invalid credentials"}`);
      }
    } catch {
      toast.error("Could not reach Meta Graph API. Please verify network/token.");
    } finally {
      setTestingConnection(false);
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
            <p className="text-[11px] text-muted-foreground">
              Enter your credentials from <strong className="text-foreground">developers.facebook.com → WhatsApp → API Setup</strong> to send live WhatsApp messages.
            </p>

            <div className="space-y-2.5">
              <Field
                label="WhatsApp System User Access Token"
                value={whatsappToken}
                onChange={setWhatsappToken}
                placeholder="EAA..."
                type="password"
              />
              <Field
                label="Phone Number ID"
                value={whatsappPhoneId}
                onChange={setWhatsappPhoneId}
                placeholder="e.g. 109283746501928"
              />
              <Field
                label="WhatsApp Business Account ID (WABA ID)"
                value={whatsappWabaId}
                onChange={setWhatsappWabaId}
                placeholder="e.g. 987654321098765"
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => toast.success("WhatsApp credentials saved to your workspace session.")}
                  className="bg-primary text-primary-foreground text-xs px-3.5 py-2 rounded-xl font-semibold hover:bg-primary/90 transition"
                >
                  Save Credentials
                </button>
                <button
                  onClick={testWhatsAppConnection}
                  disabled={testingConnection}
                  className="glass text-xs px-3.5 py-2 rounded-xl font-semibold hover:bg-muted transition flex items-center gap-1.5"
                >
                  {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-primary" />}
                  Test API Connection
                </button>
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

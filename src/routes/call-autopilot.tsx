import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Bot,
  UserCheck,
  ShieldAlert,
  Mic,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Activity,
  Sparkles,
  RefreshCw,
  Server,
  Globe,
  Lock,
  Key,
  Layers,
  Flame,
} from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/glass";
import {
  useCallSettings,
  useUpdateCallSettings,
  useLeads,
  useCalls,
} from "@/hooks/use-supabase";
import {
  verifyVapiConnection,
  getVapiCredentials,
  type VapiDiagnosticResult,
} from "@/lib/call-autopilot/vapi-provider";
import {
  verifyTelephonyCredentials,
  getTelephonyCredentials,
} from "@/lib/call-autopilot/twilio-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/call-autopilot")({
  head: () => ({
    meta: [
      { title: "Call Autopilot Setup & Control — SalesMind AI" },
      { name: "description", content: "Production Telephony setup, Realtime Voice AI configuration, and Human Handoff rules." },
      { property: "og:title", content: "Call Autopilot Setup & Control — SalesMind AI" },
    ],
  }),
  component: CallAutopilotPage,
});

function CallAutopilotPage() {
  const { data: settings } = useCallSettings();
  const updateSettingsMutation = useUpdateCallSettings();
  const { data: leads = [] } = useLeads();
  const { data: calls = [] } = useCalls();

  const activeSettings = settings || {
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
    provider: "vapi" as const,
    phoneNumber: "+918778948875",
    accountId: "",
  };

  // ── Connection Diagnostic State ─────────────────────────────────
  const [vapiDiag, setVapiDiag] = useState<VapiDiagnosticResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Form Fields
  const [providerChoice, setProviderChoice] = useState<"vapi" | "twilio">(activeSettings.provider === "twilio" ? "twilio" : "vapi");
  const [businessPhone, setBusinessPhone] = useState(activeSettings.phoneNumber || "+918778948875");
  const [humanTransferPhone, setHumanTransferPhone] = useState("+919876543210");
  const [aiVoice, setAiVoice] = useState("Vapi Realtime · Alloy (Natural English)");
  const [aiGreeting, setAiGreeting] = useState("Hello! You've reached SalesMind AI. How can I help you with your inquiry today?");

  const runDiagnostic = async () => {
    setIsTestingConnection(true);
    try {
      if (providerChoice === "vapi") {
        const res = await verifyVapiConnection();
        setVapiDiag(res);
        if (res.vapiConnected) {
          toast.success("✅ Vapi Realtime Voice API Connection Verified ($10 Free Tier Active)!");
        } else {
          toast.warning(res.statusMessage);
        }
      } else {
        const res = await verifyTelephonyCredentials();
        if (res.telephonyConnected) {
          toast.success("✅ Twilio REST Telephony Connection Verified!");
        } else {
          toast.warning(res.statusMessage);
        }
      }
    } catch (e: any) {
      toast.error(`Diagnostic error: ${e.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, [providerChoice]);

  const toggleMaster = () => {
    const nextState = !activeSettings.enabled;
    updateSettingsMutation.mutate(
      { enabled: nextState },
      {
        onSuccess: () => {
          toast.success(`Call Autopilot Master Switch set to ${nextState ? "ON (AI Active)" : "OFF (Human Line Only)"}`);
        },
      }
    );
  };

  const toggleSetting = (key: keyof typeof activeSettings) => {
    const nextVal = !activeSettings[key];
    updateSettingsMutation.mutate({ [key]: nextVal });
  };

  const saveSetupConfig = () => {
    updateSettingsMutation.mutate({
      provider: providerChoice,
      phoneNumber: businessPhone,
    });
    toast.success("Call Autopilot Setup parameters saved.");
  };

  return (
    <div className="space-y-4">
      {/* Header & Master Switch */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#008069] text-white">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Call Autopilot Setup & Control</h1>
            <p className="text-xs text-muted-foreground">
              Production Telephony Orchestration, Realtime Voice AI, & Human Routing Rules
            </p>
          </div>
        </div>

        {/* Master Switch */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors",
              activeSettings.enabled
                ? "bg-[#008069]/10 text-[#008069] dark:text-[#25D366] border-[#008069]/30"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", activeSettings.enabled ? "bg-[#25D366] animate-pulse" : "bg-muted-foreground")} />
            <span>{activeSettings.enabled ? "● Call Autopilot Active" : "○ Call Autopilot Disabled"}</span>
          </div>

          <button
            onClick={toggleMaster}
            className={cn(
              "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              activeSettings.enabled ? "bg-[#008069]" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                activeSettings.enabled ? "translate-x-6" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </header>

      {/* Production Telephony Connection Diagnostics */}
      <GlassCard className="p-4 space-y-3 border-l-4 border-l-[#008069]">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-[#008069]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Production Connection Verification</h2>
          </div>

          <button
            onClick={runDiagnostic}
            disabled={isTestingConnection}
            className="flex items-center gap-1 bg-[#008069]/10 text-[#008069] hover:bg-[#008069]/20 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isTestingConnection && "animate-spin")} />
            <span>Test Voice Integration</span>
          </button>
        </div>

        {/* Diagnostic Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-muted p-2.5 rounded border border-border space-y-1">
            <span className="text-[10px] text-muted-foreground block">Selected Provider</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className={cn("h-2 w-2 rounded-full", vapiDiag?.vapiConnected ? "bg-[#25D366]" : "bg-amber-500")} />
              <span className="capitalize">{providerChoice === "vapi" ? "Vapi Voice API" : "Twilio Telephony"}</span>
            </div>
          </div>

          <div className="bg-muted p-2.5 rounded border border-border space-y-1">
            <span className="text-[10px] text-muted-foreground block">Business Phone Number</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className={cn("h-2 w-2 rounded-full", vapiDiag?.phoneNumberConfigured ? "bg-[#25D366]" : "bg-amber-500")} />
              <span>{businessPhone || "Unassigned"}</span>
            </div>
          </div>

          <div className="bg-muted p-2.5 rounded border border-border space-y-1">
            <span className="text-[10px] text-muted-foreground block">Developer Free Tier</span>
            <div className="flex items-center gap-1.5 font-bold text-[#008069] dark:text-[#25D366]">
              <Sparkles className="h-3 w-3" />
              <span>$10 Free Credits</span>
            </div>
          </div>

          <div className="bg-muted p-2.5 rounded border border-border space-y-1">
            <span className="text-[10px] text-muted-foreground block">Webhook Status</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className={cn("h-2 w-2 rounded-full", vapiDiag?.webhookVerified ? "bg-[#25D366]" : "bg-amber-500")} />
              <span>{vapiDiag?.webhookVerified ? "Verified Endpoint" : "Unverified"}</span>
            </div>
          </div>
        </div>

        {vapiDiag?.statusMessage && (
          <div className={cn("p-2.5 rounded text-xs leading-relaxed border", vapiDiag.vapiConnected ? "bg-[#008069]/10 text-[#008069] border-[#008069]/30" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30")}>
            <span className="font-bold">System Status:</span> {vapiDiag.statusMessage}
          </div>
        )}
      </GlassCard>

      {/* Main Settings Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left 2 Cols: Telephony & AI Configurations */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Sliders className="h-4 w-4 text-[#008069]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Telephony & Voice AI Setup</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-medium text-muted-foreground mb-1">Voice Provider Architecture</label>
                <select
                  value={providerChoice}
                  onChange={(e) => setProviderChoice(e.target.value as "vapi" | "twilio")}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs outline-none focus:border-[#008069]"
                >
                  <option value="vapi">Vapi Voice API (Recommended · $10 Free Developer Tier)</option>
                  <option value="twilio">Twilio Voice REST API (Direct Telephony Trunk)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-muted-foreground mb-1">Business Telephony Number</label>
                <input
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="e.g. +918778948875"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs outline-none focus:border-[#008069]"
                />
              </div>

              <div>
                <label className="block font-medium text-muted-foreground mb-1">Human Transfer Phone Number</label>
                <input
                  value={humanTransferPhone}
                  onChange={(e) => setHumanTransferPhone(e.target.value)}
                  placeholder="e.g. +919876543210"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs outline-none focus:border-[#008069]"
                />
              </div>

              <div>
                <label className="block font-medium text-muted-foreground mb-1">AI Voice Model & Accent</label>
                <select
                  value={aiVoice}
                  onChange={(e) => setAiVoice(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs outline-none focus:border-[#008069]"
                >
                  <option value="Vapi Realtime · Alloy (Natural English)">Vapi Realtime · Alloy (Natural English)</option>
                  <option value="Vapi Realtime · Echo (Professional)">Vapi Realtime · Echo (Professional)</option>
                  <option value="OpenAI Realtime · Shimmer">OpenAI Realtime · Shimmer</option>
                  <option value="Gemini Multimodal Voice · En-US">Gemini Multimodal Voice · En-US</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-muted-foreground mb-1">Initial AI Call Greeting Prompt</label>
                <textarea
                  rows={2}
                  value={aiGreeting}
                  onChange={(e) => setAiGreeting(e.target.value)}
                  className="w-full bg-background border border-border rounded p-2.5 text-xs outline-none focus:border-[#008069]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={saveSetupConfig}
                className="bg-[#008069] text-white px-4 py-1.5 rounded text-xs font-semibold shadow-xs hover:opacity-90 transition cursor-pointer"
              >
                Save Telephony Setup
              </button>
            </div>
          </GlassCard>

          {/* Rules & Handoff */}
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <PhoneIncoming className="h-4 w-4 text-[#008069]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Inbound AI Handling</h2>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { key: "incomingEnabled", label: "AI answers incoming business calls" },
                  { key: "identifyCustomers", label: "Identify existing CRM contacts" },
                  { key: "loadBuyerDna", label: "Load Buyer DNA before answering" },
                  { key: "loadActiveDeals", label: "Load active deal information" },
                  { key: "updateBuyerDna", label: "Update Buyer DNA from call intel" },
                  { key: "generateSummary", label: "Generate AI call summary" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between gap-2 cursor-pointer py-1">
                    <span className="text-muted-foreground">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(activeSettings[key as keyof typeof activeSettings])}
                      onChange={() => toggleSetting(key as keyof typeof activeSettings)}
                      className="accent-[#008069] h-3.5 w-3.5 rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <UserCheck className="h-4 w-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Human Handoff Rules</h2>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { key: "transferOnCustomerRequest", label: "Transfer when customer requests human" },
                  { key: "transferOnLowConfidence", label: "Transfer when AI confidence < threshold" },
                  { key: "transferOnComplexNegotiation", label: "Transfer for complex negotiations" },
                  { key: "transferOnFrustration", label: "Transfer when customer shows frustration" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between gap-2 cursor-pointer py-1">
                    <span className="text-muted-foreground">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(activeSettings[key as keyof typeof activeSettings])}
                      onChange={() => toggleSetting(key as keyof typeof activeSettings)}
                      className="accent-amber-500 h-3.5 w-3.5 rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Right Col: Production Environment Variables Guide */}
        <div className="space-y-4">
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Key className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Environment Variables Guide</h2>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Configure these variables in your <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">.env.local</code> file for live phone calling:
            </p>

            <div className="space-y-2 text-[11px] font-mono bg-muted p-3 rounded border border-border overflow-x-auto">
              <div className="text-[#008069] dark:text-[#25D366] font-bold"># Vapi Realtime Voice API (Recommended)</div>
              <div>VAPI_API_KEY="vapi_live_xxxx"</div>
              <div>VAPI_PHONE_NUMBER_ID="vapi_phone_xxxx"</div>
              <div>VAPI_ASSISTANT_ID="vapi_asst_xxxx"</div>
              <div className="text-purple-600 dark:text-purple-400 font-bold pt-1"># Twilio Fallback</div>
              <div>TELEPHONY_ACCOUNT_ID="ACxxxxxxxx"</div>
              <div>TELEPHONY_AUTH_TOKEN="xxxxxxxxxx"</div>
              <div>TELEPHONY_PHONE_NUMBER="+18005550199"</div>
              <div className="text-purple-600 dark:text-purple-400 font-bold pt-1"># Public Webhook Base URL</div>
              <div>PUBLIC_WEBHOOK_BASE_URL="https://crm.yourdomain.com"</div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Telephony Webhook Endpoint:
              </span>
              <code className="text-[10px] block font-mono bg-background/60 p-1 rounded">
                https://your-domain.com/webhooks/voice/incoming
              </code>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

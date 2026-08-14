import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, Island, SectionTitle } from "@/components/glass";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  useAiRules,
  useUpdateAiRules,
  useTeamMembers,
  useUpdateMemberRole,
  useInviteTeamMember,
  useRemoveTeamMember,
} from "@/hooks/use-supabase";
import { useAuth } from "@/contexts/auth-context";
import { RoleBadge, RoleGate } from "@/components/role-guard";
import { type UserRole, type UserProfile } from "@/lib/types";
import { inspectWhatsAppAccount, sendWhatsAppTextMessage, type WhatsAppInspectionResult } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Database,
  Key,
  Webhook,
  Bot,
  Shield,
  CheckCircle2,
  Copy,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Trash2,
  Lock,
  Sparkles,
} from "lucide-react";

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
    if (typeof window === "undefined") {
      return initialValue;
    }
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
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "bg-background/60 focus:ring-primary/40 mt-1.5 h-11 w-full rounded-[18px] px-4 text-xs sm:text-sm outline-none focus:ring-2 border border-border/60",
          disabled && "opacity-60 cursor-not-allowed bg-muted/30"
        )}
      />
    </label>
  );
}

function Toggle({
  id,
  label,
  hint,
  defaultChecked = true,
  disabled = false,
}: {
  id: string;
  label: string;
  hint: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const [on, setOn] = useLocalStorage(`salesmind-settings-${id}`, defaultChecked);
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setOn((v) => !v);
        toast.info(`${label} set to ${!on ? "Enabled" : "Disabled"}`);
      }}
      className={cn(
        "flex w-full items-center justify-between gap-4 py-2.5 text-left",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs sm:text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          on ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 shadow-xs",
            on ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const { role, isAdmin } = useAuth();
  const [name, setName] = useLocalStorage("salesmind-settings-name", "Azar Vkn");
  const [email, setEmail] = useLocalStorage("salesmind-settings-email", "azarvkn@gmail.com");
  const [company, setCompany] = useLocalStorage("salesmind-settings-company", "SalesMind Enterprise");
  const [whatsappToken, setWhatsappToken] = useLocalStorage(
    "salesmind-whatsapp-token",
    import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || ""
  );
  const [whatsappPhoneId, setWhatsappPhoneId] = useLocalStorage(
    "salesmind-whatsapp-phone-id",
    import.meta.env.VITE_WHATSAPP_PHONE_ID || "1276074385581968"
  );
  const [whatsappWabaId, setWhatsappWabaId] = useLocalStorage(
    "salesmind-whatsapp-waba-id",
    import.meta.env.VITE_WHATSAPP_WABA_ID || "1040585292058401"
  );
  const [webhookVerifyToken] = useLocalStorage("salesmind-webhook-verify-token", "salesmind_verify_token_2026");

  const [testingConnection, setTestingConnection] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<WhatsAppInspectionResult | null>(null);
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [sendingTestMessage, setSendingTestMessage] = useState(false);

  const { data: aiRules } = useAiRules();
  const updateAiRulesMutation = useUpdateAiRules();
  const [knowledgeBase, setKnowledgeBase] = useState(aiRules?.knowledgeBase || "SalesMind AI real-time sales intelligence platform.");

  // Team & Role Management Hooks
  const { data: teamMembers = [], isLoading: loadingTeam } = useTeamMembers();
  const updateMemberRoleMutation = useUpdateMemberRole();
  const inviteMemberMutation = useInviteTeamMember();
  const removeMemberMutation = useRemoveTeamMember();

  // Invite Modal / Form State
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UserRole>("salesperson");

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllUsers = () => {
    if (selectedUserIds.length === teamMembers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(teamMembers.map((m) => m.id));
    }
  };

  const handleBulkRoleAssign = (targetRole: UserRole) => {
    if (selectedUserIds.length === 0) {
      toast.warning("Please select at least one team member first.");
      return;
    }

    selectedUserIds.forEach((userId) => {
      updateMemberRoleMutation.mutate({ userId, newRole: targetRole });
    });

    toast.success(`Updated ${selectedUserIds.length} member(s) to ${targetRole.toUpperCase()}`);
    setSelectedUserIds([]);
  };

  const handleSingleRoleChange = (userId: string, newRole: UserRole, memberName: string) => {
    updateMemberRoleMutation.mutate({ userId, newRole });
    toast.success(`Changed role for ${memberName} to ${newRole.toUpperCase()}`);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast.error("Please fill in both name and email.");
      return;
    }

    inviteMemberMutation.mutate(
      {
        full_name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
      },
      {
        onSuccess: () => {
          toast.success(`Invited ${newMemberName} as ${newMemberRole.toUpperCase()}`);
          setNewMemberName("");
          setNewMemberEmail("");
          setNewMemberRole("salesperson");
          setShowInviteForm(false);
        },
      }
    );
  };

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
    <div className="space-y-6">
      {/* Header with Role Indicator */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Enterprise Settings</h1>
            <RoleBadge role={role} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Manage organization profile, team members & role permissions, Meta WhatsApp credentials, and AI automation.
          </p>
        </div>
      </header>

      {/* ── Team & Role Management Section ── */}
      <GlassCard className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Team Members & Role Assignment</h2>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Admins can assign, promote, or change roles (Admin / Salesperson) for single or multiple members."
                  : "View members in your organization. Contact an Administrator to request role adjustments."}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {showInviteForm ? "Cancel Invite" : "Invite Member"}
            </button>
          )}
        </div>

        {/* Invite Member Form (Admin Only) */}
        {isAdmin && showInviteForm && (
          <form onSubmit={handleInviteSubmit} className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Add New Team Member</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Full Name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="bg-background text-xs px-3 py-2 rounded-xl border border-border/60 outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="bg-background text-xs px-3 py-2 rounded-xl border border-border/60 outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                className="bg-background text-xs px-3 py-2 rounded-xl border border-border/60 outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="salesperson">Role: Salesperson (Limited)</option>
                <option value="admin">Role: Admin (Full Access)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteMemberMutation.isPending}
                className="bg-primary text-primary-foreground text-xs px-4 py-1.5 rounded-xl font-medium shadow-xs hover:bg-primary/90 transition flex items-center gap-1.5"
              >
                {inviteMemberMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Member
              </button>
            </div>
          </form>
        )}

        {/* Bulk Role Actions Toolbar (Admin Only) */}
        {isAdmin && selectedUserIds.length > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl p-2.5 px-3.5 text-xs animate-in fade-in duration-200">
            <span className="font-semibold text-primary">
              {selectedUserIds.length} member(s) selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Set Role To:</span>
              <button
                onClick={() => handleBulkRoleAssign("admin")}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition"
              >
                <ShieldCheck className="h-3 w-3" /> Make Admin
              </button>
              <button
                onClick={() => handleBulkRoleAssign("salesperson")}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition"
              >
                <UserCheck className="h-3 w-3" /> Make Salesperson
              </button>
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground font-medium">
                {isAdmin && (
                  <th className="py-2.5 px-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.length === teamMembers.length && teamMembers.length > 0}
                      onChange={selectAllUsers}
                      className="rounded border-border"
                    />
                  </th>
                )}
                <th className="py-2.5 px-3 text-left">Member</th>
                <th className="py-2.5 px-3 text-left">Email</th>
                <th className="py-2.5 px-3 text-left">Status</th>
                <th className="py-2.5 px-3 text-left">Assigned Role</th>
                {isAdmin && <th className="py-2.5 px-3 text-right">Role Assignment / Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loadingTeam ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-6 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-1" />
                    Loading team members...
                  </td>
                </tr>
              ) : teamMembers.map((member) => {
                const isSelected = selectedUserIds.includes(member.id);
                return (
                  <tr key={member.id} className={cn("hover:bg-muted/30 transition-colors", isSelected && "bg-primary/5")}>
                    {isAdmin && (
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          disabled={member.isPrimaryAdmin}
                          checked={isSelected}
                          onChange={() => toggleSelectUser(member.id)}
                          className="rounded border-border disabled:opacity-30"
                        />
                      </td>
                    )}
                    <td className="py-3 px-3 font-medium text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                        {member.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate block font-semibold">{member.full_name}</span>
                        {member.isPrimaryAdmin && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded-sm inline-block">
                            Primary Owner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">{member.email}</td>
                    <td className="py-3 px-3">
                      {member.status === "invited" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Signup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <RoleBadge role={member.role} size="sm" />
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-right">
                        {member.isPrimaryAdmin ? (
                          <span className="text-[11px] text-muted-foreground italic">Primary Admin</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleSingleRoleChange(member.id, e.target.value as UserRole, member.full_name)
                              }
                              className="bg-background/80 text-foreground border border-border/60 rounded-lg px-2 py-1 text-[11px] font-medium outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="admin">Admin</option>
                              <option value="salesperson">Salesperson</option>
                            </select>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${member.full_name} (${member.email}) from workspace?`)) {
                                  removeMemberMutation.mutate({ userId: member.id, email: member.email });
                                  toast.success(`Removed ${member.full_name}`);
                                }
                              }}
                              title="Remove member"
                              className="p-1 text-muted-foreground hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Organization & Personal Profile */}
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <SectionTitle title="Workspace & Personal Profile" />
            <div className="space-y-3">
              <Field label="Your Full Name" value={name} onChange={setName} />
              <Field label="Work Email" value={email} onChange={setEmail} />
              <Field
                label="Organization / Workspace Name"
                value={company}
                onChange={setCompany}
                disabled={!isAdmin}
              />
              <Island onClick={() => toast.success("Profile saved successfully")}>
                Save Profile
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
              {isAdmin ? (
                <Webhook className="h-4 w-4 text-emerald-400" />
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Lock className="h-3 w-3" /> Admin Config
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enter your credentials from <strong className="text-foreground">developers.facebook.com → WhatsApp → API Setup</strong> to send live WhatsApp messages.
            </p>

            {!isAdmin && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0" />
                <span>API credentials are locked for Salesperson role. Contact an admin to modify credentials.</span>
              </div>
            )}

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
                  <div>
                    <span className="font-semibold block">{inspectionResult.diagnosticAdvice || "Connection Diagnostic Complete"}</span>
                    {inspectionResult.error && (
                      <p className="mt-1 font-mono text-[10px] opacity-80">{inspectionResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Field
                label="WhatsApp Access Token"
                type="password"
                value={whatsappToken}
                onChange={setWhatsappToken}
                placeholder="EAATH..."
                disabled={!isAdmin}
              />
              <Field
                label="Phone Number ID"
                value={whatsappPhoneId}
                onChange={setWhatsappPhoneId}
                placeholder="1276074385581968"
                disabled={!isAdmin}
              />
              <Field
                label="WhatsApp Business Account ID (WABA ID)"
                value={whatsappWabaId}
                onChange={setWhatsappWabaId}
                placeholder="1040585292058401"
                disabled={!isAdmin}
              />

              {isAdmin && (
                <div className="flex items-center gap-2 pt-1">
                  <Island onClick={() => toast.success("WhatsApp credentials saved")}>
                    Save Credentials
                  </Island>
                  <button
                    onClick={testWhatsAppConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-1.5 rounded-[18px] border border-border/80 px-3.5 py-2 text-xs font-semibold hover:bg-muted transition"
                  >
                    {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-primary" />}
                    Test Connection
                  </button>
                </div>
              )}

              {/* Direct Test Message Sender */}
              <div className="border-t border-border/50 pt-2.5 space-y-2">
                <span className="text-[11px] font-semibold text-foreground block">
                  Send Test Outbound Message:
                </span>
                <div className="flex gap-2">
                  <input
                    value={testRecipientPhone}
                    onChange={(e) => setTestRecipientPhone(e.target.value)}
                    placeholder="Recipient phone (e.g. 919876543210)"
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
              {isAdmin ? (
                <Webhook className="h-4 w-4 text-purple-400" />
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Lock className="h-3 w-3" /> Admin Only
                </span>
              )}
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
              {isAdmin ? (
                <Bot className="h-4 w-4 text-primary" />
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Read Only
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={knowledgeBase}
              disabled={!isAdmin}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder="Paste company pricing details, FAQ answers, SLA terms, and prohibited topics..."
              className={cn(
                "w-full bg-background/60 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary/40 border border-border/60",
                !isAdmin && "opacity-70 cursor-not-allowed"
              )}
            />

            {isAdmin && (
              <button
                onClick={() => {
                  updateAiRulesMutation.mutate({ knowledgeBase });
                  toast.success("AI Knowledge Base updated successfully");
                }}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-xl px-3 py-1.5 text-xs font-semibold transition"
              >
                Update AI Playbook
              </button>
            )}
          </GlassCard>

          {/* Automation & Notification Toggles */}
          <GlassCard delay={180}>
            <SectionTitle title="Pipeline Automation" />
            <div className="divide-border/60 mt-1 divide-y">
              <Toggle id="auto-dna" label="Realtime Buyer DNA Extraction" hint="Extract intent and budget signals automatically from incoming messages" disabled={!isAdmin} />
              <Toggle id="auto-score" label="Dynamic Lead Scoring" hint="Recalculate lead score instantly after each buyer interaction" disabled={!isAdmin} />
              <Toggle id="hot-alerts" label="Hot Lead Instant Alerts" hint="Dispatch browser notification when a lead intent exceeds 85%" disabled={!isAdmin} />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

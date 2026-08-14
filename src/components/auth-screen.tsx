import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkEmailInviteEligibility } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { Bot, Loader2, UserPlus, LogIn, Mail, Lock, User, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/glass";
import { cn } from "@/lib/utils";

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      toast.error("Please provide both email and password.");
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!isLogin && password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        toast.success("Welcome back to SalesMind AI!");
      } else {
        // ── Check if email is invited or is the primary admin ──
        const eligibility = await checkEmailInviteEligibility(cleanEmail);

        if (!eligibility.allowed) {
          const errMsg = eligibility.message || "Your email is not invited to this organization. Please ask an Admin to invite your email.";
          setInviteError(errMsg);
          toast.error("Access Restricted: Email not invited.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: fullName.trim() || cleanEmail.split("@")[0],
              full_name: fullName.trim() || cleanEmail.split("@")[0],
              role: eligibility.role,
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success(`Account created! You have been granted the ${eligibility.role.toUpperCase()} role.`);
        } else {
          toast.success("Account created! Please check your email inbox to verify your address.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#008069] text-white shadow-xl shadow-[#008069]/20">
            <Bot className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            {isLogin ? "Sign in to SalesMind AI" : "Create your Account"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isLogin
              ? "Access your autonomous sales intelligence CRM"
              : "Set up your workspace and start closing deals with AI"}
          </p>
        </div>

        <GlassCard className="p-6 sm:p-8 space-y-5">
          {/* Segmented Auth Mode Switcher */}
          <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 border border-border/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer",
                isLogin
                  ? "bg-card text-foreground shadow-xs border border-border/40 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer",
                !isLogin
                  ? "bg-card text-foreground shadow-xs border border-border/40 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Sign Up
            </button>
          </div>

          {/* Invite Restriction Alert */}
          {inviteError && !isLogin && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-semibold block text-rose-200">Invite Required</span>
                <p className="mt-0.5 opacity-90 leading-relaxed text-[11px]">{inviteError}</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Full Name (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-background/70 border border-border/70 focus:ring-primary/40 h-11 w-full rounded-xl pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2"
                    placeholder="Alex Morgan"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/70 border border-border/70 focus:ring-primary/40 h-11 w-full rounded-xl pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/70 border border-border/70 focus:ring-primary/40 h-11 w-full rounded-xl pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-background/70 border border-border/70 focus:ring-primary/40 h-11 w-full rounded-xl pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Footer toggle prompt */}
          <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/40">
            {isLogin ? (
              <span>
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="font-bold text-primary hover:underline cursor-pointer ml-0.5"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="font-bold text-primary hover:underline cursor-pointer ml-0.5"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

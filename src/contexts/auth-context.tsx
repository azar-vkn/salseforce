import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { type UserRole, type UserProfile, type RolePermissions, ROLE_PERMISSIONS } from "@/lib/types";

const DEMO_SESSION_KEY = "salesmind-demo-session";

export const MOCK_DEMO_SESSION: Session = {
  access_token: "demo-token",
  refresh_token: "demo-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "demo-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "azarvkn@gmail.com",
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: { name: "Azar Vkn" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isSalesperson: boolean;
  permissions: RolePermissions;
  isLoading: boolean;
  isDemo: boolean;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: "admin",
  isAdmin: true,
  isSalesperson: false,
  permissions: ROLE_PERMISSIONS.admin,
  isLoading: true,
  isDemo: false,
  loginAsDemo: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRoleState] = useState<UserRole>("admin");
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        const rawRole = (data.role || "").toLowerCase();
        const mappedRole: UserRole = rawRole.includes("admin") || rawRole.includes("owner") ? "admin" : "salesperson";
        
        setProfile({
          id: data.id,
          org_id: data.org_id,
          full_name: data.full_name || userEmail?.split("@")[0] || "Team Member",
          email: data.email || userEmail || "",
          avatar_url: data.avatar_url,
          role: mappedRole,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });

        setRoleState(mappedRole);
      }
    } catch (e) {
      console.warn("Could not fetch user profile:", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isDemoStored = localStorage.getItem(DEMO_SESSION_KEY) === "true";
    if (isDemoStored) {
      setSession(MOCK_DEMO_SESSION);
      setIsDemo(true);
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setIsDemo(false);
        fetchProfile(session.user.id, session.user.email);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setIsDemo(false);
        if (typeof window !== "undefined") {
          localStorage.removeItem(DEMO_SESSION_KEY);
        }
        fetchProfile(session.user.id, session.user.email);
      } else {
        const isDemoNow = typeof window !== "undefined" && localStorage.getItem(DEMO_SESSION_KEY) === "true";
        if (isDemoNow) {
          setSession(MOCK_DEMO_SESSION);
          setIsDemo(true);
        } else {
          setSession(null);
          setProfile(null);
          setIsDemo(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const loginAsDemo = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DEMO_SESSION_KEY, "true");
    }
    setSession(MOCK_DEMO_SESSION);
    setIsDemo(true);
  };

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEMO_SESSION_KEY);
    }
    setIsDemo(false);
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if supabase not connected
    }
  };

  const user = session?.user ?? null;
  const isAdmin = role === "admin";
  const isSalesperson = role === "salesperson";
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        isAdmin,
        isSalesperson,
        permissions,
        isLoading,
        isDemo,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

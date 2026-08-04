import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

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
    email: "john@salesmind.ai",
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: { name: "John Doe" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  isDemo: boolean;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isDemo: false,
  loginAsDemo: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
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
        localStorage.removeItem(DEMO_SESSION_KEY);
      } else {
        const isDemoNow = localStorage.getItem(DEMO_SESSION_KEY) === "true";
        if (isDemoNow) {
          setSession(MOCK_DEMO_SESSION);
          setIsDemo(true);
        } else {
          setSession(null);
          setIsDemo(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginAsDemo = () => {
    localStorage.setItem(DEMO_SESSION_KEY, "true");
    setSession(MOCK_DEMO_SESSION);
    setIsDemo(true);
  };

  const logout = async () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
    setIsDemo(false);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if supabase not connected
    }
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, isDemo, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  isSupabaseAuthConfigured
} from "@/lib/auth/supabase-client";
import type { AccountStatus } from "@/types/account";

type AuthContextValue = {
  configured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  accountStatus: AccountStatus;
  signOut: () => Promise<void>;
  refreshAccountStatus: () => Promise<void>;
};

const guestAccountStatus: AccountStatus = {
  accountType: "guest",
  isAuthenticated: false,
  isAdmin: false,
  user: null,
  credits: {
    monthlyLimit: 20,
    guestLimit: 10,
    adminBypass: false
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseAuthConfigured();
  const supabase = getSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [accountStatus, setAccountStatus] =
    useState<AccountStatus>(guestAccountStatus);

  const loadAccountStatus = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      setAccountStatus(guestAccountStatus);
      return;
    }

    try {
      const response = await fetch("/api/account/status", {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Account status failed.");
      }

      setAccountStatus((await response.json()) as AccountStatus);
    } catch {
      setAccountStatus(guestAccountStatus);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
      void loadAccountStatus(data.session?.access_token ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadAccountStatus(nextSession?.access_token ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadAccountStatus, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      isLoading,
      session,
      user: session?.user ?? null,
      accountStatus,
      signOut: async () => {
        await supabase?.auth.signOut();
        setSession(null);
        setAccountStatus(guestAccountStatus);
      },
      refreshAccountStatus: async () => {
        await loadAccountStatus(session?.access_token ?? null);
      }
    }),
    [accountStatus, configured, isLoading, loadAccountStatus, session, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

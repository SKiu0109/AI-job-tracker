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
import { useAuth } from "@/lib/auth/auth-provider";
import { shouldFetchCreditsStatus } from "@/lib/credits/credit-policy";
import type { CreditBalance, CreditsStatusResponse } from "@/types/credits";

type GuestCreditsContextValue = {
  status: CreditsStatusResponse | null;
  isLoading: boolean;
  refreshCredits: () => Promise<CreditsStatusResponse | null>;
  updateCredits: (credits: CreditBalance) => void;
};

const GuestCreditsContext = createContext<GuestCreditsContextValue | null>(null);

export function GuestCreditsProvider({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading, session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [status, setStatus] = useState<CreditsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCredits = useCallback(async () => {
    if (!shouldFetchCreditsStatus(isAuthLoading)) {
      setIsLoading(true);
      return null;
    }

    setIsLoading(true);
    const payload = await fetchCreditsStatus(accessToken);

    if (payload) {
      setStatus(payload);
    }

    setIsLoading(false);
    return payload;
  }, [accessToken, isAuthLoading]);

  const updateCredits = useCallback((credits: CreditBalance) => {
    setStatus((current) =>
      current
        ? {
            ...current,
            credits
          }
        : current
    );
  }, []);

  useEffect(() => {
    let isCurrent = true;

    if (!shouldFetchCreditsStatus(isAuthLoading)) {
      return () => {
        isCurrent = false;
      };
    }

    fetchCreditsStatus(accessToken)
      .then((payload) => {
        if (isCurrent && payload) {
          setStatus(payload);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, isAuthLoading]);

  const value = useMemo(
    () => ({
      status,
      isLoading,
      refreshCredits,
      updateCredits
    }),
    [isLoading, refreshCredits, status, updateCredits]
  );

  return (
    <GuestCreditsContext.Provider value={value}>
      {children}
    </GuestCreditsContext.Provider>
  );
}

export function useGuestCredits() {
  const context = useContext(GuestCreditsContext);

  if (!context) {
    throw new Error("useGuestCredits must be used inside GuestCreditsProvider.");
  }

  return context;
}

async function fetchCreditsStatus(accessToken: string | null) {
  try {
    const response = await fetch("/api/credits", {
      cache: "no-store",
      headers: accessToken
        ? {
            authorization: `Bearer ${accessToken}`
          }
        : undefined
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CreditsStatusResponse;
  } catch {
    return null;
  }
}

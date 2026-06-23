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
import type { CreditBalance, CreditsStatusResponse } from "@/types/credits";

type GuestCreditsContextValue = {
  status: CreditsStatusResponse | null;
  isLoading: boolean;
  refreshCredits: () => Promise<CreditsStatusResponse | null>;
  updateCredits: (credits: CreditBalance) => void;
};

const GuestCreditsContext = createContext<GuestCreditsContextValue | null>(null);

export function GuestCreditsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CreditsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCredits = useCallback(async () => {
    const payload = await fetchCreditsStatus();

    if (payload) {
      setStatus(payload);
    }

    setIsLoading(false);
    return payload;
  }, []);

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

    fetchCreditsStatus()
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
  }, []);

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

async function fetchCreditsStatus() {
  try {
    const response = await fetch("/api/credits", {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CreditsStatusResponse;
  } catch {
    return null;
  }
}

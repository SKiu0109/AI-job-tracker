import "server-only";

import {
  GUEST_CREDIT_LIMIT,
  JD_ANALYSIS_CREDIT_COST
} from "@/lib/credits/constants";
import type { CreditBalance } from "@/types/credits";

type GuestCreditLedger = {
  remaining: number;
  createdAt: string;
  updatedAt: string;
};

type ServerCreditBalance = CreditBalance & {
  guestId: string;
};

export interface CreditsService {
  getBalance(guestId: string): ServerCreditBalance;
  trySpend(guestId: string, amount: number): ServerCreditBalance | null;
  refund(guestId: string, amount: number): ServerCreditBalance;
}

class InMemoryGuestCreditsService implements CreditsService {
  constructor(private readonly ledgers: Map<string, GuestCreditLedger>) {}

  getBalance(guestId: string) {
    return toBalance(guestId, this.ensureLedger(guestId));
  }

  trySpend(guestId: string, amount: number) {
    const ledger = this.ensureLedger(guestId);

    if (ledger.remaining < amount) {
      return null;
    }

    ledger.remaining -= amount;
    ledger.updatedAt = new Date().toISOString();
    return toBalance(guestId, ledger);
  }

  refund(guestId: string, amount: number) {
    const ledger = this.ensureLedger(guestId);
    ledger.remaining = Math.min(GUEST_CREDIT_LIMIT, ledger.remaining + amount);
    ledger.updatedAt = new Date().toISOString();
    return toBalance(guestId, ledger);
  }

  private ensureLedger(guestId: string) {
    const existing = this.ledgers.get(guestId);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const ledger: GuestCreditLedger = {
      remaining: GUEST_CREDIT_LIMIT,
      createdAt: now,
      updatedAt: now
    };

    this.ledgers.set(guestId, ledger);
    return ledger;
  }
}

const globalForCredits = globalThis as typeof globalThis & {
  __aiJobTrackerGuestCredits?: Map<string, GuestCreditLedger>;
};

export function getCreditsService(): CreditsService {
  // TODO: Replace this local/mock store with Supabase, Vercel KV, or Upstash
  // Redis before relying on credits for production-grade abuse prevention.
  const ledgers =
    globalForCredits.__aiJobTrackerGuestCredits ??
    new Map<string, GuestCreditLedger>();
  globalForCredits.__aiJobTrackerGuestCredits = ledgers;

  return new InMemoryGuestCreditsService(ledgers);
}

function toBalance(
  guestId: string,
  ledger: GuestCreditLedger
): ServerCreditBalance {
  return {
    guestId,
    remaining: ledger.remaining,
    limit: GUEST_CREDIT_LIMIT,
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store: "memory"
  };
}

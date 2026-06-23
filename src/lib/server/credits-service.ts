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
  getBalance(guestId: string): Promise<ServerCreditBalance>;
  trySpend(guestId: string, amount: number): Promise<ServerCreditBalance | null>;
  refund(guestId: string, amount: number): Promise<ServerCreditBalance>;
}

class InMemoryGuestCreditsService implements CreditsService {
  constructor(private readonly ledgers: Map<string, GuestCreditLedger>) {}

  async getBalance(guestId: string) {
    return toBalance(guestId, this.ensureLedger(guestId), "memory");
  }

  async trySpend(guestId: string, amount: number) {
    const ledger = this.ensureLedger(guestId);

    if (ledger.remaining < amount) {
      return null;
    }

    ledger.remaining -= amount;
    ledger.updatedAt = new Date().toISOString();
    return toBalance(guestId, ledger, "memory");
  }

  async refund(guestId: string, amount: number) {
    const ledger = this.ensureLedger(guestId);
    ledger.remaining = Math.min(GUEST_CREDIT_LIMIT, ledger.remaining + amount);
    ledger.updatedAt = new Date().toISOString();
    return toBalance(guestId, ledger, "memory");
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

type SupabaseCreditRow = {
  guest_id: string;
  remaining: number;
  created_at: string;
  updated_at: string;
};

class SupabaseGuestCreditsService implements CreditsService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  async getBalance(guestId: string) {
    const row = await this.callCreditRpc("get_or_create_guest_credit_balance", {
      p_guest_id: guestId,
      p_limit: GUEST_CREDIT_LIMIT
    });

    return toSupabaseBalance(row);
  }

  async trySpend(guestId: string, amount: number) {
    const row = await this.callCreditRpc("try_spend_guest_credit", {
      p_guest_id: guestId,
      p_amount: amount,
      p_limit: GUEST_CREDIT_LIMIT
    });

    return row ? toSupabaseBalance(row) : null;
  }

  async refund(guestId: string, amount: number) {
    const row = await this.callCreditRpc("refund_guest_credit", {
      p_guest_id: guestId,
      p_amount: amount,
      p_limit: GUEST_CREDIT_LIMIT
    });

    return toSupabaseBalance(row);
  }

  private async callCreditRpc(
    functionName:
      | "get_or_create_guest_credit_balance"
      | "try_spend_guest_credit"
      | "refund_guest_credit",
    body: Record<string, string | number>
  ) {
    const response = await fetch(`${this.restUrl}/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase credits RPC ${functionName} failed: ${response.status} ${errorText}`
      );
    }

    const rows = (await response.json()) as SupabaseCreditRow[];
    return Array.isArray(rows) ? rows[0] : null;
  }
}

class FallbackCreditsService implements CreditsService {
  constructor(
    private readonly primary: CreditsService,
    private readonly fallback: CreditsService
  ) {}

  async getBalance(guestId: string) {
    try {
      return await this.primary.getBalance(guestId);
    } catch (error) {
      console.warn("[credits-fallback:getBalance]", error);
      return this.fallback.getBalance(guestId);
    }
  }

  async trySpend(guestId: string, amount: number) {
    try {
      return await this.primary.trySpend(guestId, amount);
    } catch (error) {
      console.warn("[credits-fallback:trySpend]", error);
      return this.fallback.trySpend(guestId, amount);
    }
  }

  async refund(guestId: string, amount: number) {
    try {
      return await this.primary.refund(guestId, amount);
    } catch (error) {
      console.warn("[credits-fallback:refund]", error);
      return this.fallback.refund(guestId, amount);
    }
  }
}

const globalForCredits = globalThis as typeof globalThis & {
  __aiJobTrackerGuestCredits?: Map<string, GuestCreditLedger>;
};

export function getCreditsService(): CreditsService {
  const ledgers =
    globalForCredits.__aiJobTrackerGuestCredits ??
    new Map<string, GuestCreditLedger>();
  globalForCredits.__aiJobTrackerGuestCredits = ledgers;

  const memoryService = new InMemoryGuestCreditsService(ledgers);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return new FallbackCreditsService(
      new SupabaseGuestCreditsService(supabaseUrl, serviceRoleKey),
      memoryService
    );
  }

  return memoryService;
}

function toBalance(
  guestId: string,
  ledger: GuestCreditLedger,
  store: ServerCreditBalance["store"]
): ServerCreditBalance {
  return {
    guestId,
    remaining: ledger.remaining,
    limit: GUEST_CREDIT_LIMIT,
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store
  };
}

function toSupabaseBalance(row: SupabaseCreditRow | null): ServerCreditBalance {
  if (!row) {
    throw new Error("Supabase credits RPC returned no balance row.");
  }

  return {
    guestId: row.guest_id,
    remaining: Number(row.remaining),
    limit: GUEST_CREDIT_LIMIT,
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store: "supabase"
  };
}

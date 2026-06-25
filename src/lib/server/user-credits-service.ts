import "server-only";

import {
  FREE_USER_MONTHLY_CREDITS,
  JD_ANALYSIS_CREDIT_COST
} from "@/lib/credits/constants";
import type { CreditBalance } from "@/types/credits";

type UserCreditLedger = {
  remaining: number;
  monthlyLimit: number;
  periodStart: string;
  createdAt: string;
  updatedAt: string;
};

type ServerUserCreditBalance = CreditBalance & {
  userId: string;
  periodStart: string;
};

export interface UserCreditsService {
  getBalance(
    userId: string,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance>;
  trySpend(
    userId: string,
    amount: number,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance | null>;
  refund(
    userId: string,
    amount: number,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance>;
}

class InMemoryUserCreditsService implements UserCreditsService {
  constructor(private readonly ledgers: Map<string, UserCreditLedger>) {}

  async getBalance(userId: string, monthlyLimit: number) {
    return toBalance(userId, this.ensureLedger(userId, monthlyLimit), "memory");
  }

  async trySpend(userId: string, amount: number, monthlyLimit: number) {
    const ledger = this.ensureLedger(userId, monthlyLimit);

    if (ledger.remaining < amount) {
      return null;
    }

    ledger.remaining -= amount;
    ledger.updatedAt = new Date().toISOString();
    return toBalance(userId, ledger, "memory");
  }

  async refund(userId: string, amount: number, monthlyLimit: number) {
    const ledger = this.ensureLedger(userId, monthlyLimit);
    ledger.remaining = Math.min(ledger.monthlyLimit, ledger.remaining + amount);
    ledger.updatedAt = new Date().toISOString();
    return toBalance(userId, ledger, "memory");
  }

  private ensureLedger(userId: string, monthlyLimit: number) {
    const periodStart = getCurrentPeriodStart();
    const key = `${userId}:${periodStart}`;
    const existing = this.ledgers.get(key);

    if (existing) {
      if (existing.monthlyLimit !== monthlyLimit) {
        existing.monthlyLimit = monthlyLimit;
        existing.remaining = Math.min(existing.remaining, monthlyLimit);
      }

      return existing;
    }

    const now = new Date().toISOString();
    const ledger: UserCreditLedger = {
      remaining: monthlyLimit,
      monthlyLimit,
      periodStart,
      createdAt: now,
      updatedAt: now
    };

    this.ledgers.set(key, ledger);
    return ledger;
  }
}

type SupabaseUserCreditRow = {
  user_id: string;
  period_start: string;
  remaining: number;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
};

class SupabaseUserCreditsService implements UserCreditsService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  async getBalance(userId: string, monthlyLimit: number) {
    const row = await this.callCreditRpc(
      "get_or_create_user_monthly_credit_balance",
      {
        p_user_id: userId,
        p_period_start: getCurrentPeriodStart(),
        p_monthly_limit: monthlyLimit
      }
    );

    return toSupabaseBalance(row);
  }

  async trySpend(userId: string, amount: number, monthlyLimit: number) {
    const row = await this.callCreditRpc("try_spend_user_monthly_credit", {
      p_user_id: userId,
      p_period_start: getCurrentPeriodStart(),
      p_amount: amount,
      p_monthly_limit: monthlyLimit
    });

    return row ? toSupabaseBalance(row) : null;
  }

  async refund(userId: string, amount: number, monthlyLimit: number) {
    const row = await this.callCreditRpc("refund_user_monthly_credit", {
      p_user_id: userId,
      p_period_start: getCurrentPeriodStart(),
      p_amount: amount,
      p_monthly_limit: monthlyLimit
    });

    return toSupabaseBalance(row);
  }

  private async callCreditRpc(
    functionName:
      | "get_or_create_user_monthly_credit_balance"
      | "try_spend_user_monthly_credit"
      | "refund_user_monthly_credit",
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
        `Supabase user credits RPC ${functionName} failed: ${response.status} ${errorText}`
      );
    }

    const rows = (await response.json()) as SupabaseUserCreditRow[];
    return Array.isArray(rows) ? rows[0] : null;
  }
}

class FallbackUserCreditsService implements UserCreditsService {
  constructor(
    private readonly primary: UserCreditsService,
    private readonly fallback: UserCreditsService
  ) {}

  async getBalance(userId: string, monthlyLimit: number) {
    try {
      return await this.primary.getBalance(userId, monthlyLimit);
    } catch (error) {
      console.warn("[user-credits-fallback:getBalance]", error);
      return this.fallback.getBalance(userId, monthlyLimit);
    }
  }

  async trySpend(userId: string, amount: number, monthlyLimit: number) {
    try {
      return await this.primary.trySpend(userId, amount, monthlyLimit);
    } catch (error) {
      console.warn("[user-credits-fallback:trySpend]", error);
      return this.fallback.trySpend(userId, amount, monthlyLimit);
    }
  }

  async refund(userId: string, amount: number, monthlyLimit: number) {
    try {
      return await this.primary.refund(userId, amount, monthlyLimit);
    } catch (error) {
      console.warn("[user-credits-fallback:refund]", error);
      return this.fallback.refund(userId, amount, monthlyLimit);
    }
  }
}

const globalForUserCredits = globalThis as typeof globalThis & {
  __aiJobTrackerUserCredits?: Map<string, UserCreditLedger>;
};

export function getUserCreditsService(): UserCreditsService {
  const ledgers =
    globalForUserCredits.__aiJobTrackerUserCredits ??
    new Map<string, UserCreditLedger>();
  globalForUserCredits.__aiJobTrackerUserCredits = ledgers;

  const memoryService = new InMemoryUserCreditsService(ledgers);
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_URL ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return new FallbackUserCreditsService(
      new SupabaseUserCreditsService(supabaseUrl, serviceRoleKey),
      memoryService
    );
  }

  return memoryService;
}

export function createAdminCreditBalance(): CreditBalance {
  return {
    remaining: Number.MAX_SAFE_INTEGER,
    limit: Number.MAX_SAFE_INTEGER,
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store: "memory"
  };
}

function getCurrentPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

function toBalance(
  userId: string,
  ledger: UserCreditLedger,
  store: ServerUserCreditBalance["store"]
): ServerUserCreditBalance {
  return {
    userId,
    periodStart: ledger.periodStart,
    remaining: ledger.remaining,
    limit: ledger.monthlyLimit || FREE_USER_MONTHLY_CREDITS,
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store
  };
}

function toSupabaseBalance(
  row: SupabaseUserCreditRow | null
): ServerUserCreditBalance {
  if (!row) {
    throw new Error("Supabase user credits RPC returned no balance row.");
  }

  return {
    userId: row.user_id,
    periodStart: row.period_start,
    remaining: Number(row.remaining),
    limit: Number(row.monthly_limit),
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store: "supabase"
  };
}

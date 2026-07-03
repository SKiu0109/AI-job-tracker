import "server-only";

import {
  FREE_USER_MONTHLY_CREDITS,
  JD_ANALYSIS_CREDIT_COST
} from "@/lib/credits/constants";
import { getCreditsService } from "@/lib/server/credits-service";
import {
  loadLedgerMap,
  persistLedgerMap,
  resolvePersistencePath
} from "@/lib/server/file-persistence";
import {
  getSupabaseServerConfig,
  shouldFailClosedForPersistentUserData
} from "@/lib/server/supabase-config";
import type { CreditBalance } from "@/types/credits";

type UserCreditLedger = {
  remaining: number;
  monthlyLimit: number;
  periodStart: string;
  createdAt: string;
  updatedAt: string;
};

type UserCreditWallet = {
  bonusRemaining: number;
  createdAt: string;
  updatedAt: string;
};

type GuestCreditMigration = {
  migratedAmount: number;
  userId: string;
  createdAt: string;
};

export type UserCreditSpendBreakdown = {
  bonus: number;
  monthly: number;
};

type ServerUserCreditBalance = CreditBalance & {
  bonusRemaining: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  periodStart: string;
  spentBonus?: number;
  spentMonthly?: number;
  userId: string;
};

type GuestCreditMigrationResult = {
  balance: ServerUserCreditBalance;
  migrated: boolean;
  migratedAmount: number;
};

export interface UserCreditsService {
  addBonusCredits(
    userId: string,
    amount: number,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance>;
  getBalance(
    userId: string,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance>;
  migrateGuestCredits(
    userId: string,
    guestId: string,
    monthlyLimit: number
  ): Promise<GuestCreditMigrationResult>;
  refund(
    userId: string,
    amount: number,
    monthlyLimit: number,
    spend?: UserCreditSpendBreakdown
  ): Promise<ServerUserCreditBalance>;
  trySpend(
    userId: string,
    amount: number,
    monthlyLimit: number
  ): Promise<ServerUserCreditBalance | null>;
}

class InMemoryUserCreditsService implements UserCreditsService {
  constructor(
    private readonly ledgers: Map<string, UserCreditLedger>,
    private readonly wallets: Map<string, UserCreditWallet>,
    private readonly migrations: Map<string, GuestCreditMigration>,
    private readonly ledgerPersistencePath?: string,
    private readonly walletPersistencePath?: string,
    private readonly migrationPersistencePath?: string
  ) {}

  async getBalance(userId: string, monthlyLimit: number) {
    return toBalance(
      userId,
      this.ensureLedger(userId, monthlyLimit),
      this.ensureWallet(userId),
      "memory"
    );
  }

  async trySpend(userId: string, amount: number, monthlyLimit: number) {
    const ledger = this.ensureLedger(userId, monthlyLimit);
    const wallet = this.ensureWallet(userId);

    if (ledger.remaining + wallet.bonusRemaining < amount) {
      return null;
    }

    const spentMonthly = Math.min(ledger.remaining, amount);
    const spentBonus = amount - spentMonthly;
    ledger.remaining -= spentMonthly;
    wallet.bonusRemaining -= spentBonus;
    ledger.updatedAt = new Date().toISOString();
    wallet.updatedAt = ledger.updatedAt;
    this.saveLedgers();
    this.saveWallets();

    return toBalance(userId, ledger, wallet, "memory", {
      monthly: spentMonthly,
      bonus: spentBonus
    });
  }

  async refund(
    userId: string,
    amount: number,
    monthlyLimit: number,
    spend?: UserCreditSpendBreakdown
  ) {
    const ledger = this.ensureLedger(userId, monthlyLimit);
    const wallet = this.ensureWallet(userId);
    const monthlyRoom = Math.max(0, ledger.monthlyLimit - ledger.remaining);
    const refundMonthly =
      spend?.monthly ?? Math.min(monthlyRoom, Math.max(0, amount));
    const refundBonus =
      spend?.bonus ?? Math.max(0, amount - Math.min(monthlyRoom, amount));

    ledger.remaining = Math.min(
      ledger.monthlyLimit,
      ledger.remaining + refundMonthly
    );
    wallet.bonusRemaining += refundBonus;
    ledger.updatedAt = new Date().toISOString();
    wallet.updatedAt = ledger.updatedAt;
    this.saveLedgers();
    this.saveWallets();

    return toBalance(userId, ledger, wallet, "memory");
  }

  async addBonusCredits(userId: string, amount: number, monthlyLimit: number) {
    const ledger = this.ensureLedger(userId, monthlyLimit);
    const wallet = this.ensureWallet(userId);

    if (amount > 0) {
      wallet.bonusRemaining += amount;
      wallet.updatedAt = new Date().toISOString();
      this.saveWallets();
    }

    return toBalance(userId, ledger, wallet, "memory");
  }

  async migrateGuestCredits(
    userId: string,
    guestId: string,
    monthlyLimit: number
  ) {
    if (this.migrations.has(guestId)) {
      return {
        balance: await this.getBalance(userId, monthlyLimit),
        migrated: false,
        migratedAmount: this.migrations.get(guestId)?.migratedAmount ?? 0
      };
    }

    const guestBalance = await getCreditsService().getExistingBalance(guestId);
    if (!guestBalance) {
      this.migrations.set(guestId, {
        userId,
        migratedAmount: 0,
        createdAt: new Date().toISOString()
      });
      this.saveMigrations();

      return {
        balance: await this.getBalance(userId, monthlyLimit),
        migrated: false,
        migratedAmount: 0
      };
    }

    const migratedAmount = Math.max(0, Math.min(guestBalance.remaining, guestBalance.limit));

    if (migratedAmount > 0) {
      const spentGuestCredits = await getCreditsService().trySpend(
        guestId,
        migratedAmount
      );

      if (!spentGuestCredits) {
        return {
          balance: await this.getBalance(userId, monthlyLimit),
          migrated: false,
          migratedAmount: 0
        };
      }

      await this.addBonusCredits(userId, migratedAmount, monthlyLimit);
    }

    this.migrations.set(guestId, {
      userId,
      migratedAmount,
      createdAt: new Date().toISOString()
    });
    this.saveMigrations();

    return {
      balance: await this.getBalance(userId, monthlyLimit),
      migrated: migratedAmount > 0,
      migratedAmount
    };
  }

  private ensureLedger(userId: string, monthlyLimit: number) {
    const periodStart = getCurrentPeriodStart();
    const key = `${userId}:${periodStart}`;
    const existing = this.ledgers.get(key);

    if (existing) {
      if (existing.monthlyLimit !== monthlyLimit) {
        existing.monthlyLimit = monthlyLimit;
        existing.remaining = Math.min(existing.remaining, monthlyLimit);
        existing.updatedAt = new Date().toISOString();
        this.saveLedgers();
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
    this.saveLedgers();
    return ledger;
  }

  private ensureWallet(userId: string) {
    const existing = this.wallets.get(userId);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const wallet: UserCreditWallet = {
      bonusRemaining: 0,
      createdAt: now,
      updatedAt: now
    };

    this.wallets.set(userId, wallet);
    this.saveWallets();
    return wallet;
  }

  private saveLedgers(): void {
    if (!this.ledgerPersistencePath) return;
    persistLedgerMap<UserCreditLedger>(this.ledgerPersistencePath, this.ledgers);
  }

  private saveWallets(): void {
    if (!this.walletPersistencePath) return;
    persistLedgerMap<UserCreditWallet>(this.walletPersistencePath, this.wallets);
  }

  private saveMigrations(): void {
    if (!this.migrationPersistencePath) return;
    persistLedgerMap<GuestCreditMigration>(
      this.migrationPersistencePath,
      this.migrations
    );
  }
}

type SupabaseUserCreditRow = {
  user_id: string;
  period_start: string;
  remaining: number;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
  bonus_remaining?: number;
  monthly_remaining?: number;
  spent_bonus?: number;
  spent_monthly?: number;
};

type SupabaseMigrationRow = {
  migrated: boolean;
  migrated_amount: number;
  remaining: number;
  monthly_limit: number;
  monthly_remaining?: number;
  bonus_remaining?: number;
  period_start: string;
};

type CloudCacheCreditRow = {
  payload: {
    kind?: string;
    period_start?: string;
    remaining?: number;
    monthly_limit?: number;
    bonus_remaining?: number;
    migrated_amount?: number;
    user_id?: string;
    updated_at?: string;
  };
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

  async refund(
    userId: string,
    amount: number,
    monthlyLimit: number,
    spend?: UserCreditSpendBreakdown
  ) {
    let row: SupabaseUserCreditRow | null;

    try {
      row = await this.callCreditRpc("refund_user_monthly_credit", {
        p_user_id: userId,
        p_period_start: getCurrentPeriodStart(),
        p_amount: amount,
        p_monthly_limit: monthlyLimit,
        p_monthly_amount: spend?.monthly ?? amount,
        p_bonus_amount: spend?.bonus ?? 0
      });
    } catch (error) {
      console.warn(
        "[user-credits:refund-legacy-rpc]",
        error instanceof Error ? error.message : String(error)
      );
      row = await this.callCreditRpc("refund_user_monthly_credit", {
        p_user_id: userId,
        p_period_start: getCurrentPeriodStart(),
        p_amount: amount,
        p_monthly_limit: monthlyLimit
      });
    }

    return toSupabaseBalance(row);
  }

  async addBonusCredits(userId: string, amount: number, monthlyLimit: number) {
    const row = await this.callCreditRpc("add_user_bonus_credits", {
      p_user_id: userId,
      p_period_start: getCurrentPeriodStart(),
      p_amount: amount,
      p_monthly_limit: monthlyLimit
    });

    return toSupabaseBalance(row);
  }

  async migrateGuestCredits(
    userId: string,
    guestId: string,
    monthlyLimit: number
  ) {
    const response = await fetch(`${this.restUrl}/rpc/migrate_guest_credits_to_user`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        p_guest_id: guestId,
        p_monthly_limit: monthlyLimit,
        p_period_start: getCurrentPeriodStart(),
        p_user_id: userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase guest credit migration failed: ${response.status} ${errorText}`
      );
    }

    const rows = (await response.json()) as SupabaseMigrationRow[];
    const row = rows[0];

    if (!row) {
      throw new Error("Supabase guest credit migration returned no result.");
    }

    const ledger: UserCreditLedger = {
      remaining: Number(row.monthly_remaining ?? row.remaining),
      monthlyLimit: Number(row.monthly_limit),
      periodStart: row.period_start,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const wallet: UserCreditWallet = {
      bonusRemaining: Number(row.bonus_remaining ?? 0),
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt
    };

    return {
      balance: toBalance(userId, ledger, wallet, "supabase"),
      migrated: Boolean(row.migrated),
      migratedAmount: Number(row.migrated_amount)
    };
  }

  private async callCreditRpc(
    functionName:
      | "add_user_bonus_credits"
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

class SupabaseCloudCacheUserCreditsService implements UserCreditsService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  async getBalance(userId: string, monthlyLimit: number) {
    const ledger = await this.getOrCreateLedger(userId, monthlyLimit);
    return toBalance(userId, ledger, toWallet(ledger), "supabase");
  }

  async trySpend(userId: string, amount: number, monthlyLimit: number) {
    const ledger = await this.getOrCreateLedger(userId, monthlyLimit);
    const wallet = toWallet(ledger);

    if (ledger.remaining + wallet.bonusRemaining < amount) {
      return null;
    }

    const spentMonthly = Math.min(ledger.remaining, amount);
    const spentBonus = amount - spentMonthly;
    const nextLedger = {
      ...ledger,
      remaining: ledger.remaining - spentMonthly,
      bonusRemaining: wallet.bonusRemaining - spentBonus,
      updatedAt: new Date().toISOString()
    };

    await this.saveLedger(userId, nextLedger);
    return toBalance(userId, nextLedger, toWallet(nextLedger), "supabase", {
      monthly: spentMonthly,
      bonus: spentBonus
    });
  }

  async refund(
    userId: string,
    amount: number,
    monthlyLimit: number,
    spend?: UserCreditSpendBreakdown
  ) {
    const ledger = await this.getOrCreateLedger(userId, monthlyLimit);
    const wallet = toWallet(ledger);
    const monthlyRoom = Math.max(0, ledger.monthlyLimit - ledger.remaining);
    const refundMonthly =
      spend?.monthly ?? Math.min(monthlyRoom, Math.max(0, amount));
    const refundBonus =
      spend?.bonus ?? Math.max(0, amount - Math.min(monthlyRoom, amount));
    const nextLedger = {
      ...ledger,
      remaining: Math.min(ledger.monthlyLimit, ledger.remaining + refundMonthly),
      bonusRemaining: wallet.bonusRemaining + refundBonus,
      updatedAt: new Date().toISOString()
    };

    await this.saveLedger(userId, nextLedger);
    return toBalance(userId, nextLedger, toWallet(nextLedger), "supabase");
  }

  async addBonusCredits(userId: string, amount: number, monthlyLimit: number) {
    const ledger = await this.getOrCreateLedger(userId, monthlyLimit);
    const nextLedger = {
      ...ledger,
      bonusRemaining: toWallet(ledger).bonusRemaining + Math.max(0, amount),
      updatedAt: new Date().toISOString()
    };

    await this.saveLedger(userId, nextLedger);
    return toBalance(userId, nextLedger, toWallet(nextLedger), "supabase");
  }

  async migrateGuestCredits(
    userId: string,
    guestId: string,
    monthlyLimit: number
  ) {
    const existingMigration = await this.readMigration(userId, guestId);

    if (existingMigration) {
      return {
        balance: await this.getBalance(userId, monthlyLimit),
        migrated: false,
        migratedAmount: existingMigration.migratedAmount
      };
    }

    const guestBalance = await getCreditsService().getExistingBalance(guestId);
    if (!guestBalance) {
      await this.saveMigration(userId, guestId, 0);

      return {
        balance: await this.getBalance(userId, monthlyLimit),
        migrated: false,
        migratedAmount: 0
      };
    }

    const migratedAmount = Math.max(0, Math.min(guestBalance.remaining, guestBalance.limit));

    if (migratedAmount > 0) {
      const spentGuestCredits = await getCreditsService().trySpend(
        guestId,
        migratedAmount
      );

      if (!spentGuestCredits) {
        return {
          balance: await this.getBalance(userId, monthlyLimit),
          migrated: false,
          migratedAmount: 0
        };
      }

      await this.addBonusCredits(userId, migratedAmount, monthlyLimit);
    }

    await this.saveMigration(userId, guestId, migratedAmount);

    return {
      balance: await this.getBalance(userId, monthlyLimit),
      migrated: migratedAmount > 0,
      migratedAmount
    };
  }

  private async getOrCreateLedger(userId: string, monthlyLimit: number) {
    const periodStart = getCurrentPeriodStart();
    const existing = await this.readLedger(userId, periodStart);

    if (existing) {
      if (existing.monthlyLimit !== monthlyLimit) {
        const adjusted = {
          ...existing,
          monthlyLimit,
          remaining: Math.min(existing.remaining, monthlyLimit),
          updatedAt: new Date().toISOString()
        };
        await this.saveLedger(userId, adjusted);
        return adjusted;
      }

      return existing;
    }

    const now = new Date().toISOString();
    const ledger: UserCreditLedger & { bonusRemaining?: number } = {
      remaining: monthlyLimit,
      monthlyLimit,
      periodStart,
      bonusRemaining: 0,
      createdAt: now,
      updatedAt: now
    };

    await this.saveLedger(userId, ledger);
    return ledger;
  }

  private async readLedger(userId: string, periodStart: string) {
    const response = await fetch(
      `${this.restUrl}/cloud_analysis_cache?user_id=eq.${encodeURIComponent(
        userId
      )}&cache_key=eq.${encodeURIComponent(
        getLedgerCacheKey(periodStart)
      )}&select=payload`,
      {
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase cloud credit ledger read failed: ${response.status} ${errorText}`
      );
    }

    const rows = (await response.json()) as CloudCacheCreditRow[];
    const payload = rows[0]?.payload;

    if (!payload || payload.period_start !== periodStart) {
      return null;
    }

    return {
      remaining: Number(payload.remaining),
      monthlyLimit: Number(payload.monthly_limit),
      bonusRemaining: Number(payload.bonus_remaining ?? 0),
      periodStart,
      createdAt: payload.updated_at || new Date().toISOString(),
      updatedAt: payload.updated_at || new Date().toISOString()
    } satisfies UserCreditLedger & { bonusRemaining?: number };
  }

  private async saveLedger(
    userId: string,
    ledger: UserCreditLedger & { bonusRemaining?: number }
  ) {
    const response = await fetch(`${this.restUrl}/cloud_analysis_cache`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        user_id: userId,
        cache_key: getLedgerCacheKey(ledger.periodStart),
        payload: {
          kind: "user_monthly_credits",
          period_start: ledger.periodStart,
          remaining: ledger.remaining,
          monthly_limit: ledger.monthlyLimit,
          bonus_remaining: ledger.bonusRemaining ?? 0,
          updated_at: ledger.updatedAt
        },
        created_at: ledger.createdAt
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase cloud credit ledger write failed: ${response.status} ${errorText}`
      );
    }
  }

  private async readMigration(userId: string, guestId: string) {
    const response = await fetch(
      `${this.restUrl}/cloud_analysis_cache?user_id=eq.${encodeURIComponent(
        userId
      )}&cache_key=eq.${encodeURIComponent(
        getMigrationCacheKey(guestId)
      )}&select=payload`,
      {
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as CloudCacheCreditRow[];
    const payload = rows[0]?.payload;
    return payload
      ? {
          migratedAmount: Number(payload.migrated_amount ?? 0)
        }
      : null;
  }

  private async saveMigration(
    userId: string,
    guestId: string,
    migratedAmount: number
  ) {
    await fetch(`${this.restUrl}/cloud_analysis_cache`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        user_id: userId,
        cache_key: getMigrationCacheKey(guestId),
        payload: {
          kind: "guest_credit_migration",
          migrated_amount: migratedAmount,
          user_id: userId,
          updated_at: new Date().toISOString()
        }
      })
    });
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

  async refund(
    userId: string,
    amount: number,
    monthlyLimit: number,
    spend?: UserCreditSpendBreakdown
  ) {
    try {
      return await this.primary.refund(userId, amount, monthlyLimit, spend);
    } catch (error) {
      console.warn("[user-credits-fallback:refund]", error);
      return this.fallback.refund(userId, amount, monthlyLimit, spend);
    }
  }

  async addBonusCredits(userId: string, amount: number, monthlyLimit: number) {
    try {
      return await this.primary.addBonusCredits(userId, amount, monthlyLimit);
    } catch (error) {
      console.warn("[user-credits-fallback:addBonusCredits]", error);
      return this.fallback.addBonusCredits(userId, amount, monthlyLimit);
    }
  }

  async migrateGuestCredits(
    userId: string,
    guestId: string,
    monthlyLimit: number
  ) {
    try {
      return await this.primary.migrateGuestCredits(userId, guestId, monthlyLimit);
    } catch (error) {
      console.warn("[user-credits-fallback:migrateGuestCredits]", error);
      return this.fallback.migrateGuestCredits(userId, guestId, monthlyLimit);
    }
  }
}

class UnavailableUserCreditsService implements UserCreditsService {
  constructor(private readonly reason: string) {}

  async getBalance(): Promise<ServerUserCreditBalance> {
    throw new Error(this.reason);
  }

  async trySpend(): Promise<ServerUserCreditBalance | null> {
    throw new Error(this.reason);
  }

  async refund(): Promise<ServerUserCreditBalance> {
    throw new Error(this.reason);
  }

  async addBonusCredits(): Promise<ServerUserCreditBalance> {
    throw new Error(this.reason);
  }

  async migrateGuestCredits(): Promise<GuestCreditMigrationResult> {
    throw new Error(this.reason);
  }
}

const globalForUserCredits = globalThis as typeof globalThis & {
  __aiJobTrackerUserCreditMigrations?: Map<string, GuestCreditMigration>;
  __aiJobTrackerUserCreditWallets?: Map<string, UserCreditWallet>;
  __aiJobTrackerUserCredits?: Map<string, UserCreditLedger>;
};

export function getUserCreditsService(): UserCreditsService {
  const ledgerPersistencePath = resolvePersistencePath("user-credits-ledger.json");
  const walletPersistencePath = resolvePersistencePath("user-credit-wallets.json");
  const migrationPersistencePath = resolvePersistencePath(
    "guest-credit-migrations.json"
  );
  const ledgers =
    globalForUserCredits.__aiJobTrackerUserCredits ??
    loadLedgerMap<UserCreditLedger>(ledgerPersistencePath);
  const wallets =
    globalForUserCredits.__aiJobTrackerUserCreditWallets ??
    loadLedgerMap<UserCreditWallet>(walletPersistencePath);
  const migrations =
    globalForUserCredits.__aiJobTrackerUserCreditMigrations ??
    loadLedgerMap<GuestCreditMigration>(migrationPersistencePath);
  globalForUserCredits.__aiJobTrackerUserCredits = ledgers;
  globalForUserCredits.__aiJobTrackerUserCreditWallets = wallets;
  globalForUserCredits.__aiJobTrackerUserCreditMigrations = migrations;

  const memoryService = new InMemoryUserCreditsService(
    ledgers,
    wallets,
    migrations,
    ledgerPersistencePath,
    walletPersistencePath,
    migrationPersistencePath
  );
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (supabaseUrl && serviceRoleKey) {
    const supabaseService = new SupabaseUserCreditsService(
      supabaseUrl,
      serviceRoleKey
    );
    const cloudCacheService = new SupabaseCloudCacheUserCreditsService(
      supabaseUrl,
      serviceRoleKey
    );

    return shouldFailClosedForPersistentUserData()
      ? new FallbackUserCreditsService(supabaseService, cloudCacheService)
      : new FallbackUserCreditsService(supabaseService, memoryService);
  }

  if (supabaseUrl && shouldFailClosedForPersistentUserData()) {
    return new UnavailableUserCreditsService(
      "Authenticated user credits require SUPABASE_SERVICE_ROLE_KEY in production."
    );
  }

  return memoryService;
}

function getLedgerCacheKey(periodStart: string) {
  return `__system:user-monthly-credits:${periodStart}`;
}

function getMigrationCacheKey(guestId: string) {
  return `__system:guest-credit-migration:${guestId}`;
}

export function createAdminCreditBalance(): CreditBalance {
  return {
    remaining: Number.MAX_SAFE_INTEGER,
    limit: Number.MAX_SAFE_INTEGER,
    monthlyRemaining: Number.MAX_SAFE_INTEGER,
    monthlyLimit: Number.MAX_SAFE_INTEGER,
    bonusRemaining: 0,
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

function toWallet(
  ledger: UserCreditLedger & { bonusRemaining?: number }
): UserCreditWallet {
  return {
    bonusRemaining: Math.max(0, Number(ledger.bonusRemaining ?? 0)),
    createdAt: ledger.createdAt,
    updatedAt: ledger.updatedAt
  };
}

function toBalance(
  userId: string,
  ledger: UserCreditLedger,
  wallet: UserCreditWallet,
  store: ServerUserCreditBalance["store"],
  spend?: UserCreditSpendBreakdown
): ServerUserCreditBalance {
  const bonusRemaining = Math.max(0, Number(wallet.bonusRemaining));
  const monthlyRemaining = Math.max(0, Number(ledger.remaining));
  const monthlyLimit = ledger.monthlyLimit || FREE_USER_MONTHLY_CREDITS;

  return {
    userId,
    periodStart: ledger.periodStart,
    remaining: monthlyRemaining + bonusRemaining,
    limit: monthlyLimit + bonusRemaining,
    monthlyRemaining,
    monthlyLimit,
    bonusRemaining,
    spentMonthly: spend?.monthly,
    spentBonus: spend?.bonus,
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

  const monthlyRemaining = Number(row.monthly_remaining ?? row.remaining);
  const bonusRemaining = Number(row.bonus_remaining ?? 0);
  const monthlyLimit = Number(row.monthly_limit);

  return {
    userId: row.user_id,
    periodStart: row.period_start,
    remaining: monthlyRemaining + bonusRemaining,
    limit: monthlyLimit + bonusRemaining,
    monthlyRemaining,
    monthlyLimit,
    bonusRemaining,
    spentMonthly:
      row.spent_monthly === undefined ? undefined : Number(row.spent_monthly),
    spentBonus: row.spent_bonus === undefined ? undefined : Number(row.spent_bonus),
    costPerAnalysis: JD_ANALYSIS_CREDIT_COST,
    store: "supabase"
  };
}

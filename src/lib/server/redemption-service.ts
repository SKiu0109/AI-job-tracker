import "server-only";

import { randomBytes } from "node:crypto";
import type {
  RedemptionCode,
  CodeRedemption,
  RedeemResult,
  GenerateCodesRequest,
  GenerateCodesResult,
  AdminCodeListResponse
} from "@/types/redemption";
import { getSupabaseServerConfig } from "@/lib/server/supabase-config";
import { getUserCreditsService } from "@/lib/server/user-credits-service";

// ============================================================
// Code generation
// ============================================================

const CODE_PREFIX = "JOBTRACK";
const CODE_SEGMENTS = 3;
const CODE_SEGMENT_LENGTH = 4;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function generateSingleCode(): string {
  const segments: string[] = [];
  for (let s = 0; s < CODE_SEGMENTS; s++) {
    let segment = "";
    const bytes = randomBytes(CODE_SEGMENT_LENGTH);
    for (const b of bytes) {
      segment += CODE_CHARS[b % CODE_CHARS.length];
    }
    segments.push(segment);
  }
  return `${CODE_PREFIX}-${segments.join("-")}`;
}

function generateCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateSingleCode());
  }
  return Array.from(codes);
}

// ============================================================
// Service interface
// ============================================================

export interface RedemptionService {
  generateCodes(
    request: GenerateCodesRequest,
    createdBy: string
  ): Promise<GenerateCodesResult>;
  listCodes(): Promise<AdminCodeListResponse>;
  getCode(id: string): Promise<RedemptionCode | null>;
  updateCode(
    id: string,
    updates: { isActive?: boolean; note?: string }
  ): Promise<RedemptionCode | null>;
  getRedemptions(codeId?: string, userId?: string): Promise<CodeRedemption[]>;
  redeemCode(
    code: string,
    userId: string,
    periodStart: string,
    monthlyLimit: number
  ): Promise<RedeemResult>;
}

// ============================================================
// In-memory implementation (local dev / demo mode)
// ============================================================

class InMemoryRedemptionService implements RedemptionService {
  private codes: Map<string, RedemptionCode> = new Map();
  private redemptions: Map<string, CodeRedemption[]> = new Map();

  async generateCodes(
    request: GenerateCodesRequest,
    createdBy: string
  ): Promise<GenerateCodesResult> {
    const codeStrings = generateCodes(request.count);
    const now = new Date().toISOString();
    const results: RedemptionCode[] = [];

    for (const codeStr of codeStrings) {
      const code: RedemptionCode = {
        id: `mem-${randomBytes(8).toString("hex")}`,
        code: codeStr,
        creditAmount: request.creditAmount,
        maxUses: request.maxUses,
        usedCount: 0,
        isActive: true,
        expiresAt: request.expiresAt,
        note: request.note,
        createdBy,
        createdAt: now
      };
      this.codes.set(code.id, code);
      this.codes.set(`code:${codeStr}`, code);
      results.push(code);
    }

    return {
      codes: results,
      totalGenerated: results.length,
      totalCredits: results.length * request.creditAmount * request.maxUses
    };
  }

  async listCodes(): Promise<AdminCodeListResponse> {
    const allCodes = Array.from(this.codes.values()).filter(
      (c) => !c.id.startsWith("code:")
    );
    const now = new Date();

    const total = allCodes.length;
    const active = allCodes.filter(
      (c) =>
        c.isActive &&
        c.usedCount < c.maxUses &&
        (!c.expiresAt || new Date(c.expiresAt) > now)
    ).length;
    const expired = allCodes.filter(
      (c) => c.expiresAt && new Date(c.expiresAt) <= now
    ).length;
    const depleted = allCodes.filter(
      (c) => c.isActive && c.usedCount >= c.maxUses
    ).length;
    const totalRedeemed = allCodes.reduce((sum, c) => sum + c.usedCount, 0);

    return {
      codes: allCodes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      stats: { total, active, expired, depleted, totalRedeemed }
    };
  }

  async getCode(id: string): Promise<RedemptionCode | null> {
    return this.codes.get(id) ?? null;
  }

  async updateCode(
    id: string,
    updates: { isActive?: boolean; note?: string }
  ): Promise<RedemptionCode | null> {
    const code = this.codes.get(id);
    if (!code) return null;

    if (updates.isActive !== undefined) {
      code.isActive = updates.isActive;
    }
    if (updates.note !== undefined) {
      code.note = updates.note;
    }

    this.codes.set(id, code);
    return code;
  }

  async getRedemptions(
    codeId?: string,
    userId?: string
  ): Promise<CodeRedemption[]> {
    let allRedemptions: CodeRedemption[] = [];
    for (const [, redemptions] of this.redemptions) {
      allRedemptions = allRedemptions.concat(redemptions);
    }

    if (codeId) {
      allRedemptions = allRedemptions.filter((r) => r.codeId === codeId);
    }
    if (userId) {
      allRedemptions = allRedemptions.filter((r) => r.userId === userId);
    }

    return allRedemptions.sort(
      (a, b) =>
        new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
    );
  }

  async redeemCode(
    codeInput: string,
    userId: string,
    periodStart: string,
    monthlyLimit: number
  ): Promise<RedeemResult> {
    const normalized = codeInput.trim().toUpperCase();
    const code = this.codes.get(`code:${normalized}`);

    if (!code) {
      return { success: false, codeId: null, creditAmount: 0, newRemaining: 0, errorMessage: "兑换码不存在或已失效" };
    }

    if (!code.isActive) {
      return { success: false, codeId: code.id, creditAmount: code.creditAmount, newRemaining: 0, errorMessage: "该兑换码已被停用" };
    }

    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return { success: false, codeId: code.id, creditAmount: code.creditAmount, newRemaining: 0, errorMessage: "该兑换码已过期" };
    }

    if (code.usedCount >= code.maxUses) {
      return { success: false, codeId: code.id, creditAmount: code.creditAmount, newRemaining: 0, errorMessage: "该兑换码使用次数已达上限" };
    }

    // Check user hasn't already redeemed
    const userRedemptions = this.redemptions.get(`user:${userId}`) ?? [];
    if (userRedemptions.some((r) => r.codeId === code.id)) {
      return { success: false, codeId: code.id, creditAmount: code.creditAmount, newRemaining: 0, errorMessage: "您已兑换过该兑换码" };
    }

    // Apply redemption
    code.usedCount += 1;
    this.codes.set(code.id, code);

    const redemption: CodeRedemption = {
      id: `mem-red-${randomBytes(8).toString("hex")}`,
      codeId: code.id,
      code: code.code,
      userId,
      creditAmount: code.creditAmount,
      redeemedAt: new Date().toISOString()
    };

    userRedemptions.push(redemption);
    this.redemptions.set(`user:${userId}`, userRedemptions);

    // Track by code
    const codeRedemptions = this.redemptions.get(`code:${code.id}`) ?? [];
    codeRedemptions.push(redemption);
    this.redemptions.set(`code:${code.id}`, codeRedemptions);

    const balance = await getUserCreditsService().addBonusCredits(
      userId,
      code.creditAmount,
      monthlyLimit
    );

    return {
      success: true,
      codeId: code.id,
      creditAmount: code.creditAmount,
      newRemaining: balance.remaining,
      errorMessage: null
    };
  }
}

// ============================================================
// Supabase implementation
// ============================================================

class SupabaseRedemptionService implements RedemptionService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
      "content-type": "application/json"
    };
  }

  async generateCodes(
    request: GenerateCodesRequest,
    createdBy: string
  ): Promise<GenerateCodesResult> {
    const codeStrings = generateCodes(request.count);

    // Insert in batches to avoid huge payloads
    const batchSize = 20;
    const results: RedemptionCode[] = [];

    for (let i = 0; i < codeStrings.length; i += batchSize) {
      const batch = codeStrings.slice(i, i + batchSize);
      const rows = batch.map((code) => ({
        code,
        credit_amount: request.creditAmount,
        max_uses: request.maxUses,
        expires_at: request.expiresAt,
        note: request.note,
        created_by: createdBy
      }));

      const response = await fetch(`${this.restUrl}/redemption_codes`, {
        method: "POST",
        headers: {
          ...this.headers(),
          prefer: "return=representation"
        },
        body: JSON.stringify(rows)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Failed to create redemption codes: ${response.status} ${errorText}`
        );
      }

      // Handle potential conflict (duplicate codes)
      const created = (await response.json()) as Array<{
        id: string;
        code: string;
        credit_amount: number;
        max_uses: number;
        used_count: number;
        is_active: boolean;
        expires_at: string | null;
        note: string | null;
        created_by: string | null;
        created_at: string;
      }>;

      for (const row of created) {
        results.push(toRedemptionCode(row));
      }
    }

    return {
      codes: results,
      totalGenerated: results.length,
      totalCredits: results.length * request.creditAmount * request.maxUses
    };
  }

  async listCodes(): Promise<AdminCodeListResponse> {
    const response = await fetch(
      `${this.restUrl}/redemption_codes?select=*&order=created_at.desc`,
      { headers: this.headers() }
    );

    if (!response.ok) {
      throw new Error(`Failed to list redemption codes: ${response.status}`);
    }

    const rows = (await response.json()) as Array<{
      id: string;
      code: string;
      credit_amount: number;
      max_uses: number;
      used_count: number;
      is_active: boolean;
      expires_at: string | null;
      note: string | null;
      created_by: string | null;
      created_at: string;
    }>;

    const codes = rows.map(toRedemptionCode);
    const now = new Date();

    const total = codes.length;
    const active = codes.filter(
      (c) =>
        c.isActive &&
        c.usedCount < c.maxUses &&
        (!c.expiresAt || new Date(c.expiresAt) > now)
    ).length;
    const expired = codes.filter(
      (c) => !!c.expiresAt && new Date(c.expiresAt) <= now
    ).length;
    const depleted = codes.filter(
      (c) => c.isActive && c.usedCount >= c.maxUses
    ).length;
    const totalRedeemed = codes.reduce((sum, c) => sum + c.usedCount, 0);

    return { codes, stats: { total, active, expired, depleted, totalRedeemed } };
  }

  async getCode(id: string): Promise<RedemptionCode | null> {
    const response = await fetch(
      `${this.restUrl}/redemption_codes?id=eq.${encodeURIComponent(id)}`,
      { headers: this.headers() }
    );

    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{
      id: string;
      code: string;
      credit_amount: number;
      max_uses: number;
      used_count: number;
      is_active: boolean;
      expires_at: string | null;
      note: string | null;
      created_by: string | null;
      created_at: string;
    }>;

    return rows[0] ? toRedemptionCode(rows[0]) : null;
  }

  async updateCode(
    id: string,
    updates: { isActive?: boolean; note?: string }
  ): Promise<RedemptionCode | null> {
    const body: Record<string, unknown> = {};
    if (updates.isActive !== undefined) body.is_active = updates.isActive;
    if (updates.note !== undefined) body.note = updates.note;

    const response = await fetch(
      `${this.restUrl}/redemption_codes?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...this.headers(), prefer: "return=representation" },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{
      id: string;
      code: string;
      credit_amount: number;
      max_uses: number;
      used_count: number;
      is_active: boolean;
      expires_at: string | null;
      note: string | null;
      created_by: string | null;
      created_at: string;
    }>;

    return rows[0] ? toRedemptionCode(rows[0]) : null;
  }

  async getRedemptions(
    codeId?: string,
    userId?: string
  ): Promise<CodeRedemption[]> {
    let query = `${this.restUrl}/code_redemptions?select=*&order=redeemed_at.desc`;

    if (codeId) {
      query += `&code_id=eq.${encodeURIComponent(codeId)}`;
    }
    if (userId) {
      query += `&user_id=eq.${encodeURIComponent(userId)}`;
    }

    const response = await fetch(query, { headers: this.headers() });

    if (!response.ok) return [];

    const rows = (await response.json()) as Array<{
      id: string;
      code_id: string;
      code: string;
      user_id: string;
      credit_amount: number;
      redeemed_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      codeId: r.code_id,
      code: r.code,
      userId: r.user_id,
      creditAmount: r.credit_amount,
      redeemedAt: r.redeemed_at
    }));
  }

  async redeemCode(
    codeInput: string,
    userId: string,
    periodStart: string,
    monthlyLimit: number
  ): Promise<RedeemResult> {
    const response = await fetch(`${this.restUrl}/rpc/redeem_code`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        p_code: codeInput,
        p_user_id: userId,
        p_period_start: periodStart,
        p_monthly_limit: monthlyLimit
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`redeem_code RPC failed: ${response.status} ${errorText}`);
    }

    const rows = (await response.json()) as Array<{
      success: boolean;
      code_id: string | null;
      credit_amount: number;
      new_remaining: number;
      error_message: string | null;
    }>;

    const row = rows[0];
    if (!row) {
      return { success: false, codeId: null, creditAmount: 0, newRemaining: 0, errorMessage: "服务器错误，请稍后重试" };
    }

    return {
      success: row.success,
      codeId: row.code_id,
      creditAmount: row.credit_amount,
      newRemaining: row.new_remaining,
      errorMessage: row.error_message
    };
  }
}

// ============================================================
// Fallback wrapper
// ============================================================

class FallbackRedemptionService implements RedemptionService {
  constructor(
    private readonly primary: RedemptionService,
    private readonly fallback: RedemptionService
  ) {}

  async generateCodes(request: GenerateCodesRequest, createdBy: string) {
    try {
      return await this.primary.generateCodes(request, createdBy);
    } catch (error) {
      console.warn("[redemption-fallback:generateCodes]", error);
      return this.fallback.generateCodes(request, createdBy);
    }
  }

  async listCodes() {
    try {
      return await this.primary.listCodes();
    } catch (error) {
      console.warn("[redemption-fallback:listCodes]", error);
      return this.fallback.listCodes();
    }
  }

  async getCode(id: string) {
    try {
      return await this.primary.getCode(id);
    } catch (error) {
      console.warn("[redemption-fallback:getCode]", error);
      return this.fallback.getCode(id);
    }
  }

  async updateCode(id: string, updates: { isActive?: boolean; note?: string }) {
    try {
      return await this.primary.updateCode(id, updates);
    } catch (error) {
      console.warn("[redemption-fallback:updateCode]", error);
      return this.fallback.updateCode(id, updates);
    }
  }

  async getRedemptions(codeId?: string, userId?: string) {
    try {
      return await this.primary.getRedemptions(codeId, userId);
    } catch (error) {
      console.warn("[redemption-fallback:getRedemptions]", error);
      return this.fallback.getRedemptions(codeId, userId);
    }
  }

  async redeemCode(
    code: string,
    userId: string,
    periodStart: string,
    monthlyLimit: number
  ) {
    try {
      return await this.primary.redeemCode(
        code,
        userId,
        periodStart,
        monthlyLimit
      );
    } catch (error) {
      console.warn("[redemption-fallback:redeemCode]", error);
      return this.fallback.redeemCode(
        code,
        userId,
        periodStart,
        monthlyLimit
      );
    }
  }
}

// ============================================================
// Factory
// ============================================================

export function getRedemptionService(): RedemptionService {
  const memoryService = new InMemoryRedemptionService();
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (supabaseUrl && serviceRoleKey) {
    return new FallbackRedemptionService(
      new SupabaseRedemptionService(supabaseUrl, serviceRoleKey),
      memoryService
    );
  }

  return memoryService;
}

// ============================================================
// Helper
// ============================================================

type SupabaseRedemptionCodeRow = {
  id: string;
  code: string;
  credit_amount: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

function toRedemptionCode(row: SupabaseRedemptionCodeRow): RedemptionCode {
  return {
    id: row.id,
    code: row.code,
    creditAmount: row.credit_amount,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import { getOrCreateUserAccount } from "@/lib/server/account-service";
import { getRedemptionService } from "@/lib/server/redemption-service";
import { apiHandler } from "@/lib/api/error-handler";

export const runtime = "nodejs";

function getCurrentPeriodStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json(
      { success: false, error: "请先登录后再兑换" },
      { status: 401 }
    );
  }

  // Admins don't need to redeem
  if (isAdminEmail(user.email)) {
    return NextResponse.json(
      { success: false, error: "管理员无需兑换额度" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { code: string };
  const code = body.code?.trim();

  if (!code) {
    return NextResponse.json(
      { success: false, error: "请输入兑换码" },
      { status: 400 }
    );
  }

  if (code.length < 4 || code.length > 50) {
    return NextResponse.json(
      { success: false, error: "兑换码格式不正确" },
      { status: 400 }
    );
  }

  // Rate-limit: simple attempt counter (in production, use Redis or DB)
  if (isRateLimited(request)) {
    return NextResponse.json(
      { success: false, error: "操作过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  // Get user's current account info for monthly limit
  const account = await getOrCreateUserAccount(user.id, user.email);
  const monthlyLimit = account.monthlyCreditLimit;

  const service = getRedemptionService();
  const periodStart = getCurrentPeriodStart();

  const result = await service.redeemCode(
    code,
    user.id,
    periodStart,
    monthlyLimit
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.errorMessage },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    creditAmount: result.creditAmount,
    newRemaining: result.newRemaining
  });
});

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX = 5; // 5 attempts per window

function isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Clean up old entries
  for (const [key, timestamp] of rateLimitMap) {
    if (timestamp < windowStart) {
      rateLimitMap.delete(key);
    }
  }

  // Count recent attempts from this IP
  let attempts = 0;
  for (const [key, timestamp] of rateLimitMap) {
    if (key.startsWith(ip) && timestamp > windowStart) {
      attempts++;
    }
  }

  if (attempts >= RATE_LIMIT_MAX) {
    return true;
  }

  rateLimitMap.set(`${ip}:${now}`, now);
  return false;
}

import { NextRequest, NextResponse } from "next/server";
import { FREE_USER_MONTHLY_CREDITS, GUEST_CREDIT_LIMIT } from "@/lib/credits/constants";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import {
  getDefaultMonthlyLimit,
  getOrCreateUserAccount
} from "@/lib/server/account-service";
import { apiHandler } from "@/lib/api/error-handler";
import type { AccountStatus } from "@/types/account";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json<AccountStatus>(guestStatus());
  }

  const isAdmin = isAdminEmail(user.email);
  const account = await getOrCreateUserAccount(user.id, user.email);
  const accountType = isAdmin ? "admin" : account.accountType;

  return NextResponse.json<AccountStatus>({
    accountType,
    isAuthenticated: true,
    isAdmin,
    user,
    credits: {
      monthlyLimit: isAdmin
        ? getDefaultMonthlyLimit("admin")
        : account.monthlyCreditLimit,
      guestLimit: GUEST_CREDIT_LIMIT,
      adminBypass: isAdmin
    }
  });
});

function guestStatus(): AccountStatus {
  return {
    accountType: "guest",
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    credits: {
      monthlyLimit: FREE_USER_MONTHLY_CREDITS,
      guestLimit: GUEST_CREDIT_LIMIT,
      adminBypass: false
    }
  };
}

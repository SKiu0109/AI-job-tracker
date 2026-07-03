import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  getBearerToken,
  verifySupabaseAccessToken,
  type VerifiedAuthUser
} from "@/lib/auth/server-auth";
import { shouldAutoMigrateGuestCreditsToUser } from "@/lib/credits/credit-policy";
import { JD_ANALYSIS_CREDIT_COST } from "@/lib/credits/constants";
import {
  getOrCreateUserAccount,
  type ServerAccountRecord
} from "@/lib/server/account-service";
import { getCreditsService } from "@/lib/server/credits-service";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import {
  createAdminCreditBalance,
  getUserCreditsService
} from "@/lib/server/user-credits-service";
import type { CreditBalance } from "@/types/credits";

export type AiCreditContext = {
  authUser: VerifiedAuthUser | null;
  currentCredits: CreditBalance;
  guestId: string;
  isAdmin: boolean;
  shouldApplyGuestCookie: boolean;
  userAccount: ServerAccountRecord | null;
};

export type AiCreditReservation =
  | { kind: "admin"; balance: CreditBalance }
  | {
      kind: "user";
      userId: string;
      monthlyLimit: number;
      balance: CreditBalance;
      spentBonus: number;
      spentMonthly: number;
    }
  | { kind: "guest"; guestId: string; balance: CreditBalance };

export async function createAiCreditContext(request: Request) {
  const cookieStore = await cookies();
  const guestSession = getOrCreateGuestSession(
    cookieStore.get(GUEST_ID_COOKIE)?.value
  );
  const authUser = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );
  const isAdmin = isAdminEmail(authUser?.email);
  const userAccount =
    authUser && !isAdmin
      ? await getOrCreateUserAccount(authUser.id, authUser.email)
      : null;

  if (
    shouldAutoMigrateGuestCreditsToUser() &&
    authUser &&
    userAccount &&
    !guestSession.isNew
  ) {
    await getUserCreditsService().migrateGuestCredits(
      authUser.id,
      guestSession.guestId,
      userAccount.monthlyCreditLimit
    );
  }

  const currentCredits = isAdmin
    ? createAdminCreditBalance()
    : authUser && userAccount
      ? await getUserCreditsService().getBalance(
          authUser.id,
          userAccount.monthlyCreditLimit
        )
      : await getCreditsService().getBalance(guestSession.guestId);

  return {
    authUser,
    currentCredits,
    guestId: guestSession.guestId,
    isAdmin,
    shouldApplyGuestCookie: !authUser || !guestSession.isNew,
    userAccount
  } satisfies AiCreditContext;
}

export function applyAiCreditCookie(
  response: NextResponse,
  context: AiCreditContext
) {
  if (context.shouldApplyGuestCookie) {
    applyGuestSessionCookie(response, context.guestId);
  }
  return response;
}

export function createAiCreditResponse(
  context: AiCreditContext,
  payload: Record<string, unknown>,
  init?: ResponseInit
) {
  return applyAiCreditCookie(NextResponse.json(payload, init), context);
}

export async function reserveAiCredit(
  context: AiCreditContext
): Promise<AiCreditReservation | null> {
  if (context.isAdmin) {
    return {
      kind: "admin",
      balance: context.currentCredits
    };
  }

  if (context.authUser && context.userAccount) {
    const balance = await getUserCreditsService().trySpend(
      context.authUser.id,
      JD_ANALYSIS_CREDIT_COST,
      context.userAccount.monthlyCreditLimit
    );

    return balance
      ? {
          kind: "user",
          userId: context.authUser.id,
          monthlyLimit: context.userAccount.monthlyCreditLimit,
          balance,
          spentBonus: balance.spentBonus ?? 0,
          spentMonthly: balance.spentMonthly ?? JD_ANALYSIS_CREDIT_COST
        }
      : null;
  }

  const balance = await getCreditsService().trySpend(
    context.guestId,
    JD_ANALYSIS_CREDIT_COST
  );

  return balance
    ? {
        kind: "guest",
        guestId: context.guestId,
        balance
      }
    : null;
}

export async function refundAiCredit(reservation: AiCreditReservation) {
  if (reservation.kind === "admin") {
    return;
  }

  if (reservation.kind === "user") {
    await getUserCreditsService().refund(
      reservation.userId,
      JD_ANALYSIS_CREDIT_COST,
      reservation.monthlyLimit,
      {
        bonus: reservation.spentBonus,
        monthly: reservation.spentMonthly
      }
    );
    return;
  }

  await getCreditsService().refund(
    reservation.guestId,
    JD_ANALYSIS_CREDIT_COST
  );
}

export async function getLatestAiCredits(context: AiCreditContext) {
  if (context.isAdmin) {
    return createAdminCreditBalance();
  }

  if (context.authUser && context.userAccount) {
    return getUserCreditsService().getBalance(
      context.authUser.id,
      context.userAccount.monthlyCreditLimit
    );
  }

  return getCreditsService().getBalance(context.guestId);
}

export function toPublicCredits(balance: CreditBalance) {
  return {
    remaining: balance.remaining,
    limit: balance.limit,
    monthlyRemaining: balance.monthlyRemaining,
    monthlyLimit: balance.monthlyLimit,
    bonusRemaining: balance.bonusRemaining,
    costPerAnalysis: balance.costPerAnalysis,
    store: balance.store
  };
}

import "server-only";

import {
  FREE_USER_MONTHLY_CREDITS,
  PAID_USER_MONTHLY_CREDITS
} from "@/lib/credits/constants";
import type { AccountType } from "@/types/account";

type UserAccountRow = {
  user_id: string;
  email: string;
  account_type: AccountType;
  monthly_credit_limit: number;
  created_at: string;
  updated_at: string;
};

export type ServerAccountRecord = {
  userId: string;
  email: string;
  accountType: AccountType;
  monthlyCreditLimit: number;
};

export async function getOrCreateUserAccount(
  userId: string,
  email: string
): Promise<ServerAccountRecord> {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      userId,
      email,
      accountType: "free",
      monthlyCreditLimit: FREE_USER_MONTHLY_CREDITS
    };
  }

  const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  const existing = await fetch(
    `${restUrl}/user_accounts?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,account_type,monthly_credit_limit,created_at,updated_at`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      }
    }
  );

  if (existing.ok) {
    const rows = (await existing.json()) as UserAccountRow[];

    if (rows[0]) {
      return toAccountRecord(rows[0]);
    }
  }

  const created = await fetch(`${restUrl}/user_accounts`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      user_id: userId,
      email,
      account_type: "free",
      monthly_credit_limit: FREE_USER_MONTHLY_CREDITS
    })
  });

  if (!created.ok) {
    console.warn("[account-service:fallback]", await created.text().catch(() => ""));
    return {
      userId,
      email,
      accountType: "free",
      monthlyCreditLimit: FREE_USER_MONTHLY_CREDITS
    };
  }

  const rows = (await created.json()) as UserAccountRow[];
  return rows[0]
    ? toAccountRecord(rows[0])
    : {
        userId,
        email,
        accountType: "free",
        monthlyCreditLimit: FREE_USER_MONTHLY_CREDITS
      };
}

export function getDefaultMonthlyLimit(accountType: AccountType) {
  if (accountType === "paid") {
    return PAID_USER_MONTHLY_CREDITS;
  }

  if (accountType === "admin") {
    return Number.MAX_SAFE_INTEGER;
  }

  return FREE_USER_MONTHLY_CREDITS;
}

function toAccountRecord(row: UserAccountRow): ServerAccountRecord {
  return {
    userId: row.user_id,
    email: row.email,
    accountType: row.account_type,
    monthlyCreditLimit:
      row.monthly_credit_limit ?? getDefaultMonthlyLimit(row.account_type)
  };
}

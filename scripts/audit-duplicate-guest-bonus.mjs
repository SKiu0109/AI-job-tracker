#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_SIZE = 1000;
const DEFAULT_ENV_FILE = ".env.local";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const json = args.has("--json");
const envArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--env-file="));
const envFile = envArg ? envArg.slice("--env-file=".length) : DEFAULT_ENV_FILE;

loadEnvFile(resolve(process.cwd(), envFile));

const supabaseUrl = firstNonEmpty(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
const serviceRoleKey = firstNonEmpty(
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

const [wallets, migrations, redemptions] = await Promise.all([
  fetchAll("user_credit_wallets", "user_id,bonus_remaining,updated_at"),
  fetchAll("guest_credit_migrations", "guest_id,user_id,migrated_amount,created_at"),
  fetchAll("code_redemptions", "user_id,credit_amount,redeemed_at")
]);

const redemptionTotals = sumByUser(redemptions, "credit_amount");
const migrationsByUser = groupByUser(migrations);

const candidates = wallets
  .map((wallet) => {
    const userId = wallet.user_id;
    const positiveMigrations = (migrationsByUser.get(userId) ?? [])
      .filter((row) => Number(row.migrated_amount ?? 0) > 0)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    const allowedLegacyAmount = Number(
      positiveMigrations[0]?.migrated_amount ?? 0
    );
    const duplicateGuestBonus = positiveMigrations
      .slice(1)
      .reduce((sum, row) => sum + Number(row.migrated_amount ?? 0), 0);
    const currentBonus = Number(wallet.bonus_remaining ?? 0);
    const redeemedBonus = redemptionTotals.get(userId) ?? 0;
    const protectedBonus = redeemedBonus + allowedLegacyAmount;
    const conservativeAvailable = Math.max(0, currentBonus - protectedBonus);
    const proposedDeduction = Math.min(
      currentBonus,
      duplicateGuestBonus,
      conservativeAvailable
    );
    const unresolvedDuplicateBonus = Math.max(
      0,
      duplicateGuestBonus - proposedDeduction
    );

    return {
      userId,
      maskedUserId: maskId(userId),
      currentBonus,
      redeemedBonus,
      migrationCount: positiveMigrations.length,
      allowedLegacyAmount,
      protectedBonus,
      duplicateGuestBonus,
      proposedDeduction,
      unresolvedDuplicateBonus,
      newBonus: currentBonus - proposedDeduction
    };
  })
  .filter((row) => row.duplicateGuestBonus > 0)
  .sort((a, b) => b.proposedDeduction - a.proposedDeduction);

if (apply) {
  for (const candidate of candidates) {
    if (candidate.proposedDeduction <= 0) continue;
    await updateWallet(candidate.userId, candidate.newBonus);
  }
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  checkedWallets: wallets.length,
  checkedMigrations: migrations.length,
  checkedRedemptions: redemptions.length,
  affectedUsers: candidates.length,
  usersUpdated: candidates.filter((row) => row.proposedDeduction > 0).length,
  duplicateGuestBonus: sum(candidates, "duplicateGuestBonus"),
  proposedDeduction: sum(candidates, "proposedDeduction"),
  unresolvedDuplicateBonus: sum(candidates, "unresolvedDuplicateBonus")
};

if (json) {
  console.log(JSON.stringify({ summary, candidates }, null, 2));
} else {
  printHumanSummary(summary, candidates);
}

async function fetchAll(table, select) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const url = new URL(`${restUrl}/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(from));

    const response = await fetch(url, {
      headers: serviceHeaders()
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to read ${table}: ${response.status} ${body}`);
    }

    const page = await response.json();
    rows.push(...page);

    if (page.length < PAGE_SIZE) return rows;
    if (to > 100_000) {
      throw new Error(`Refusing to paginate ${table} beyond ${to} rows.`);
    }
  }
}

async function updateWallet(userId, newBonus) {
  const url = new URL(`${restUrl}/user_credit_wallets`);
  url.searchParams.set("user_id", `eq.${userId}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(),
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify({
      bonus_remaining: newBonus,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to update wallet ${maskId(userId)}: ${response.status} ${body}`
    );
  }
}

function serviceHeaders() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`
  };
}

function groupByUser(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const userId = row.user_id;
    if (!userId) continue;
    const current = grouped.get(userId) ?? [];
    current.push(row);
    grouped.set(userId, current);
  }
  return grouped;
}

function sumByUser(rows, field) {
  const totals = new Map();
  for (const row of rows) {
    const userId = row.user_id;
    if (!userId) continue;
    totals.set(userId, (totals.get(userId) ?? 0) + Number(row[field] ?? 0));
  }
  return totals;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function printHumanSummary(summary, candidates) {
  console.log(
    `${summary.mode === "apply" ? "Applied" : "Dry run"} duplicate guest bonus cleanup`
  );
  console.log(`Checked wallets: ${summary.checkedWallets}`);
  console.log(`Checked guest migrations: ${summary.checkedMigrations}`);
  console.log(`Checked code redemptions: ${summary.checkedRedemptions}`);
  console.log(`Affected users: ${summary.affectedUsers}`);
  console.log(`Users ${summary.mode === "apply" ? "updated" : "to update"}: ${summary.usersUpdated}`);
  console.log(`Duplicate guest bonus detected: ${summary.duplicateGuestBonus}`);
  console.log(`Bonus ${summary.mode === "apply" ? "deducted" : "to deduct"}: ${summary.proposedDeduction}`);
  console.log(`Unresolved duplicate bonus kept conservatively: ${summary.unresolvedDuplicateBonus}`);

  if (candidates.length === 0) return;

  console.log("\nCandidates:");
  for (const candidate of candidates.slice(0, 50)) {
    console.log(
      [
        candidate.maskedUserId,
        `migrations=${candidate.migrationCount}`,
        `current=${candidate.currentBonus}`,
        `redeemed=${candidate.redeemedBonus}`,
        `duplicate=${candidate.duplicateGuestBonus}`,
        `deduct=${candidate.proposedDeduction}`,
        `new=${candidate.newBonus}`,
        `unresolved=${candidate.unresolvedDuplicateBonus}`
      ].join(" ")
    );
  }

  if (candidates.length > 50) {
    console.log(`... ${candidates.length - 50} more candidates omitted`);
  }
}

function loadEnvFile(path) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = parseEnvValue(rawValue);
  }
}

function parseEnvValue(rawValue) {
  let value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function firstNonEmpty(...values) {
  return values.find((value) => value?.trim())?.trim();
}

function maskId(id) {
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

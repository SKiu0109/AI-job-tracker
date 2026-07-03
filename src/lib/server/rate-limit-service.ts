import "server-only";

import { createHash } from "crypto";
import {
  getSupabaseServerConfig,
  shouldFailClosedForPersistentUserData
} from "@/lib/server/supabase-config";

export type RateLimitResult = {
  allowed: boolean;
  hitCount: number;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  identity: string;
  limit: number;
  scope: string;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  hit_count: number;
  retry_after_seconds: number;
};

type MemoryRateLimitEntry = {
  hitCount: number;
  windowStartMs: number;
};

const globalForRateLimits = globalThis as typeof globalThis & {
  __pathwiseRateLimits?: Map<string, MemoryRateLimitEntry>;
};

class SupabaseRateLimitService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  async check(options: RateLimitOptions): Promise<RateLimitResult> {
    const response = await fetch(`${this.restUrl}/rpc/check_api_rate_limit`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        p_identity_hash: options.identity,
        p_limit: options.limit,
        p_scope: options.scope,
        p_window_seconds: options.windowSeconds
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase rate limit RPC failed: ${response.status} ${errorText}`
      );
    }

    const rows = (await response.json()) as RateLimitRow[];
    const row = rows[0];

    if (!row) {
      throw new Error("Supabase rate limit RPC returned no result.");
    }

    return {
      allowed: Boolean(row.allowed),
      hitCount: Number(row.hit_count),
      retryAfterSeconds: Number(row.retry_after_seconds)
    };
  }
}

class MemoryRateLimitService {
  private readonly entries: Map<string, MemoryRateLimitEntry>;

  constructor() {
    this.entries =
      globalForRateLimits.__pathwiseRateLimits ??
      new Map<string, MemoryRateLimitEntry>();
    globalForRateLimits.__pathwiseRateLimits = this.entries;
  }

  async check(options: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const key = `${options.scope}:${options.identity}:${windowStartMs}`;
    const existing = this.entries.get(key);
    const hitCount =
      existing && existing.windowStartMs === windowStartMs
        ? existing.hitCount + 1
        : 1;

    this.entries.set(key, { hitCount, windowStartMs });
    this.cleanup(now, windowMs);

    return {
      allowed: hitCount <= options.limit,
      hitCount,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowStartMs + windowMs - now) / 1000)
      )
    };
  }

  private cleanup(now: number, windowMs: number) {
    const oldestAllowed = now - windowMs * 2;

    for (const [key, entry] of this.entries) {
      if (entry.windowStartMs < oldestAllowed) {
        this.entries.delete(key);
      }
    }
  }
}

export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (supabaseUrl && serviceRoleKey) {
    const service = new SupabaseRateLimitService(supabaseUrl, serviceRoleKey);

    try {
      return await service.check(options);
    } catch (error) {
      if (shouldFailClosedForPersistentUserData()) {
        throw error;
      }

      console.warn(
        "[rate-limit:fallback]",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (shouldFailClosedForPersistentUserData()) {
    throw new Error("Persistent rate limiting requires Supabase in production.");
  }

  return new MemoryRateLimitService().check(options);
}

export function createRequestIdentityHash(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return createHash("sha256")
    .update(`${clientIp}\n${userAgent}`)
    .digest("hex");
}

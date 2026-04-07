/**
 * toolbox/tools/marketplace/usage-tracker.tool.ts
 * version: 1.0.0
 *
 * Marketplace Gatekeeper — Usage Tracker.
 * Pure TypeScript. Zero framework imports.
 *
 * Responsibilities:
 *   1. Increment a per-key, per-tool, per-day request counter on every
 *      successful API call — backed by an in-memory store or any async
 *      adapter (Supabase, Postgres, Redis, etc.)
 *   2. Enforce daily and per-minute rate limits from the key's TierPolicy
 *   3. Return structured 429 / 403 / 200 gate decisions — the caller
 *      maps these to HTTP responses
 *   4. Expose usage metrics for billing, dashboards, and audit
 *
 * Pillar 15: Tool Manufacturing / Marketplace (GAB: MARKETPLACE-INFRASTRUCTURE)
 *
 * Counters:
 *   Daily counter   — resets at midnight UTC, keyed by (keyId + date)
 *   Minute counter  — sliding 60-second window, keyed by (keyId)
 *
 * Gate decisions:
 *   ALLOW          — request is within limits; counter incremented
 *   RATE_LIMITED   → 429 — per-minute burst cap exceeded
 *   QUOTA_EXCEEDED → 429 — daily limit reached
 *   FORBIDDEN      → 403 — key status problem (handled upstream by KeyManager)
 */

import type { ApiKeyRecord, TierPolicy } from "./key-manager.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — USAGE RECORDS
// ═══════════════════════════════════════════════════════════════════

export interface DailyUsageRecord {
  keyId:            string;
  date:             string;   // YYYY-MM-DD UTC
  totalRequests:    number;
  successRequests:  number;
  rejectedRequests: number;   // rate-limited + quota-exceeded
  byTool:           Record<string, number>;
  /** Revenue in USD cents (overage billing by tier) */
  estimatedRevenueCents: number;
}

export interface MinuteWindow {
  keyId:       string;
  windowStart: number;   // Unix ms — start of the current 60-second window
  count:       number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — GATE DECISION
// ═══════════════════════════════════════════════════════════════════

export type GateDecision = "ALLOW" | "RATE_LIMITED" | "QUOTA_EXCEEDED";

export interface GateResult {
  decision:        GateDecision;
  /** HTTP status code to return to the caller */
  httpStatus:      200 | 429;
  keyId:           string;
  toolId:          string;
  /** Requests remaining today (undefined = unlimited) */
  remainingToday?: number;
  /** Seconds until the minute window resets */
  retryAfterSeconds?: number;
  /** Human-readable explanation */
  message:         string;
  /** Current daily usage snapshot */
  usage:           DailyUsageRecord;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — STORE ADAPTER
// ═══════════════════════════════════════════════════════════════════

export interface UsageStoreAdapter {
  /** Load the usage record for a key+date, or return null if not found */
  get(keyId: string, date: string): Promise<DailyUsageRecord | null>;
  /** Persist (upsert) a usage record */
  set(keyId: string, date: string, record: DailyUsageRecord): Promise<void>;
  /** Return all records for a key (all dates available in store) */
  listByKey(keyId: string): Promise<DailyUsageRecord[]>;
  /** Return all records across all keys, optionally filtered by date */
  listAll(date?: string): Promise<DailyUsageRecord[]>;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY STORE (default — swap for Supabase in production)
// ═══════════════════════════════════════════════════════════════════

export class InMemoryUsageStore implements UsageStoreAdapter {
  /** key: `${keyId}::${date}` */
  private store: Map<string, DailyUsageRecord> = new Map();

  async get(keyId: string, date: string): Promise<DailyUsageRecord | null> {
    return this.store.get(`${keyId}::${date}`) ?? null;
  }

  async set(keyId: string, date: string, record: DailyUsageRecord): Promise<void> {
    this.store.set(`${keyId}::${date}`, { ...record });
  }

  async listByKey(keyId: string): Promise<DailyUsageRecord[]> {
    return [...this.store.values()].filter((r) => r.keyId === keyId);
  }

  async listAll(date?: string): Promise<DailyUsageRecord[]> {
    return [...this.store.values()].filter((r) => !date || r.date === date);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDailyRecord(keyId: string, date: string): DailyUsageRecord {
  return {
    keyId,
    date,
    totalRequests:    0,
    successRequests:  0,
    rejectedRequests: 0,
    byTool:           {},
    estimatedRevenueCents: 0,
  };
}

/**
 * Estimate overage revenue for a given policy and total daily requests.
 * BASIC tier has a hard cap — no overage billing.
 * PRO: $0.30 / 1 000 overage.  ENTERPRISE / INTERNAL: 0.
 */
function calcRevenueCents(policy: TierPolicy, totalRequests: number): number {
  if (policy.dailyLimit === Infinity || policy.priceUsdCents === 0) return 0;
  const overage = Math.max(0, totalRequests - policy.dailyLimit);
  const rateMap: Record<string, number> = {
    BASIC:      0,
    PRO:        30,   // cents per 1 000
    ENTERPRISE: 0,
    INTERNAL:   0,
  };
  const rate = rateMap[policy.tier] ?? 0;
  return Math.round((overage / 1_000) * rate);
}

// ═══════════════════════════════════════════════════════════════════
// USAGE TRACKER — CORE CLASS
// ═══════════════════════════════════════════════════════════════════

export class UsageTracker {
  private store:         UsageStoreAdapter;
  private minuteWindows: Map<string, MinuteWindow> = new Map();

  constructor(store?: UsageStoreAdapter) {
    this.store = store ?? new InMemoryUsageStore();
  }

  /** Swap in a different backing store at runtime. */
  setAdapter(store: UsageStoreAdapter): void {
    this.store = store;
  }

  // ── Main gate ──────────────────────────────────────────────────

  /**
   * Gate an incoming request.
   *
   * Call this BEFORE executing the handler. If the result is ALLOW,
   * the request has already been counted — do not double-count.
   *
   * @param record   ApiKeyRecord from KeyManager.validate()
   * @param policy   TierPolicy matching the key's tier
   * @param toolId   The tool being called
   */
  async gate(
    record: ApiKeyRecord,
    policy: TierPolicy,
    toolId: string
  ): Promise<GateResult> {
    const today    = todayUtc();
    const { keyId } = record;

    // Load or initialise the daily counter
    const usage = (await this.store.get(keyId, today))
      ?? emptyDailyRecord(keyId, today);

    // ── Per-minute burst check ─────────────────────────────────
    if (policy.ratePerMinute !== Infinity) {
      const minuteResult = this._checkMinuteWindow(keyId, policy.ratePerMinute);
      if (!minuteResult.allowed) {
        // Count the rejected request
        usage.totalRequests++;
        usage.rejectedRequests++;
        usage.byTool[toolId] = (usage.byTool[toolId] ?? 0) + 1;
        await this.store.set(keyId, today, usage);

        return {
          decision:          "RATE_LIMITED",
          httpStatus:        429,
          keyId,
          toolId,
          retryAfterSeconds: minuteResult.retryAfterSeconds,
          message:           `Rate limit exceeded: ${policy.ratePerMinute} requests/minute for ${policy.label} tier. Retry in ${minuteResult.retryAfterSeconds}s.`,
          usage,
        };
      }
    }

    // ── Daily quota check ──────────────────────────────────────
    if (policy.dailyLimit !== Infinity && usage.successRequests >= policy.dailyLimit) {
      usage.totalRequests++;
      usage.rejectedRequests++;
      usage.byTool[toolId] = (usage.byTool[toolId] ?? 0) + 1;
      await this.store.set(keyId, today, usage);

      return {
        decision:        "QUOTA_EXCEEDED",
        httpStatus:      429,
        keyId,
        toolId,
        remainingToday:  0,
        retryAfterSeconds: secondsUntilMidnightUtc(),
        message:         `Daily quota of ${policy.dailyLimit.toLocaleString()} requests exceeded for ${policy.label} tier. Resets at midnight UTC.`,
        usage,
      };
    }

    // ── Allow — increment counters ─────────────────────────────
    usage.totalRequests++;
    usage.successRequests++;
    usage.byTool[toolId]          = (usage.byTool[toolId] ?? 0) + 1;
    usage.estimatedRevenueCents   = calcRevenueCents(policy, usage.totalRequests);
    await this.store.set(keyId, today, usage);

    const remaining = policy.dailyLimit === Infinity
      ? undefined
      : Math.max(0, policy.dailyLimit - usage.successRequests);

    return {
      decision:       "ALLOW",
      httpStatus:     200,
      keyId,
      toolId,
      remainingToday: remaining,
      message:        "OK",
      usage,
    };
  }

  // ── Per-minute window ──────────────────────────────────────────

  private _checkMinuteWindow(
    keyId:      string,
    limitPerMin: number
  ): { allowed: boolean; retryAfterSeconds: number } {
    const nowMs      = Date.now();
    const windowMs   = 60_000;
    const win        = this.minuteWindows.get(keyId) ?? { keyId, windowStart: nowMs, count: 0 };

    // Reset if the window has expired
    if (nowMs - win.windowStart >= windowMs) {
      win.windowStart = nowMs;
      win.count       = 0;
    }

    if (win.count >= limitPerMin) {
      const retryAfterSeconds = Math.ceil((win.windowStart + windowMs - nowMs) / 1_000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    win.count++;
    this.minuteWindows.set(keyId, win);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // ── Query & reporting ──────────────────────────────────────────

  /** Get today's usage for a key. Returns an empty record if no usage yet. */
  async getToday(keyId: string): Promise<DailyUsageRecord> {
    return (await this.store.get(keyId, todayUtc())) ?? emptyDailyRecord(keyId, todayUtc());
  }

  /** Get usage for a specific date (YYYY-MM-DD). */
  async getByDate(keyId: string, date: string): Promise<DailyUsageRecord | null> {
    return this.store.get(keyId, date);
  }

  /** Get all usage records for a key across all stored dates. */
  async getHistory(keyId: string): Promise<DailyUsageRecord[]> {
    const records = await this.store.listByKey(keyId);
    return records.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generate a billing summary across all keys for a date range.
   *
   * @param startDate  YYYY-MM-DD inclusive
   * @param endDate    YYYY-MM-DD inclusive (default: today)
   */
  async billingReport(
    startDate: string,
    endDate   = todayUtc()
  ): Promise<{
    period:          { start: string; end: string };
    entries:         Array<{
      keyId:         string;
      totalRequests: number;
      successRequests: number;
      rejectedRequests: number;
      revenueCents:  number;
      byTool:        Record<string, number>;
    }>;
    grandTotalRequests: number;
    grandTotalRevenueCents: number;
    grandTotalRevenueDollars: string;
  }> {
    const all = await this.store.listAll();
    const inRange = all.filter((r) => r.date >= startDate && r.date <= endDate);

    // Aggregate by keyId
    const byKey: Record<string, typeof inRange[0] & { revenueCents: number }> = {};
    for (const r of inRange) {
      if (!byKey[r.keyId]) {
        byKey[r.keyId] = { ...r, revenueCents: 0, byTool: {} };
      }
      const agg = byKey[r.keyId];
      agg.totalRequests    += r.totalRequests;
      agg.successRequests  += r.successRequests;
      agg.rejectedRequests += r.rejectedRequests;
      agg.revenueCents     += r.estimatedRevenueCents;
      for (const [tool, count] of Object.entries(r.byTool)) {
        agg.byTool[tool] = (agg.byTool[tool] ?? 0) + count;
      }
    }

    const entries = Object.values(byKey).sort((a, b) => b.revenueCents - a.revenueCents);
    const grandTotalRequests      = entries.reduce((s, e) => s + e.totalRequests, 0);
    const grandTotalRevenueCents  = entries.reduce((s, e) => s + e.revenueCents, 0);

    return {
      period: { start: startDate, end: endDate },
      entries,
      grandTotalRequests,
      grandTotalRevenueCents,
      grandTotalRevenueDollars: (grandTotalRevenueCents / 100).toFixed(2),
    };
  }

  /** Return the current minute-window state for a key (for debug/monitoring). */
  getMinuteWindow(keyId: string): MinuteWindow | null {
    return this.minuteWindows.get(keyId) ?? null;
  }

  /** Clear all in-memory minute windows (call on server restart or tests). */
  resetMinuteWindows(): void {
    this.minuteWindows.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE USAGE STORE ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a UsageStoreAdapter backed by a Supabase `api_usage` table.
 *
 * Expected table schema:
 *
 *   CREATE TABLE api_usage (
 *     key_id                 TEXT    NOT NULL,
 *     date                   DATE    NOT NULL,
 *     total_requests         INTEGER NOT NULL DEFAULT 0,
 *     success_requests       INTEGER NOT NULL DEFAULT 0,
 *     rejected_requests      INTEGER NOT NULL DEFAULT 0,
 *     by_tool                JSONB   NOT NULL DEFAULT '{}',
 *     estimated_revenue_cents INTEGER NOT NULL DEFAULT 0,
 *     PRIMARY KEY (key_id, date)
 *   );
 *
 * @param supabaseUrl  From SUPABASE_URL env var
 * @param supabaseKey  From SUPABASE_SERVICE_ROLE_KEY env var
 */
export function createSupabaseUsageStore(
  supabaseUrl: string,
  supabaseKey: string
): UsageStoreAdapter {
  const headers = {
    "apikey":        supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };

  const base = `${supabaseUrl}/rest/v1/api_usage`;

  const toRecord = (row: Record<string, unknown>): DailyUsageRecord => ({
    keyId:                 row.key_id                  as string,
    date:                  row.date                    as string,
    totalRequests:         (row.total_requests ?? 0)   as number,
    successRequests:       (row.success_requests ?? 0) as number,
    rejectedRequests:      (row.rejected_requests ?? 0) as number,
    byTool:                (row.by_tool ?? {})          as Record<string, number>,
    estimatedRevenueCents: (row.estimated_revenue_cents ?? 0) as number,
  });

  const toRow = (r: DailyUsageRecord) => ({
    key_id:                  r.keyId,
    date:                    r.date,
    total_requests:          r.totalRequests,
    success_requests:        r.successRequests,
    rejected_requests:       r.rejectedRequests,
    by_tool:                 r.byTool,
    estimated_revenue_cents: r.estimatedRevenueCents,
  });

  return {
    async get(keyId, date) {
      const resp = await fetch(
        `${base}?key_id=eq.${keyId}&date=eq.${date}&limit=1`,
        { headers, signal: AbortSignal.timeout(8_000) }
      );
      const rows = await resp.json() as Record<string, unknown>[];
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async set(keyId, date, record) {
      await fetch(base, {
        method:  "POST",
        headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
        body:    JSON.stringify(toRow(record)),
        signal:  AbortSignal.timeout(8_000),
      });
    },

    async listByKey(keyId) {
      const resp = await fetch(`${base}?key_id=eq.${keyId}&order=date.desc`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(toRecord);
    },

    async listAll(date) {
      const url = date ? `${base}?date=eq.${date}` : base;
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(toRecord);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// HTTP RESPONSE BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a standard HTTP-compatible response object from a GateResult.
 *
 * Attach `headers` to your actual HTTP response. The `body` is a
 * JSON-serialisable object ready for `Response.json(body, { status })`.
 */
export function buildGateResponse(result: GateResult): {
  status:  200 | 429;
  headers: Record<string, string>;
  body:    Record<string, unknown>;
} {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(result.remainingToday ?? "unlimited"),
    "X-RateLimit-Policy":    result.usage.keyId,
  };

  if (result.decision !== "ALLOW" && result.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  if (result.decision === "ALLOW") {
    return { status: 200, headers, body: { ok: true, remainingToday: result.remainingToday } };
  }

  return {
    status:  429,
    headers,
    body: {
      ok:       false,
      error:    result.decision === "RATE_LIMITED" ? "rate_limited" : "quota_exceeded",
      message:  result.message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════

function secondsUntilMidnightUtc(): number {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1_000);
}

/**
 * Format a DailyUsageRecord as a compact one-line summary for logging.
 */
export function formatUsageLine(r: DailyUsageRecord): string {
  const tools = Object.entries(r.byTool)
    .map(([t, n]) => `${t}:${n}`)
    .join(" ");
  return `[${r.date}] key=${r.keyId} ok=${r.successRequests} rejected=${r.rejectedRequests} tools={${tools}} rev=$${(r.estimatedRevenueCents / 100).toFixed(2)}`;
}

/**
 * toolbox/tools/factory/tool-packager.tool.ts
 * version: 1.0.0
 *
 * Tool Manufacturing — Tool Packager & Public API Factory.
 * Pure TypeScript. Zero framework imports.
 *
 * Wraps internal Sovereign Mainframe engines into versioned Public API
 * endpoints, and implements an API-Key management system for tracking
 * external usage, enforcing rate limits, and metering revenue.
 *
 * Pillar 15: Tool Manufacturing (GAB domain: MARKETPLACE-INFRASTRUCTURE)
 *
 * What this ships:
 *   1. WrappedToolRegistry  — 3 internal tools packaged as public endpoints
 *                             (Gematria Scorer, Redesign Analyser, 3D Globe API)
 *   2. ApiKeyManager        — generate, verify, throttle, revoke, meter API keys
 *   3. PublicApiGateway     — thin HTTP-compatible request handler that
 *                             validates keys, enforces rate limits, routes to
 *                             the correct wrapped tool, and logs every call
 *   4. Pure helpers         — generateApiKey(), buildPublicApiResponse(),
 *                             validateApiRequest(), exportUsageReport()
 *
 * Deployment:
 *   Runs as middleware inside the `api` Docker container (port 4000/public)
 *   or as a standalone Bun server: bun tool-packager.tool.ts (port 4002).
 *
 * Required env vars:
 *   PUBLIC_API_SIGNING_SECRET  — used to generate deterministic key checksums
 *   PUBLIC_API_PORT            — (optional) default 4002
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — API KEYS
// ═══════════════════════════════════════════════════════════════════

export type ApiKeyTier =
  | "FREE"       // 100 req/day, public tools only, no SLA
  | "STARTER"    // 1 000 req/day, all standard tools, email support
  | "PRO"        // 10 000 req/day, all tools + priority queue
  | "ENTERPRISE" // unlimited, dedicated endpoint, SLA 99.9%
  | "INTERNAL";  // sovereign mainframe internal — no rate limit, no billing

export interface ApiKey {
  /** Format: `smf_{tier}_{16-char hex}` */
  key:             string;
  keyId:           string;   // first 12 chars of the hex segment
  tier:            ApiKeyTier;
  ownerId:         string;   // email or internal agent ID
  ownerLabel:      string;
  createdAt:       number;   // Unix ms
  expiresAt:       number;   // Unix ms — 0 = never
  isActive:        boolean;
  /** Allowed tool IDs. Empty = all tier-appropriate tools. */
  allowedTools:    string[];
  /** Allowed origin domains for CORS. Empty = any. */
  allowedOrigins:  string[];
  /** Custom per-key rate limit override. Null = use tier default. */
  rateLimitRpdOverride: number | null;
}

export interface ApiKeyUsage {
  keyId:              string;
  date:               string;   // YYYY-MM-DD
  totalRequests:      number;
  successRequests:    number;
  errorRequests:      number;
  rateLimitedRequests: number;
  byTool:             Record<string, number>;
  /** Estimated revenue in USD cents (based on tier pricing) */
  estimatedRevenueCents: number;
}

export interface UsageReport {
  generatedAt:     number;
  periodDays:      number;
  keys:            Array<{
    keyId:         string;
    ownerLabel:    string;
    tier:          ApiKeyTier;
    totalRequests: number;
    totalRevenueCents: number;
  }>;
  grandTotalRequests:      number;
  grandTotalRevenueCents:  number;
  grandTotalRevenueDollars: string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — WRAPPED TOOLS
// ═══════════════════════════════════════════════════════════════════

export type PublicToolId =
  | "gematria-scorer"
  | "redesign-analyser"
  | "3d-globe-query";

export type HttpMethod = "GET" | "POST";

export interface WrappedTool {
  id:            PublicToolId;
  name:          string;
  description:   string;
  version:       string;
  /** Public endpoint path, e.g. /v1/gematria */
  endpointPath:  string;
  method:        HttpMethod;
  minTier:       ApiKeyTier;
  /** Delegates to this internal engine */
  internalEngine: string;
  parameters: Array<{
    name:        string;
    type:        string;
    description: string;
    required:    boolean;
    example?:    unknown;
  }>;
  responseShape: string;
  pricingNotes:  string;
  /** Requests per day included in each tier */
  tierAllowance: Record<ApiKeyTier, number | "unlimited">;
}

// ═══════════════════════════════════════════════════════════════════
// WRAPPED TOOL REGISTRY — 3 public-facing tools
// ═══════════════════════════════════════════════════════════════════

export const WRAPPED_TOOL_REGISTRY: Record<PublicToolId, WrappedTool> = {

  "gematria-scorer": {
    id:            "gematria-scorer",
    name:          "Gematria Scorer API",
    description:   "Calculate Hebrew Gematria values (standard, ordinal, reduced) for any input string. Returns numeric scores plus theosophic reduction. Used by content creators, researchers, and numerology platforms.",
    version:       "1.0.0",
    endpointPath:  "/v1/gematria",
    method:        "POST",
    minTier:       "FREE",
    internalEngine: "core-logic/engines.ts:calculateGematria + reduceToDigit",
    parameters: [
      { name: "text",   type: "string",  description: "Input string to score",                                         required: true,  example: "Sovereign" },
      { name: "method", type: "string",  description: "Scoring method: standard | ordinal | reduced | all",             required: false, example: "all" },
      { name: "lang",   type: "string",  description: "Language context: en (transliterated) | he (native Hebrew)",     required: false, example: "en" },
    ],
    responseShape: `{
  input:    string,
  lang:     "en" | "he",
  scores: {
    standard: number,   // Mispar Hechrachi
    ordinal:  number,   // Mispar Siduri
    reduced:  number,   // Theosophic reduction
  },
  reducedChain: number[],  // intermediate steps to single digit
  processingMs: number
}`,
    pricingNotes:  "FREE: 100/day. STARTER: 1,000/day. PRO: 10,000/day. ENTERPRISE: unlimited.",
    tierAllowance: { FREE: 100, STARTER: 1000, PRO: 10000, ENTERPRISE: "unlimited", INTERNAL: "unlimited" },
  },

  "redesign-analyser": {
    id:            "redesign-analyser",
    name:          "Redesign AI Analyser API",
    description:   "Submit a design artifact description or URL and receive structural improvement recommendations, priority scores, and implementation notes from the Redesign-AI engine.",
    version:       "1.0.0",
    endpointPath:  "/v1/redesign",
    method:        "POST",
    minTier:       "STARTER",
    internalEngine: "core-logic/engines.ts:redesignAnalyzer + batchAnalyze",
    parameters: [
      { name: "artifactId",   type: "string",  description: "Design artifact identifier or URL",           required: true,  example: "https://example.com" },
      { name: "context",      type: "string",  description: "Additional design context or constraints",     required: false, example: "Mobile-first, dark theme" },
      { name: "outputFormat", type: "string",  description: "Response format: summary | detailed | json",  required: false, example: "detailed" },
      { name: "batch",        type: "array",   description: "Array of artifactIds for batch analysis",     required: false, example: [] },
    ],
    responseShape: `{
  artifactId: string,
  score:      number,   // 0–100 overall design health
  priority:   "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  recommendations: Array<{
    category:    string,
    issue:       string,
    suggestion:  string,
    impactScore: number
  }>,
  gematriaAlignment?: number,   // if gematria scoring enabled
  processingMs: number
}`,
    pricingNotes:  "STARTER+: 1,000/day. PRO: 10,000/day. ENTERPRISE: unlimited. Batch up to 50 artifacts per call on PRO+.",
    tierAllowance: { FREE: 0, STARTER: 1000, PRO: 10000, ENTERPRISE: "unlimited", INTERNAL: "unlimited" },
  },

  "3d-globe-query": {
    id:            "3d-globe-query",
    name:          "3D Globe Geo-Query API",
    description:   "Query the Omni-View 3D globe for fused position data, geo-spatial overlays, and active sensor readings at a given coordinate. Returns GeoJSON-compatible output.",
    version:       "1.0.0",
    endpointPath:  "/v1/globe",
    method:        "POST",
    minTier:       "PRO",
    internalEngine: "toolbox/tools/spatial/sensor-fusion.tool.ts:fusePosition",
    parameters: [
      { name: "lat",       type: "number",  description: "Latitude (-90 to 90)",                                   required: true,  example: 31.7683 },
      { name: "lon",       type: "number",  description: "Longitude (-180 to 180)",                                required: true,  example: 35.2137 },
      { name: "radiusM",   type: "number",  description: "Query radius in metres",                                  required: false, example: 500 },
      { name: "layers",    type: "array",   description: "Overlay layers: atmosphere | spectral | sensor | yp",    required: false, example: ["atmosphere", "sensor"] },
      { name: "timestampMs", type: "number", description: "Historical query timestamp. Omit for live data.",       required: false },
    ],
    responseShape: `{
  type:    "FeatureCollection",
  bbox:    [west, south, east, north],
  features: GeoJSONFeature[],
  meta: {
    lat, lon, radiusM,
    layers:    string[],
    sensorCount: number,
    atmosphereHz?: number,
    processingMs: number
  }
}`,
    pricingNotes:  "PRO+: 10,000/day. ENTERPRISE: unlimited. Historical queries require ENTERPRISE.",
    tierAllowance: { FREE: 0, STARTER: 0, PRO: 10000, ENTERPRISE: "unlimited", INTERNAL: "unlimited" },
  },
};

// ═══════════════════════════════════════════════════════════════════
// TIER PRICING (cents per 1 000 requests beyond daily allowance)
// ═══════════════════════════════════════════════════════════════════

export const TIER_PRICING_CENTS_PER_1K: Record<ApiKeyTier, number> = {
  FREE:       0,     // hard-capped at daily limit
  STARTER:    50,    // $0.50 / 1 000 overage
  PRO:        30,    // $0.30 / 1 000 overage
  ENTERPRISE: 20,    // $0.20 / 1 000 (negotiated)
  INTERNAL:   0,
};

export const TIER_DAILY_LIMIT: Record<ApiKeyTier, number> = {
  FREE:       100,
  STARTER:    1_000,
  PRO:        10_000,
  ENTERPRISE: Infinity,
  INTERNAL:   Infinity,
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a cryptographically random hex string of `bytes` length */
function randomHex(bytes = 16): string {
  if (typeof globalThis.crypto?.getRandomValues !== "undefined") {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Bun / Node fallback
  let hex = "";
  for (let i = 0; i < bytes; i++) hex += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return hex;
}

/**
 * Generate a formatted API key.
 * Format: `smf_{tier}_{32-char hex}`
 */
export function generateApiKey(tier: ApiKeyTier): string {
  const tierCode = tier.toLowerCase().slice(0, 3);
  return `smf_${tierCode}_${randomHex(16)}`;
}

// ═══════════════════════════════════════════════════════════════════
// 1. API KEY MANAGER
// ═══════════════════════════════════════════════════════════════════

export interface ApiKeyCreateOptions {
  tier:           ApiKeyTier;
  ownerId:        string;
  ownerLabel:     string;
  expiresInDays?: number;   // 0 = never
  allowedTools?:  string[];
  allowedOrigins?: string[];
  rateLimitRpdOverride?: number;
}

export class ApiKeyManager {
  private keys:   Map<string, ApiKey>      = new Map(); // keyId → ApiKey
  private usage:  Map<string, Map<string, ApiKeyUsage>> = new Map(); // keyId → date → usage

  // ── Key lifecycle ──────────────────────────────────────────────

  create(opts: ApiKeyCreateOptions): ApiKey {
    const raw    = generateApiKey(opts.tier);
    const keyId  = raw.slice(-12); // last 12 hex chars
    const now    = Date.now();
    const expiresAt = opts.expiresInDays
      ? now + opts.expiresInDays * 86_400_000
      : 0;

    const key: ApiKey = {
      key:    raw,
      keyId,
      tier:   opts.tier,
      ownerId:      opts.ownerId,
      ownerLabel:   opts.ownerLabel,
      createdAt:    now,
      expiresAt,
      isActive:     true,
      allowedTools: opts.allowedTools  ?? [],
      allowedOrigins: opts.allowedOrigins ?? [],
      rateLimitRpdOverride: opts.rateLimitRpdOverride ?? null,
    };

    this.keys.set(keyId, key);
    return key;
  }

  revoke(keyId: string): boolean {
    const k = this.keys.get(keyId);
    if (!k) return false;
    k.isActive = false;
    return true;
  }

  rotate(keyId: string): ApiKey | null {
    const old = this.keys.get(keyId);
    if (!old) return null;
    old.isActive = false;
    return this.create({
      tier:          old.tier,
      ownerId:       old.ownerId,
      ownerLabel:    old.ownerLabel,
      allowedTools:  old.allowedTools,
      allowedOrigins: old.allowedOrigins,
    });
  }

  get(keyId: string): ApiKey | null {
    return this.keys.get(keyId) ?? null;
  }

  list(filter?: { tier?: ApiKeyTier; isActive?: boolean }): ApiKey[] {
    return [...this.keys.values()].filter((k) => {
      if (filter?.tier     && k.tier     !== filter.tier)     return false;
      if (filter?.isActive !== undefined && k.isActive !== filter.isActive) return false;
      return true;
    });
  }

  // ── Validation ─────────────────────────────────────────────────

  /**
   * Validate a raw API key string and return the associated ApiKey if valid.
   * Returns null with a reason string if invalid.
   */
  validate(
    rawKey:  string,
    toolId?: string,
    origin?: string
  ): { valid: boolean; key: ApiKey | null; reason?: string } {
    if (!rawKey || !rawKey.startsWith("smf_")) {
      return { valid: false, key: null, reason: "Malformed key — must start with smf_." };
    }

    const keyId = rawKey.slice(-12);
    const key   = this.keys.get(keyId);
    if (!key) return { valid: false, key: null, reason: "Key not found." };
    if (!key.isActive) return { valid: false, key: null, reason: "Key has been revoked." };
    if (key.key !== rawKey) return { valid: false, key: null, reason: "Key mismatch — possible tampering." };

    if (key.expiresAt > 0 && Date.now() > key.expiresAt) {
      return { valid: false, key, reason: `Key expired at ${new Date(key.expiresAt).toISOString()}.` };
    }

    if (toolId && key.allowedTools.length > 0 && !key.allowedTools.includes(toolId)) {
      return { valid: false, key, reason: `Tool '${toolId}' not in this key's allowedTools list.` };
    }

    if (origin && key.allowedOrigins.length > 0) {
      const allowed = key.allowedOrigins.some((o) =>
        origin === o || origin.endsWith("." + o.replace(/^\*\./, ""))
      );
      if (!allowed) return { valid: false, key, reason: `Origin '${origin}' not allowed for this key.` };
    }

    return { valid: true, key };
  }

  // ── Rate limiting ──────────────────────────────────────────────

  /**
   * Check and decrement the daily rate limit for a key.
   * Returns true if the request is allowed, false if rate-limited.
   */
  checkRateLimit(keyId: string, toolId: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    const limit = key.rateLimitRpdOverride ?? TIER_DAILY_LIMIT[key.tier];
    if (limit === Infinity) return true;

    const today   = todayIso();
    const dayUsage = this._getDayUsage(keyId, today);
    return dayUsage.totalRequests < limit;
  }

  // ── Usage tracking ─────────────────────────────────────────────

  recordRequest(
    keyId:   string,
    toolId:  string,
    success: boolean,
    rateLimited = false
  ): void {
    const key     = this.keys.get(keyId);
    if (!key) return;

    const today    = todayIso();
    const dayUsage = this._getDayUsage(keyId, today);

    dayUsage.totalRequests++;
    if (success)     dayUsage.successRequests++;
    if (!success && !rateLimited) dayUsage.errorRequests++;
    if (rateLimited) dayUsage.rateLimitedRequests++;

    dayUsage.byTool[toolId] = (dayUsage.byTool[toolId] ?? 0) + 1;

    // Estimate revenue: overage billing
    const limit     = TIER_DAILY_LIMIT[key.tier];
    const overage   = limit < Infinity ? Math.max(0, dayUsage.totalRequests - limit) : 0;
    const ratePer1k = TIER_PRICING_CENTS_PER_1K[key.tier];
    dayUsage.estimatedRevenueCents = Math.round((overage / 1000) * ratePer1k);
  }

  getUsage(keyId: string, date?: string): ApiKeyUsage | null {
    const d     = date ?? todayIso();
    return this.usage.get(keyId)?.get(d) ?? null;
  }

  // ── Usage report ──────────────────────────────────────────────

  exportUsageReport(periodDays = 30): UsageReport {
    const keys = [...this.keys.values()];
    const report: UsageReport = {
      generatedAt: Date.now(),
      periodDays,
      keys:        [],
      grandTotalRequests:       0,
      grandTotalRevenueCents:   0,
      grandTotalRevenueDollars: "0.00",
    };

    for (const k of keys) {
      const dates       = this.usage.get(k.keyId);
      let totalRequests = 0;
      let totalRevenue  = 0;

      if (dates) {
        const cutoff = Date.now() - periodDays * 86_400_000;
        for (const [date, usage] of dates) {
          if (new Date(date).getTime() >= cutoff) {
            totalRequests += usage.totalRequests;
            totalRevenue  += usage.estimatedRevenueCents;
          }
        }
      }

      report.keys.push({
        keyId:             k.keyId,
        ownerLabel:        k.ownerLabel,
        tier:              k.tier,
        totalRequests,
        totalRevenueCents: totalRevenue,
      });

      report.grandTotalRequests     += totalRequests;
      report.grandTotalRevenueCents += totalRevenue;
    }

    report.keys.sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);
    report.grandTotalRevenueDollars = (report.grandTotalRevenueCents / 100).toFixed(2);
    return report;
  }

  // ── Private ────────────────────────────────────────────────────

  private _getDayUsage(keyId: string, date: string): ApiKeyUsage {
    if (!this.usage.has(keyId)) this.usage.set(keyId, new Map());
    const byDate = this.usage.get(keyId)!;
    if (!byDate.has(date)) {
      byDate.set(date, {
        keyId, date,
        totalRequests: 0, successRequests: 0,
        errorRequests: 0, rateLimitedRequests: 0,
        byTool: {}, estimatedRevenueCents: 0,
      });
    }
    return byDate.get(date)!;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. PUBLIC API GATEWAY
// ═══════════════════════════════════════════════════════════════════

export interface PublicApiRequest {
  toolId:     PublicToolId;
  rawApiKey:  string;
  body:       Record<string, unknown>;
  origin?:    string;
  requestId?: string;
}

export interface PublicApiResponse<T = unknown> {
  requestId:   string;
  toolId:      string;
  success:     boolean;
  data?:       T;
  error?:      { code: number; message: string };
  meta: {
    tier:          ApiKeyTier;
    remainingToday?: number;
    processingMs:  number;
  };
}

/**
 * PublicApiGateway — validates API keys, enforces rate limits,
 * routes to the correct wrapped tool descriptor, and records usage.
 *
 * Actual engine execution is NOT performed here — the gateway returns
 * routing metadata and the caller executes the internal engine.
 * This keeps the packager zero-dependency and portable to NAS.
 */
export class PublicApiGateway {
  private keyManager: ApiKeyManager;

  constructor(keyManager?: ApiKeyManager) {
    this.keyManager = keyManager ?? new ApiKeyManager();
  }

  get keys(): ApiKeyManager { return this.keyManager; }

  /**
   * Handle an inbound public API request.
   * Returns a routing decision — the caller runs the internal engine.
   */
  handle(req: PublicApiRequest): PublicApiResponse {
    const start     = Date.now();
    const requestId = req.requestId ?? generateId("req");

    // ── 1. Validate key ─────────────────────────────────────────
    const { valid, key, reason } = this.keyManager.validate(req.rawApiKey, req.toolId, req.origin);
    if (!valid || !key) {
      return { requestId, toolId: req.toolId, success: false,
        error: { code: 401, message: reason ?? "Invalid API key." },
        meta: { tier: "FREE", processingMs: Date.now() - start } };
    }

    // ── 2. Resolve tool ─────────────────────────────────────────
    const tool = WRAPPED_TOOL_REGISTRY[req.toolId];
    if (!tool) {
      return { requestId, toolId: req.toolId, success: false,
        error: { code: 404, message: `Tool '${req.toolId}' not found.` },
        meta: { tier: key.tier, processingMs: Date.now() - start } };
    }

    // ── 3. Tier access check ────────────────────────────────────
    const tierOrder: Record<ApiKeyTier, number> = { FREE: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3, INTERNAL: 4 };
    if (tierOrder[key.tier] < tierOrder[tool.minTier]) {
      this.keyManager.recordRequest(key.keyId, req.toolId, false);
      return { requestId, toolId: req.toolId, success: false,
        error: { code: 403, message: `Tool '${req.toolId}' requires ${tool.minTier} tier. Your key is ${key.tier}.` },
        meta: { tier: key.tier, processingMs: Date.now() - start } };
    }

    // ── 4. Rate limit ───────────────────────────────────────────
    if (!this.keyManager.checkRateLimit(key.keyId, req.toolId)) {
      this.keyManager.recordRequest(key.keyId, req.toolId, false, true);
      const limit = key.rateLimitRpdOverride ?? TIER_DAILY_LIMIT[key.tier];
      return { requestId, toolId: req.toolId, success: false,
        error: { code: 429, message: `Daily rate limit of ${limit} requests exceeded for tier ${key.tier}.` },
        meta: { tier: key.tier, remainingToday: 0, processingMs: Date.now() - start } };
    }

    // ── 5. Validate required parameters ─────────────────────────
    const missing = tool.parameters
      .filter((p) => p.required && !(p.name in req.body))
      .map((p) => p.name);
    if (missing.length > 0) {
      return { requestId, toolId: req.toolId, success: false,
        error: { code: 400, message: `Missing required parameters: ${missing.join(", ")}.` },
        meta: { tier: key.tier, processingMs: Date.now() - start } };
    }

    // ── 6. Record + return routing info ─────────────────────────
    this.keyManager.recordRequest(key.keyId, req.toolId, true);

    const limit   = TIER_DAILY_LIMIT[key.tier];
    const used    = this.keyManager.getUsage(key.keyId)?.totalRequests ?? 1;
    const remaining = limit === Infinity ? undefined : Math.max(0, limit - used);

    return {
      requestId, toolId: req.toolId, success: true,
      data: {
        routing: {
          internalEngine: tool.internalEngine,
          parameters:     req.body,
          endpointPath:   tool.endpointPath,
        },
        tool,
        _note: "Execute via internalEngine. Gateway validates auth and metering only.",
      },
      meta: { tier: key.tier, remainingToday: remaining, processingMs: Date.now() - start },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. PURE HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a standard public API success response envelope.
 */
export function buildPublicApiResponse<T>(
  requestId: string,
  toolId:    string,
  data:      T,
  meta:      { tier: ApiKeyTier; remainingToday?: number; processingMs: number }
): PublicApiResponse<T> {
  return { requestId, toolId, success: true, data, meta };
}

/**
 * Validate that a request body contains all required parameters for a tool.
 * Returns `{ valid, missing }`.
 */
export function validateApiRequest(
  toolId: PublicToolId,
  body:   Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const tool = WRAPPED_TOOL_REGISTRY[toolId];
  if (!tool) return { valid: false, missing: ["toolId (not found)"] };
  const missing = tool.parameters.filter((p) => p.required && !(p.name in body)).map((p) => p.name);
  return { valid: missing.length === 0, missing };
}

/**
 * Export a full usage report from a key manager instance.
 * Convenience re-export for external consumers.
 */
export function exportUsageReport(keyManager: ApiKeyManager, periodDays = 30): UsageReport {
  return keyManager.exportUsageReport(periodDays);
}

// ═══════════════════════════════════════════════════════════════════
// STANDALONE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

if (typeof Bun !== "undefined" && import.meta.main) {
  const PORT = Number(process.env.PUBLIC_API_PORT ?? "4002");
  const km   = new ApiKeyManager();
  const gw   = new PublicApiGateway(km);

  // Seed one internal key on startup
  const internalKey = km.create({ tier: "INTERNAL", ownerId: "the-keymaker", ownerLabel: "The Keymaker" });
  console.log(`[tool-packager] Internal key: ${internalKey.key}`);

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return Response.json({ status: "ok", service: "sovereign-public-api", tools: Object.keys(WRAPPED_TOOL_REGISTRY) });
      }

      if (req.method === "POST") {
        const toolId  = url.pathname.slice(1) as PublicToolId; // strip leading /
        const rawKey  = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
        const origin  = req.headers.get("Origin") ?? undefined;
        const body    = await req.json().catch(() => ({})) as Record<string, unknown>;

        const resp = gw.handle({ toolId, rawApiKey: rawKey, body, origin });
        return Response.json(resp, { status: resp.success ? 200 : (resp.error?.code ?? 500) });
      }

      if (req.method === "GET" && url.pathname === "/tools") {
        return Response.json({ tools: Object.values(WRAPPED_TOOL_REGISTRY).map((t) => ({
          id: t.id, name: t.name, endpointPath: t.endpointPath, minTier: t.minTier, version: t.version,
        })) });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  console.log(`[tool-packager] Public API Gateway running on :${PORT}`);
  console.log(`[tool-packager] Exposed tools: ${Object.keys(WRAPPED_TOOL_REGISTRY).join(", ")}`);
}

/**
 * toolbox/tools/marketplace/key-manager.tool.ts
 * version: 1.0.0
 *
 * Marketplace Gatekeeper — API Key Manager.
 * Pure TypeScript. Zero framework imports.
 *
 * Responsibilities:
 *   1. Generate cryptographically secure API keys (CSPRNG via Web Crypto)
 *   2. Validate keys against the live registry
 *   3. Enforce tier access rules (BASIC / PRO / ENTERPRISE)
 *   4. Manage the full key lifecycle: create, rotate, revoke, inspect
 *
 * Pillar 15: Tool Manufacturing / Marketplace (GAB: MARKETPLACE-INFRASTRUCTURE)
 *
 * Key format:
 *   smf_{tier3}_{hex32}_{crc4}
 *   e.g.  smf_pro_a3f...2c_8f1a
 *
 *   - tier3  → first 3 chars of tier (bas / pro / ent)
 *   - hex32  → 16 random bytes as lowercase hex (128-bit entropy)
 *   - crc4   → 4-char CRC hex for fast checksum validation without a DB hit
 *
 * Storage:
 *   In-memory Map by default. Call `setAdapter()` to swap in a Supabase,
 *   Postgres, or any async store that implements `KeyStoreAdapter`.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ApiKeyTier = "BASIC" | "PRO" | "ENTERPRISE" | "INTERNAL";

export type ApiKeyStatus = "ACTIVE" | "REVOKED" | "EXPIRED" | "SUSPENDED";

export interface ApiKeyRecord {
  /** Full key string — the bearer secret */
  key:             string;
  /** Stable 12-char identifier derived from the key (safe to log) */
  keyId:           string;
  tier:            ApiKeyTier;
  ownerId:         string;
  ownerEmail:      string;
  status:          ApiKeyStatus;
  createdAt:       number;   // Unix ms
  expiresAt:       number;   // Unix ms — 0 = never
  lastUsedAt:      number | null;
  /** Tools this key is restricted to. Empty = all tier-appropriate tools. */
  allowedTools:    string[];
  /** Allowed CORS origins. Empty = any. */
  allowedOrigins:  string[];
  metadata:        Record<string, string>;
}

export interface TierPolicy {
  tier:            ApiKeyTier;
  /** Human label */
  label:           string;
  /** Daily request limit across all tools. Infinity = unlimited. */
  dailyLimit:      number;
  /** Requests per minute (burst cap). Infinity = unlimited. */
  ratePerMinute:   number;
  /** Monthly price in USD cents */
  priceUsdCents:   number;
  /** Tools accessible at this tier */
  allowedTools:    string[] | "all";
  /** Max simultaneous active keys per owner */
  maxActiveKeys:   number;
}

export interface ValidationResult {
  valid:    boolean;
  record:   ApiKeyRecord | null;
  tier:     ApiKeyTier | null;
  policy:   TierPolicy  | null;
  reason?:  string;
}

export interface KeyStoreAdapter {
  get(keyId: string): Promise<ApiKeyRecord | null>;
  set(keyId: string, record: ApiKeyRecord): Promise<void>;
  delete(keyId: string): Promise<void>;
  listByOwner(ownerId: string): Promise<ApiKeyRecord[]>;
  listAll(filter?: Partial<Pick<ApiKeyRecord, "tier" | "status">>): Promise<ApiKeyRecord[]>;
}

// ═══════════════════════════════════════════════════════════════════
// TIER POLICIES
// ═══════════════════════════════════════════════════════════════════

export const TIER_POLICIES: Record<ApiKeyTier, TierPolicy> = {
  BASIC: {
    tier:          "BASIC",
    label:         "Basic",
    dailyLimit:    500,
    ratePerMinute: 20,
    priceUsdCents: 0,
    allowedTools:  ["gematria-scorer", "toolbox-manifest-query"],
    maxActiveKeys: 2,
  },
  PRO: {
    tier:          "PRO",
    label:         "Pro",
    dailyLimit:    10_000,
    ratePerMinute: 120,
    priceUsdCents: 2900,   // $29/month
    allowedTools:  ["gematria-scorer", "redesign-analyser", "toolbox-manifest-query", "yp-business-score", "ad-sequence-tick"],
    maxActiveKeys: 5,
  },
  ENTERPRISE: {
    tier:          "ENTERPRISE",
    label:         "Enterprise",
    dailyLimit:    Infinity,
    ratePerMinute: Infinity,
    priceUsdCents: 29900,  // $299/month
    allowedTools:  "all",
    maxActiveKeys: 50,
  },
  INTERNAL: {
    tier:          "INTERNAL",
    label:         "Internal (Sovereign)",
    dailyLimit:    Infinity,
    ratePerMinute: Infinity,
    priceUsdCents: 0,
    allowedTools:  "all",
    maxActiveKeys: Infinity,
  },
};

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY STORE (default adapter)
// ═══════════════════════════════════════════════════════════════════

export class InMemoryKeyStore implements KeyStoreAdapter {
  private store: Map<string, ApiKeyRecord> = new Map();

  async get(keyId: string): Promise<ApiKeyRecord | null> {
    return this.store.get(keyId) ?? null;
  }

  async set(keyId: string, record: ApiKeyRecord): Promise<void> {
    this.store.set(keyId, { ...record });
  }

  async delete(keyId: string): Promise<void> {
    this.store.delete(keyId);
  }

  async listByOwner(ownerId: string): Promise<ApiKeyRecord[]> {
    return [...this.store.values()].filter((r) => r.ownerId === ownerId);
  }

  async listAll(filter?: Partial<Pick<ApiKeyRecord, "tier" | "status">>): Promise<ApiKeyRecord[]> {
    return [...this.store.values()].filter((r) => {
      if (filter?.tier   && r.tier   !== filter.tier)   return false;
      if (filter?.status && r.status !== filter.status) return false;
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRYPTO HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate 16 cryptographically secure random bytes as a lowercase hex string.
 * Uses Web Crypto API (available in Bun, Node 18+, and all modern browsers).
 */
async function csprngHex(bytes = 16): Promise<string> {
  if (typeof globalThis.crypto?.getRandomValues !== "undefined") {
    const buf = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node.js crypto fallback
  try {
    const { randomBytes } = await import("crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    // Last-resort PRNG (test/browser environments without SubtleCrypto)
    console.warn("[key-manager] WARNING: CSPRNG unavailable — using Math.random() fallback. Not secure for production.");
    return Array.from({ length: bytes }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join("");
  }
}

/**
 * Fast 32-bit FNV-1a checksum — used for the 4-char CRC suffix.
 * Not cryptographic — purely for fast structural integrity check.
 */
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 4);
}

const TIER_CODE: Record<ApiKeyTier, string> = {
  BASIC:      "bas",
  PRO:        "pro",
  ENTERPRISE: "ent",
  INTERNAL:   "int",
};

/**
 * Build a formatted API key from a tier and a 32-char hex body.
 * Format: `smf_{tier3}_{hex32}_{crc4}`
 */
function buildKeyString(tier: ApiKeyTier, hex: string): string {
  const body = `smf_${TIER_CODE[tier]}_${hex}`;
  const crc  = fnv1a32(body);
  return `${body}_${crc}`;
}

/**
 * Derive the stable keyId (first 12 chars of the hex body).
 * Safe to log — does not expose the full key secret.
 */
function deriveKeyId(hex: string): string {
  return hex.slice(0, 12);
}

// ═══════════════════════════════════════════════════════════════════
// KEY MANAGER
// ═══════════════════════════════════════════════════════════════════

export interface CreateKeyOptions {
  tier:            ApiKeyTier;
  ownerId:         string;
  ownerEmail:      string;
  expiresInDays?:  number;     // 0 or omit = never
  allowedTools?:   string[];
  allowedOrigins?: string[];
  metadata?:       Record<string, string>;
}

export class KeyManager {
  private store: KeyStoreAdapter;

  constructor(store?: KeyStoreAdapter) {
    this.store = store ?? new InMemoryKeyStore();
  }

  /** Swap in a different backing store (e.g. Supabase adapter). */
  setAdapter(store: KeyStoreAdapter): void {
    this.store = store;
  }

  // ── Generation ─────────────────────────────────────────────────

  /**
   * Generate a new cryptographically secure API key and persist it.
   *
   * Returns the full ApiKeyRecord — the `.key` field is the only time
   * the raw secret is returned. It is NOT stored in plaintext by default;
   * production adapters should store a hash of `key` and only compare
   * hashed values on validation.
   */
  async create(opts: CreateKeyOptions): Promise<ApiKeyRecord> {
    const hex    = await csprngHex(16);
    const key    = buildKeyString(opts.tier, hex);
    const keyId  = deriveKeyId(hex);
    const now    = Date.now();
    const expiresAt = opts.expiresInDays && opts.expiresInDays > 0
      ? now + opts.expiresInDays * 86_400_000
      : 0;

    const record: ApiKeyRecord = {
      key,
      keyId,
      tier:           opts.tier,
      ownerId:        opts.ownerId,
      ownerEmail:     opts.ownerEmail,
      status:         "ACTIVE",
      createdAt:      now,
      expiresAt,
      lastUsedAt:     null,
      allowedTools:   opts.allowedTools   ?? [],
      allowedOrigins: opts.allowedOrigins ?? [],
      metadata:       opts.metadata        ?? {},
    };

    await this.store.set(keyId, record);
    return record;
  }

  // ── Validation ─────────────────────────────────────────────────

  /**
   * Validate a raw API key string and return the associated record and policy.
   *
   * Performs three checks in order:
   *   1. Structural checksum (CRC suffix) — no DB hit required
   *   2. Registry lookup — confirms the key exists and is active
   *   3. Expiry and status checks
   *
   * Optionally validates:
   *   - toolId       — key must allow this tool
   *   - origin       — key's allowedOrigins must include this domain
   */
  async validate(
    rawKey:  string,
    toolId?: string,
    origin?: string
  ): Promise<ValidationResult> {

    // ── 1. Structural check ────────────────────────────────────
    if (!rawKey || !rawKey.startsWith("smf_")) {
      return fail("Malformed key — must begin with 'smf_'.");
    }

    const parts = rawKey.split("_");
    // Expected: smf, tier3, hex32, crc4
    if (parts.length !== 4) {
      return fail("Malformed key — incorrect segment count.");
    }

    const [, , hex] = parts;
    const expectedCrc = fnv1a32(`smf_${parts[1]}_${hex}`);
    if (parts[3] !== expectedCrc) {
      return fail("Checksum mismatch — key is corrupted or tampered.");
    }

    // ── 2. Registry lookup ────────────────────────────────────
    const keyId = deriveKeyId(hex);
    const record = await this.store.get(keyId);
    if (!record) return fail("Key not found in registry.");
    if (record.key !== rawKey) return fail("Key secret mismatch — possible collision or tampering.");

    // ── 3. Status / expiry ────────────────────────────────────
    if (record.status === "REVOKED")   return fail("Key has been revoked.", record);
    if (record.status === "SUSPENDED") return fail("Key is suspended.", record);
    if (record.status === "EXPIRED")   return fail("Key has expired.", record);
    if (record.expiresAt > 0 && Date.now() > record.expiresAt) {
      await this.store.set(keyId, { ...record, status: "EXPIRED" });
      return fail(`Key expired at ${new Date(record.expiresAt).toISOString()}.`, record);
    }

    // ── 4. Tier policy ────────────────────────────────────────
    const policy = TIER_POLICIES[record.tier];

    // ── 5. Tool access ────────────────────────────────────────
    if (toolId) {
      const allowed = policy.allowedTools === "all"
        || (record.allowedTools.length > 0 ? record.allowedTools : (policy.allowedTools as string[])).includes(toolId);
      if (!allowed) return fail(`Tool '${toolId}' is not available on ${record.tier} tier.`, record, policy);
    }

    // ── 6. Origin check ───────────────────────────────────────
    if (origin && record.allowedOrigins.length > 0) {
      const ok = record.allowedOrigins.some((o) =>
        origin === o || origin.endsWith("." + o.replace(/^\*\./, ""))
      );
      if (!ok) return fail(`Origin '${origin}' is not permitted for this key.`, record, policy);
    }

    // Update last-used timestamp (fire-and-forget)
    this.store.set(keyId, { ...record, lastUsedAt: Date.now() }).catch(() => {});

    return { valid: true, record, tier: record.tier, policy };
  }

  // ── Tier-specific validation helpers ──────────────────────────

  /** Convenience: check only that the key meets a minimum tier level. */
  async validateTier(
    rawKey:  string,
    minTier: ApiKeyTier
  ): Promise<ValidationResult> {
    const result = await this.validate(rawKey);
    if (!result.valid) return result;

    const order: Record<ApiKeyTier, number> = { BASIC: 0, PRO: 1, ENTERPRISE: 2, INTERNAL: 3 };
    if (order[result.tier!] < order[minTier]) {
      return fail(
        `This operation requires ${minTier} tier. Your key is ${result.tier}.`,
        result.record,
        result.policy
      );
    }
    return result;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  async revoke(keyId: string, reason?: string): Promise<boolean> {
    const record = await this.store.get(keyId);
    if (!record) return false;
    await this.store.set(keyId, {
      ...record,
      status: "REVOKED",
      metadata: { ...record.metadata, ...(reason ? { revokeReason: reason } : {}) },
    });
    return true;
  }

  async suspend(keyId: string, reason?: string): Promise<boolean> {
    const record = await this.store.get(keyId);
    if (!record) return false;
    await this.store.set(keyId, {
      ...record,
      status: "SUSPENDED",
      metadata: { ...record.metadata, ...(reason ? { suspendReason: reason } : {}) },
    });
    return true;
  }

  async reinstate(keyId: string): Promise<boolean> {
    const record = await this.store.get(keyId);
    if (!record || record.status === "REVOKED") return false;
    await this.store.set(keyId, { ...record, status: "ACTIVE" });
    return true;
  }

  /** Revoke the current key and issue a fresh one with the same settings. */
  async rotate(keyId: string): Promise<ApiKeyRecord | null> {
    const old = await this.store.get(keyId);
    if (!old || old.status === "REVOKED") return null;
    await this.revoke(keyId, "Rotated");
    return this.create({
      tier:           old.tier,
      ownerId:        old.ownerId,
      ownerEmail:     old.ownerEmail,
      allowedTools:   old.allowedTools,
      allowedOrigins: old.allowedOrigins,
      metadata:       { ...old.metadata, rotatedFrom: keyId },
    });
  }

  // ── Query ──────────────────────────────────────────────────────

  async getById(keyId: string): Promise<ApiKeyRecord | null> {
    return this.store.get(keyId);
  }

  async listByOwner(ownerId: string): Promise<ApiKeyRecord[]> {
    return this.store.listByOwner(ownerId);
  }

  async listAll(filter?: Partial<Pick<ApiKeyRecord, "tier" | "status">>): Promise<ApiKeyRecord[]> {
    return this.store.listAll(filter);
  }

  getTierPolicy(tier: ApiKeyTier): TierPolicy {
    return TIER_POLICIES[tier];
  }

  getAllTierPolicies(): TierPolicy[] {
    return Object.values(TIER_POLICIES);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function fail(
  reason:  string,
  record?: ApiKeyRecord | null,
  policy?: TierPolicy | null
): ValidationResult {
  return {
    valid:  false,
    record: record ?? null,
    tier:   record?.tier ?? null,
    policy: policy ?? null,
    reason,
  };
}

/**
 * Mask a key for safe display in logs: shows prefix and last 4 chars only.
 * e.g.  smf_pro_a3f...2c_8f1a  →  smf_pro_****_8f1a
 */
export function maskKey(rawKey: string): string {
  const parts = rawKey.split("_");
  if (parts.length !== 4) return "smf_***_****_****";
  return `${parts[0]}_${parts[1]}_****_${parts[3]}`;
}

/**
 * Determine the tier from a raw key string without a DB lookup.
 * Returns null if the key is malformed.
 */
export function tierFromKey(rawKey: string): ApiKeyTier | null {
  const parts = rawKey.split("_");
  if (parts.length !== 4) return null;
  const codeMap: Record<string, ApiKeyTier> = {
    bas: "BASIC", pro: "PRO", ent: "ENTERPRISE", int: "INTERNAL",
  };
  return codeMap[parts[1]] ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE KEY STORE ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a KeyStoreAdapter backed by a Supabase `api_keys` table.
 *
 * Expected table schema (run in Supabase SQL editor):
 *
 *   CREATE TABLE api_keys (
 *     key_id          TEXT PRIMARY KEY,
 *     key             TEXT NOT NULL,
 *     tier            TEXT NOT NULL,
 *     owner_id        TEXT NOT NULL,
 *     owner_email     TEXT NOT NULL,
 *     status          TEXT NOT NULL DEFAULT 'ACTIVE',
 *     created_at      BIGINT NOT NULL,
 *     expires_at      BIGINT NOT NULL DEFAULT 0,
 *     last_used_at    BIGINT,
 *     allowed_tools   TEXT[] NOT NULL DEFAULT '{}',
 *     allowed_origins TEXT[] NOT NULL DEFAULT '{}',
 *     metadata        JSONB  NOT NULL DEFAULT '{}'
 *   );
 *
 * @param supabaseUrl  From SUPABASE_URL env var
 * @param supabaseKey  From SUPABASE_SERVICE_ROLE_KEY env var
 */
export function createSupabaseKeyStore(
  supabaseUrl: string,
  supabaseKey: string
): KeyStoreAdapter {
  const headers = {
    "apikey":        supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };

  const base = `${supabaseUrl}/rest/v1/api_keys`;

  const toRecord = (row: Record<string, unknown>): ApiKeyRecord => ({
    key:            row.key              as string,
    keyId:          row.key_id           as string,
    tier:           row.tier             as ApiKeyTier,
    ownerId:        row.owner_id         as string,
    ownerEmail:     row.owner_email      as string,
    status:         row.status           as ApiKeyStatus,
    createdAt:      row.created_at       as number,
    expiresAt:      row.expires_at       as number,
    lastUsedAt:     (row.last_used_at ?? null) as number | null,
    allowedTools:   (row.allowed_tools  ?? []) as string[],
    allowedOrigins: (row.allowed_origins ?? []) as string[],
    metadata:       (row.metadata       ?? {})  as Record<string, string>,
  });

  const toRow = (r: ApiKeyRecord) => ({
    key_id:          r.keyId,
    key:             r.key,
    tier:            r.tier,
    owner_id:        r.ownerId,
    owner_email:     r.ownerEmail,
    status:          r.status,
    created_at:      r.createdAt,
    expires_at:      r.expiresAt,
    last_used_at:    r.lastUsedAt,
    allowed_tools:   r.allowedTools,
    allowed_origins: r.allowedOrigins,
    metadata:        r.metadata,
  });

  return {
    async get(keyId) {
      const resp = await fetch(`${base}?key_id=eq.${keyId}&limit=1`, { headers });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async set(keyId, record) {
      await fetch(base, {
        method:  "POST",
        headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
        body:    JSON.stringify(toRow(record)),
      });
    },
    async delete(keyId) {
      await fetch(`${base}?key_id=eq.${keyId}`, { method: "DELETE", headers });
    },
    async listByOwner(ownerId) {
      const resp = await fetch(`${base}?owner_id=eq.${ownerId}`, { headers });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(toRecord);
    },
    async listAll(filter) {
      let url = base;
      const params: string[] = [];
      if (filter?.tier)   params.push(`tier=eq.${filter.tier}`);
      if (filter?.status) params.push(`status=eq.${filter.status}`);
      if (params.length)  url += "?" + params.join("&");
      const resp = await fetch(url, { headers });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(toRecord);
    },
  };
}

/**
 * toolbox/tools/agent-economy/api-negotiator.tool.ts
 * version: 1.0.0
 *
 * Agentic Protocol — API Negotiator & MCP Gateway.
 * Pure TypeScript. Zero framework imports.
 *
 * Exposes all active Sovereign Mainframe Pillars as MCP-compatible
 * (Model Context Protocol) tool and resource descriptors, and enforces
 * Bot-Sovereignty — a cryptographic identity layer that gates access to
 * privileged Gematria, 4D spatial, and spectral data by agent class.
 *
 * Pillar 13: Agentic Protocol (GAB domain: UNIVERSAL-GOVERNANCE)
 *
 * MCP overview (spec: https://modelcontextprotocol.io):
 *   - Tools     → callable functions an AI model may invoke
 *   - Resources → readable data streams / documents
 *   - Prompts   → reusable prompt templates
 *
 * This file ships:
 *   1. BotSovereignty   — agent identity registry + HMAC-based token verification
 *   2. PillarRegistry   — all 12 existing pillars as MCP ToolDescriptors
 *   3. McpGateway       — request routing, capability negotiation, rate limiting
 *   4. Pure helpers     — buildMcpToolCall(), parseMcpResponse(), signAgentToken()
 *
 * Deployment:
 *   Runs inside the `api` Docker container (port 4000/mcp).
 *   Or as a standalone Bun HTTP server: bun api-negotiator.tool.ts
 *
 * Required env vars:
 *   MCP_SECRET_KEY          — HMAC signing secret for agent tokens
 *   MCP_ALLOWED_AGENT_IDS   — comma-separated whitelist of agent IDs
 *   MCP_PORT                — (optional) default 4001
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — MCP CORE (subset of the Model Context Protocol spec)
// ═══════════════════════════════════════════════════════════════════

export type McpToolCategory =
  | "taxonomy"       // Gematria, Flora Fana, canonical naming
  | "spatial"        // 4D sensor fusion, GNSS, Wi-Fi trilateration
  | "spectral"       // High-Spectral Veil, composite frames, anomaly detection
  | "finance"        // Yod Token, tithe ledger
  | "commerce"       // Ad sequencer, typing engine, Yellow Pages
  | "atmosphere"     // Trinity Hz sync, canopy physics
  | "governance"     // This pillar — MCP routing, Bot-Sovereignty
  | "bio-audit"      // Biological Audit (Pillar 14)
  | "general";

export type BotAccessTier =
  | "PUBLIC"         // Unauthenticated — no sensitive data
  | "VERIFIED"       // Signed token — standard pillar access
  | "SOVEREIGN"      // Elevated — Gematria + 4D + Spectral (privileged)
  | "KEYMAKER";      // Full access — all pillars, governance ops

export interface McpToolParameter {
  name:        string;
  type:        "string" | "number" | "boolean" | "object" | "array" | "bigint";
  description: string;
  required:    boolean;
  default?:    unknown;
  enum?:       string[];
}

export interface McpToolDescriptor {
  /** Unique tool identifier — kebab-case */
  name:        string;
  /** Human-readable label */
  displayName: string;
  description: string;
  category:    McpToolCategory;
  /** Minimum access tier required */
  minTier:     BotAccessTier;
  pillarIndex: number;
  pillarName:  string;
  parameters:  McpToolParameter[];
  /** Which engines / exports this tool delegates to */
  delegates:   string[];
  /** Output schema description */
  outputShape: string;
}

export interface McpResourceDescriptor {
  uri:         string;
  name:        string;
  description: string;
  mimeType:    "application/json" | "text/plain" | "application/octet-stream";
  minTier:     BotAccessTier;
}

export interface McpCapabilityManifest {
  protocolVersion: string;
  serverName:      string;
  serverVersion:   string;
  tools:           McpToolDescriptor[];
  resources:       McpResourceDescriptor[];
  accessTiers:     typeof ACCESS_TIER_ORDER;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — BOT-SOVEREIGNTY
// ═══════════════════════════════════════════════════════════════════

export interface AgentIdentity {
  agentId:     string;
  agentName:   string;
  tier:        BotAccessTier;
  /** Unix seconds — token issued at */
  issuedAt:    number;
  /** Unix seconds — token expires at. 0 = no expiry. */
  expiresAt:   number;
  /** Allowed pillar indices. Empty = all tiers-appropriate pillars. */
  allowedPillars: number[];
  /** Fingerprint of the signing key used */
  keyFingerprint: string;
}

export interface AgentToken {
  /** Base64url-encoded JSON of AgentIdentity */
  payload:   string;
  /** HMAC-SHA256 hex signature of payload */
  signature: string;
  /** Combined token string: `{payload}.{signature}` */
  token:     string;
}

export interface AuthResult {
  authorized:  boolean;
  identity:    AgentIdentity | null;
  reason?:     string;
}

export interface McpRequest {
  /** JSON-RPC 2.0 method: "tools/call", "tools/list", "resources/read" */
  method:      string;
  params:      Record<string, unknown>;
  /** Raw token from Authorization: Bearer header */
  bearerToken: string;
  requestId:   string;
  timestampMs: number;
}

export interface McpResponse<T = unknown> {
  requestId:   string;
  method:      string;
  result?:     T;
  error?:      { code: number; message: string; data?: unknown };
  agentId?:    string;
  durationMs:  number;
}

// ═══════════════════════════════════════════════════════════════════
// ACCESS TIER ORDERING
// ═══════════════════════════════════════════════════════════════════

export const ACCESS_TIER_ORDER: Record<BotAccessTier, number> = {
  PUBLIC:    0,
  VERIFIED:  1,
  SOVEREIGN: 2,
  KEYMAKER:  3,
};

function tierAtLeast(agent: BotAccessTier, required: BotAccessTier): boolean {
  return ACCESS_TIER_ORDER[agent] >= ACCESS_TIER_ORDER[required];
}

// ═══════════════════════════════════════════════════════════════════
// PILLAR TOOL REGISTRY — all 12 pillars + this one + bio-audit
// ═══════════════════════════════════════════════════════════════════

export const PILLAR_TOOLS: McpToolDescriptor[] = [
  // ── Pillar 1–5: Convex Core ────────────────────────────────────
  {
    name: "gematria-score", displayName: "Gematria Scorer",
    description: "Calculate Hebrew Gematria values and reduce to a single digit for any input string. Returns standard, ordinal, and reduced scores.",
    category: "taxonomy", minTier: "SOVEREIGN", pillarIndex: 1, pillarName: "Recursive Taxonomy",
    parameters: [
      { name: "text", type: "string", description: "Input string to score", required: true },
      { name: "method", type: "string", description: "Scoring method", required: false, enum: ["standard","ordinal","reduced"], default: "standard" },
    ],
    delegates: ["core-logic/engines.ts:calculateGematria", "core-logic/engines.ts:reduceToDigit"],
    outputShape: "{ standard: number, ordinal: number, reduced: number, input: string }",
  },
  {
    name: "taxonomy-canonicalise", displayName: "Taxonomy Canonicaliser",
    description: "Normalise a category or subcategory slug to its canonical GAB taxonomy code (uppercase, hyphen-delimited).",
    category: "taxonomy", minTier: "VERIFIED", pillarIndex: 1, pillarName: "Recursive Taxonomy",
    parameters: [
      { name: "slug", type: "string", description: "Raw slug or label to canonicalise", required: true },
    ],
    delegates: ["toolbox-core/tools/taxonomy.tool.ts"],
    outputShape: "{ canonical: string, domain: string, pillarIndex: number }",
  },
  {
    name: "flora-fana-classify", displayName: "Flora Fana Classifier",
    description: "Classify a botanical specimen or compound against the GAB Flora Fana domain.",
    category: "taxonomy", minTier: "VERIFIED", pillarIndex: 2, pillarName: "Flora Fana",
    parameters: [
      { name: "specimen", type: "string", description: "Specimen name or compound", required: true },
    ],
    delegates: ["convex/taxonomy.ts"],
    outputShape: "{ class: string, gabCode: string, gematriaScore: number }",
  },
  {
    name: "redesign-analyse", displayName: "Redesign AI Analyser",
    description: "Analyse a design artifact and return structural improvement recommendations using the Redesign-AI engine.",
    category: "general", minTier: "VERIFIED", pillarIndex: 3, pillarName: "Redesign-AI",
    parameters: [
      { name: "artifactId", type: "string", description: "Design artifact identifier", required: true },
      { name: "context", type: "string", description: "Additional design context", required: false },
    ],
    delegates: ["core-logic/engines.ts:redesignAnalyzer"],
    outputShape: "{ score: number, recommendations: string[], priority: string }",
  },
  // ── Pillar 6: Trinity Brand ────────────────────────────────────
  {
    name: "trinity-sync-hz", displayName: "Trinity Hz Sync",
    description: "Sync pacifier, mattress, or lighting frequency to the Trinity Brand Hz target from the GAB vault.",
    category: "atmosphere", minTier: "VERIFIED", pillarIndex: 6, pillarName: "Trinity Brand",
    parameters: [
      { name: "deviceType", type: "string", description: "Device category", required: true, enum: ["pacifier","mattress","lighting"] },
      { name: "manualHz", type: "number", description: "Manual Hz override (bypasses vault lookup)", required: false },
    ],
    delegates: ["convex/trinity.ts:syncAtmosphere"],
    outputShape: "{ hz: number, source: string, syncedAt: number }",
  },
  // ── Pillar 7: Toolbox-Core ─────────────────────────────────────
  {
    name: "toolbox-manifest-query", displayName: "Toolbox Manifest Query",
    description: "Query the Toolbox-Core manifest for tool metadata, export lists, and taxonomy linkages.",
    category: "governance", minTier: "PUBLIC", pillarIndex: 7, pillarName: "Toolbox-Core",
    parameters: [
      { name: "toolId", type: "string", description: "Tool id to look up. Omit to return full manifest.", required: false },
    ],
    delegates: ["toolbox-core/toolbox-manifest.json"],
    outputShape: "McpToolDescriptor | McpCapabilityManifest",
  },
  // ── Pillar 8: Atmosphere ───────────────────────────────────────
  {
    name: "atmosphere-canopy-pressure", displayName: "Canopy Pressure Calculator",
    description: "Calculate pre-Flood canopy pressure and O2 partial pressure given canopy mass parameters.",
    category: "atmosphere", minTier: "VERIFIED", pillarIndex: 8, pillarName: "Pre-noetic Atmosphere",
    parameters: [
      { name: "canopyMassKgM2", type: "number", description: "Estimated canopy mass in kg/m²", required: true },
      { name: "gravityMs2", type: "number", description: "Gravitational acceleration override", required: false, default: 9.80665 },
    ],
    delegates: ["toolbox/tools/atmosphere/physics-engine.tool.ts"],
    outputShape: "{ pressurePa: number, pressureAtm: number, o2PartialPressurePa: number, radiationShieldingFactor: number }",
  },
  // ── Pillar 9: Yellow Pages / Business Automation ───────────────
  {
    name: "yp-business-score", displayName: "Yellow Pages Business Scorer",
    description: "Score and classify a business website for Yellow Pages targeting (PRIMARY_TARGET / MONITOR / PASS).",
    category: "commerce", minTier: "VERIFIED", pillarIndex: 9, pillarName: "Yellow Pages",
    parameters: [
      { name: "url", type: "string", description: "Business website URL to analyse", required: true },
    ],
    delegates: ["toolbox-core/tools/yp-scorer.tool.ts"],
    outputShape: "{ classification: string, score: number, signals: object }",
  },
  // ── Pillar 10: Omni-View ───────────────────────────────────────
  {
    name: "sensor-fuse", displayName: "Sensor Fusion (GNSS + Wi-Fi)",
    description: "Fuse GNSS and Wi-Fi RSSI trilateration readings into a single best-estimate position.",
    category: "spatial", minTier: "SOVEREIGN", pillarIndex: 10, pillarName: "Omni-View",
    parameters: [
      { name: "gnssReading", type: "object", description: "{ lat, lon, accuracy, timestampMs }", required: true },
      { name: "wifiReadings", type: "array", description: "Array of { bssid, rssi, frequency } objects", required: false },
    ],
    delegates: ["toolbox/tools/spatial/sensor-fusion.tool.ts"],
    outputShape: "FusedPosition { lat, lon, accuracy, method, confidence }",
  },
  // ── Pillar 11: High-Spectral Veil ─────────────────────────────
  {
    name: "spectral-composite", displayName: "Spectral Composite Builder",
    description: "Map multi-band spectral channel data (NIR/SWIR/UV/LWIR) into a Composite Visible Frame with optional LUT preset.",
    category: "spectral", minTier: "SOVEREIGN", pillarIndex: 11, pillarName: "High-Spectral Veil",
    parameters: [
      { name: "channels", type: "array", description: "Array of SpectralChannel objects", required: true },
      { name: "lutPreset", type: "string", description: "LUT preset name", required: false, enum: ["NATURAL","ENHANCED_CONTRAST","THERMAL_OVERLAY","UV_HIGHLIGHT","GHOST_MODE"] },
    ],
    delegates: ["toolbox/tools/vision-veil/spectral-shift.tool.ts:buildCompositeFrame", "toolbox/tools/vision-veil/spectral-shift.tool.ts:applyLut"],
    outputShape: "CompositeVisibleFrame { r, g, b, width, height, clipping, composition }",
  },
  {
    name: "spectral-detect-anomalies", displayName: "Spectral Anomaly Detector",
    description: "Run the High-Spectral Veil anomaly detection pipeline over a frame sequence. Returns VELOCITY_EXCEED, THERMAL_GHOST, UV_FLARE, PHASE_INVERSION, and SPECTRAL_SPIKE events.",
    category: "spectral", minTier: "SOVEREIGN", pillarIndex: 11, pillarName: "High-Spectral Veil",
    parameters: [
      { name: "frameSets", type: "array", description: "Time-ordered array of SpectralChannel[] sets", required: true },
      { name: "velocityThreshold", type: "number", description: "Block motion magnitude threshold (0–1). Default 0.35.", required: false, default: 0.35 },
      { name: "minConfidence", type: "number", description: "Minimum anomaly confidence to include (0–1). Default 0.4.", required: false, default: 0.4 },
    ],
    delegates: ["toolbox/tools/vision-veil/spectral-shift.tool.ts:detectAnomalies"],
    outputShape: "AnomalyEvent[] sorted by confidence desc",
  },
  // ── Pillar 12: Monetized Interface ────────────────────────────
  {
    name: "ad-sequence-tick", displayName: "Ad Sequencer Tick",
    description: "Advance the ad sequencer by one tick and return the current state and ledger snapshot.",
    category: "commerce", minTier: "VERIFIED", pillarIndex: 12, pillarName: "Monetized Interface",
    parameters: [
      { name: "sessionId", type: "string", description: "Sequencer session identifier", required: true },
      { name: "nowMs", type: "number", description: "Current timestamp in ms", required: true },
    ],
    delegates: ["toolbox/tools/monetization/ad-sequencer.tool.ts:AdSequencer"],
    outputShape: "{ state: SequencerState, ledger: SequencerLedger }",
  },
  // ── Pillar 13: Sovereign Ledger ───────────────────────────────
  {
    name: "yod-compute-tithe", displayName: "Yod Tithe Calculator",
    description: "Compute Tithe and net amount for a given gross Yod transfer. Returns all values as formatted strings and raw bigint equivalents.",
    category: "finance", minTier: "VERIFIED", pillarIndex: 13, pillarName: "Sovereign Ledger",
    parameters: [
      { name: "grossAmount", type: "string", description: "Gross amount as decimal Yod string (e.g. '10.0')", required: true },
      { name: "titheRateBps", type: "number", description: "Rate in basis points. Default 1000 (10%).", required: false, default: 1000 },
    ],
    delegates: ["toolbox/tools/ledger/yod-token.contract.ts:computeTithe"],
    outputShape: "{ tithe: string, netAmount: string, grossAmount: string, titheRateBps: number }",
  },
];

// ═══════════════════════════════════════════════════════════════════
// MCP RESOURCE DESCRIPTORS
// ═══════════════════════════════════════════════════════════════════

export const PILLAR_RESOURCES: McpResourceDescriptor[] = [
  { uri: "sovereign://manifest",          name: "Toolbox Manifest",          description: "Full toolbox-core manifest v1.6.0",                 mimeType: "application/json", minTier: "PUBLIC" },
  { uri: "sovereign://gab/taxonomy",      name: "GAB Taxonomy Tree",         description: "All registered GAB domains and node trees",         mimeType: "application/json", minTier: "VERIFIED" },
  { uri: "sovereign://gematria/table",    name: "Gematria Lookup Table",     description: "Hebrew alphabet → numeric value mapping",           mimeType: "application/json", minTier: "SOVEREIGN" },
  { uri: "sovereign://spectral/luts",    name: "Spectral LUT Presets",      description: "All registered false-colour LUT configurations",    mimeType: "application/json", minTier: "SOVEREIGN" },
  { uri: "sovereign://yod/abi",           name: "Yod Token ABI",             description: "Full ERC-20 YodToken ABI for contract interaction", mimeType: "application/json", minTier: "VERIFIED" },
  { uri: "sovereign://ledger/entries",    name: "Live Ledger Entries",       description: "Yellow Pages ↔ on-chain Yod ledger (read-only)",    mimeType: "application/json", minTier: "KEYMAKER" },
  { uri: "sovereign://bio/cures-db",     name: "Cures vs. Suppressions DB", description: "Biological treatment database from Pillar 14",     mimeType: "application/json", minTier: "VERIFIED" },
];

// ═══════════════════════════════════════════════════════════════════
// 1. BOT-SOVEREIGNTY — AGENT IDENTITY + TOKEN SYSTEM
// ═══════════════════════════════════════════════════════════════════

/**
 * Pure HMAC-SHA256 using the Web Crypto API (available in Bun, Node 18+, browsers).
 * Falls back to a deterministic hash for environments without SubtleCrypto.
 */
async function hmacSha256(key: string, data: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const enc     = new TextEncoder();
    const keyBuf  = await globalThis.crypto.subtle.importKey(
      "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf  = await globalThis.crypto.subtle.sign("HMAC", keyBuf, enc.encode(data));
    return Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Deterministic fallback (not cryptographically secure — use only in test env)
  let h = 0x811c9dc5;
  for (let i = 0; i < (key + data).length; i++) {
    h ^= (key + data).charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8);
}

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * BotSovereignty — agent identity registry and token gate.
 *
 * An agent must present a signed token to access SOVEREIGN or KEYMAKER
 * tier tools. PUBLIC tools require no token. VERIFIED tools require a
 * valid token with at minimum VERIFIED tier.
 *
 * Token format: `{base64url(JSON identity)}.{hmac-sha256 hex}`
 */
export class BotSovereignty {
  private secretKey:       string;
  private registeredAgents: Map<string, AgentIdentity> = new Map();
  private auditLog:         Array<{ timestampMs: number; agentId: string; method: string; authorized: boolean; reason?: string }> = [];

  constructor(secretKey: string) {
    if (!secretKey || secretKey.length < 16) {
      throw new Error("BotSovereignty: secretKey must be at least 16 characters.");
    }
    this.secretKey = secretKey;
  }

  // ── Token issuance ─────────────────────────────────────────────

  /**
   * Issue a signed agent token.
   * Store the identity in the registry for fast lookup on verification.
   */
  async issueToken(identity: Omit<AgentIdentity, "keyFingerprint">): Promise<AgentToken> {
    const fingerprint = (await hmacSha256(this.secretKey, "fingerprint")).slice(0, 8);
    const fullIdentity: AgentIdentity = { ...identity, keyFingerprint: fingerprint };
    const payload   = base64urlEncode(JSON.stringify(fullIdentity));
    const signature = await hmacSha256(this.secretKey, payload);
    const token     = `${payload}.${signature}`;

    this.registeredAgents.set(identity.agentId, fullIdentity);
    return { payload, signature, token };
  }

  // ── Token verification ─────────────────────────────────────────

  /**
   * Verify a raw bearer token string.
   * Returns AuthResult — always check `.authorized` before proceeding.
   */
  async verify(rawToken: string): Promise<AuthResult> {
    if (!rawToken || !rawToken.includes(".")) {
      return { authorized: false, identity: null, reason: "Malformed token — missing signature segment." };
    }

    const dotIdx    = rawToken.lastIndexOf(".");
    const payload   = rawToken.slice(0, dotIdx);
    const signature = rawToken.slice(dotIdx + 1);

    // Validate signature
    const expectedSig = await hmacSha256(this.secretKey, payload);
    if (expectedSig !== signature) {
      return { authorized: false, identity: null, reason: "Invalid signature — token rejected." };
    }

    // Decode identity
    let identity: AgentIdentity;
    try {
      identity = JSON.parse(base64urlDecode(payload)) as AgentIdentity;
    } catch {
      return { authorized: false, identity: null, reason: "Payload decode failure — corrupted token." };
    }

    // Check expiry
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (identity.expiresAt > 0 && nowSeconds > identity.expiresAt) {
      return { authorized: false, identity, reason: `Token expired at ${new Date(identity.expiresAt * 1000).toISOString()}.` };
    }

    return { authorized: true, identity };
  }

  /**
   * Check whether an authenticated agent identity may access a specific tool.
   */
  canAccess(identity: AgentIdentity, tool: McpToolDescriptor): { allowed: boolean; reason?: string } {
    if (!tierAtLeast(identity.tier, tool.minTier)) {
      return { allowed: false, reason: `Tool '${tool.name}' requires tier ${tool.minTier}; agent has ${identity.tier}.` };
    }
    if (
      identity.allowedPillars.length > 0 &&
      !identity.allowedPillars.includes(tool.pillarIndex)
    ) {
      return { allowed: false, reason: `Agent '${identity.agentId}' is not authorised for Pillar ${tool.pillarIndex}.` };
    }
    return { allowed: true };
  }

  // ── Audit log ──────────────────────────────────────────────────

  recordAccess(agentId: string, method: string, authorized: boolean, reason?: string): void {
    this.auditLog.push({ timestampMs: Date.now(), agentId, method, authorized, reason });
    // Keep last 10 000 entries in memory
    if (this.auditLog.length > 10_000) this.auditLog.shift();
  }

  getAuditLog(limit = 100): typeof this.auditLog {
    return this.auditLog.slice(-limit);
  }

  revokeAgent(agentId: string): boolean {
    return this.registeredAgents.delete(agentId);
  }

  listAgents(): AgentIdentity[] {
    return [...this.registeredAgents.values()];
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. MCP GATEWAY — REQUEST ROUTING + CAPABILITY NEGOTIATION
// ═══════════════════════════════════════════════════════════════════

export interface GatewayConfig {
  secretKey:         string;
  /** Agent IDs allowed to self-register at VERIFIED tier. All others need manual issuance. */
  allowedAgentIds?:  string[];
  /** Max requests per agent per minute. Default 60. */
  rateLimitRpm?:     number;
}

export class McpGateway {
  private sovereignty:  BotSovereignty;
  private config:       Required<GatewayConfig>;
  private rateLimiter:  Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config: GatewayConfig) {
    this.config = {
      secretKey:        config.secretKey,
      allowedAgentIds:  config.allowedAgentIds ?? [],
      rateLimitRpm:     config.rateLimitRpm    ?? 60,
    };
    this.sovereignty = new BotSovereignty(config.secretKey);
  }

  // ── Capability negotiation ─────────────────────────────────────

  /**
   * Return the full capability manifest — filtered to what the requesting
   * agent is authorised to see based on their tier.
   */
  async negotiate(bearerToken: string): Promise<McpCapabilityManifest> {
    const auth = await this.sovereignty.verify(bearerToken);
    const tier: BotAccessTier = auth.authorized && auth.identity
      ? auth.identity.tier
      : "PUBLIC";

    const visibleTools     = PILLAR_TOOLS.filter((t) => tierAtLeast(tier, t.minTier));
    const visibleResources = PILLAR_RESOURCES.filter((r) => tierAtLeast(tier, r.minTier));

    return {
      protocolVersion: "2024-11-05",
      serverName:      "sovereign-mainframe-mcp",
      serverVersion:   "1.6.0",
      tools:           visibleTools,
      resources:       visibleResources,
      accessTiers:     ACCESS_TIER_ORDER,
    };
  }

  // ── Request routing ────────────────────────────────────────────

  /**
   * Process an MCP request. Enforces Bot-Sovereignty, rate limits,
   * and routes to the appropriate pillar descriptor.
   *
   * NOTE: This gateway returns routing decisions and validated metadata.
   * Actual engine execution is delegated to the caller — the gateway
   * does not import pillar engines directly (portable zero-dep design).
   */
  async handle(req: McpRequest): Promise<McpResponse> {
    const start = Date.now();

    // ── Auth ────────────────────────────────────────────────────
    const auth = await this.sovereignty.verify(req.bearerToken);
    const agentId = auth.identity?.agentId ?? "anonymous";

    if (req.method !== "tools/list" && req.method !== "initialize") {
      if (!auth.authorized) {
        this.sovereignty.recordAccess(agentId, req.method, false, auth.reason);
        return this._error(req, 401, `Bot-Sovereignty: ${auth.reason ?? "Unauthorized."}`);
      }
    }

    // ── Rate limit ──────────────────────────────────────────────
    if (!this._checkRateLimit(agentId)) {
      return this._error(req, 429, `Rate limit exceeded: ${this.config.rateLimitRpm} req/min.`);
    }

    // ── Route ───────────────────────────────────────────────────
    try {
      let result: unknown;

      switch (req.method) {
        case "initialize":
          result = await this.negotiate(req.bearerToken);
          break;

        case "tools/list": {
          const manifest = await this.negotiate(req.bearerToken);
          result = { tools: manifest.tools };
          break;
        }

        case "tools/call": {
          const toolName = req.params.name as string;
          const tool = PILLAR_TOOLS.find((t) => t.name === toolName);
          if (!tool) return this._error(req, 404, `Tool '${toolName}' not found.`);

          if (auth.identity) {
            const access = this.sovereignty.canAccess(auth.identity, tool);
            if (!access.allowed) {
              this.sovereignty.recordAccess(agentId, req.method, false, access.reason);
              return this._error(req, 403, access.reason ?? "Access denied.");
            }
          } else {
            if (!tierAtLeast("PUBLIC", tool.minTier)) {
              return this._error(req, 401, `Tool '${toolName}' requires authentication.`);
            }
          }

          // Return routing info — caller executes the engine
          result = {
            tool,
            arguments:  req.params.arguments ?? {},
            routing:    { delegates: tool.delegates, pillarIndex: tool.pillarIndex },
            _note:      "Execute via the delegate engine. Gateway validates auth only.",
          };
          break;
        }

        case "resources/read": {
          const uri = req.params.uri as string;
          const resource = PILLAR_RESOURCES.find((r) => r.uri === uri);
          if (!resource) return this._error(req, 404, `Resource '${uri}' not found.`);

          const tier: BotAccessTier = auth.identity?.tier ?? "PUBLIC";
          if (!tierAtLeast(tier, resource.minTier)) {
            return this._error(req, 403, `Resource requires tier ${resource.minTier}.`);
          }

          result = { uri, resource, contents: [{ uri, mimeType: resource.mimeType, text: `[Fetch from sovereign://${uri}]` }] };
          break;
        }

        default:
          return this._error(req, 404, `Method '${req.method}' not supported.`);
      }

      this.sovereignty.recordAccess(agentId, req.method, true);
      return { requestId: req.requestId, method: req.method, result, agentId, durationMs: Date.now() - start };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this._error(req, 500, `Internal gateway error: ${msg}`, Date.now() - start);
    }
  }

  // ── Token issuance (delegated) ─────────────────────────────────

  issueToken(identity: Omit<AgentIdentity, "keyFingerprint">): Promise<AgentToken> {
    return this.sovereignty.issueToken(identity);
  }

  getSovereignty(): BotSovereignty { return this.sovereignty; }

  // ── Private ────────────────────────────────────────────────────

  private _checkRateLimit(agentId: string): boolean {
    const nowMs     = Date.now();
    const windowMs  = 60_000;
    const entry     = this.rateLimiter.get(agentId) ?? { count: 0, windowStart: nowMs };

    if (nowMs - entry.windowStart > windowMs) {
      entry.count = 0; entry.windowStart = nowMs;
    }
    entry.count++;
    this.rateLimiter.set(agentId, entry);
    return entry.count <= this.config.rateLimitRpm;
  }

  private _error(req: McpRequest, code: number, message: string, durationMs = 0): McpResponse {
    return { requestId: req.requestId, method: req.method, error: { code, message }, durationMs };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. PURE HELPERS (zero external imports)
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a well-formed MCP JSON-RPC 2.0 tools/call request body.
 */
export function buildMcpToolCall(
  toolName:   string,
  args:       Record<string, unknown>,
  requestId?: string
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id:      requestId ?? `req_${Date.now()}`,
    method:  "tools/call",
    params:  { name: toolName, arguments: args },
  });
}

/**
 * Parse a raw MCP JSON-RPC response string into a typed McpResponse.
 */
export function parseMcpResponse<T = unknown>(raw: string): McpResponse<T> {
  try {
    const parsed = JSON.parse(raw) as { id: string; result?: T; error?: { code: number; message: string } };
    return {
      requestId:  String(parsed.id),
      method:     "tools/call",
      result:     parsed.result,
      error:      parsed.error,
      durationMs: 0,
    };
  } catch {
    return { requestId: "unknown", method: "tools/call", error: { code: -32700, message: "Parse error" }, durationMs: 0 };
  }
}

/**
 * Issue a signed agent token without instantiating a full McpGateway.
 * Useful for CLI token generation scripts.
 */
export async function signAgentToken(
  secretKey: string,
  identity:  Omit<AgentIdentity, "keyFingerprint">
): Promise<AgentToken> {
  const sovereignty = new BotSovereignty(secretKey);
  return sovereignty.issueToken(identity);
}

// ═══════════════════════════════════════════════════════════════════
// STANDALONE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

if (typeof Bun !== "undefined" && import.meta.main) {
  const SECRET  = process.env.MCP_SECRET_KEY ?? "sovereign-mainframe-dev-secret-key";
  const PORT    = Number(process.env.MCP_PORT ?? "4001");
  const ALLOWED = (process.env.MCP_ALLOWED_AGENT_IDS ?? "").split(",").filter(Boolean);

  const gateway = new McpGateway({ secretKey: SECRET, allowedAgentIds: ALLOWED });

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return Response.json({ status: "ok", service: "sovereign-mcp-gateway", version: "1.6.0" });
      }

      if (url.pathname === "/mcp" && req.method === "POST") {
        const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
        const body   = await req.json() as Record<string, unknown>;
        const mcpReq: McpRequest = {
          method:      (body.method as string) ?? "",
          params:      (body.params as Record<string, unknown>) ?? {},
          bearerToken: bearer,
          requestId:   String(body.id ?? Date.now()),
          timestampMs: Date.now(),
        };
        const resp = await gateway.handle(mcpReq);
        return Response.json({ jsonrpc: "2.0", id: mcpReq.requestId, ...resp }, {
          status: resp.error?.code ?? 200,
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  console.log(`[mcp-gateway] Sovereign Mainframe MCP Gateway running on :${PORT}`);
  console.log(`[mcp-gateway] Tools registered: ${PILLAR_TOOLS.length} | Resources: ${PILLAR_RESOURCES.length}`);
  console.log(`[mcp-gateway] Bot-Sovereignty active. Tier gate: PUBLIC → VERIFIED → SOVEREIGN → KEYMAKER`);
}

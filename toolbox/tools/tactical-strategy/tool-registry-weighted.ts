/**
 * toolbox/tools/tactical-strategy/tool-registry-weighted.ts
 * version: 1.0.0
 *
 * Pillar 24: Tool Arbitration Layer
 * Domain: Strategic-Emergence
 *
 * Indexes all Sovereign Mainframe tools alongside a computed
 * Success-to-Cost (StC) ratio and exposes a capability-tag query
 * API so agents can discover the most efficient tool for a task
 * without knowing tool IDs in advance.
 *
 * Success-to-Cost ratio:
 *   StC = (successRate × avgConfidence) / normalizedCost
 *
 *   normalizedCost = computeCost / maxComputeCostAcrossRegistry
 *   so a cheaper tool with the same success rate scores higher.
 *
 * Capability tags (examples):
 *   "text-generation", "image-analysis", "rate-limiting",
 *   "taxonomy", "telemetry", "mutation", "crossover",
 *   "agent-lifecycle", "sensor-ingestion", "scoring", …
 *
 * Query modes:
 *   byTags(tags[])       — returns tools matching ALL tags, sorted by StC
 *   bestFor(tags[], n)   — top-N tools for a given capability set
 *   byPillar(pillarId)   — all tools for a pillar, sorted by StC
 *   search(query)        — fuzzy substring match on name + description + tags
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ToolTier = "BASIC" | "PRO" | "ENTERPRISE" | "INTERNAL";
export type ToolStatus = "ACTIVE" | "DEPRECATED" | "EXPERIMENTAL" | "DISABLED";

export interface ToolCost {
  /** Relative compute cost [0, ∞). Lower = cheaper. */
  compute:   number;
  /** Estimated wall-clock latency in ms (p50) */
  latencyMs: number;
  /** Whether this tool incurs an external API cost */
  hasApiCost: boolean;
  /** Tier required to access */
  tier: ToolTier;
}

export interface ToolPerformance {
  /** Total invocations recorded */
  invocations:    number;
  successCount:   number;
  retryCount:     number;
  abandonCount:   number;
  avgLatencyMs:   number;
  avgConfidence:  number;
  /** Computed lazily — call registry.recomputeStC() to refresh */
  successRate:    number;
  /** Success-to-Cost ratio — primary sort key */
  stcRatio:       number;
  lastUpdatedAt:  number | null;
}

export interface WeightedToolEntry {
  /** Must match id in toolbox-manifest.json */
  toolId:       string;
  name:         string;
  pillarId:     string;
  description:  string;
  /** Tags agents use to discover this tool by capability */
  capabilityTags: string[];
  /** Domains in the GAB taxonomy */
  taxonomyDomains: string[];
  cost:         ToolCost;
  performance:  ToolPerformance;
  status:       ToolStatus;
  /** File path relative to repo root */
  path:         string;
  /** Exported class / function names */
  exports:      string[];
  registeredAt: number;
}

export interface ToolQuery {
  /** ALL of these tags must be present */
  tags?:       string[];
  /** ANY of these tags must be present */
  anyTags?:    string[];
  pillarId?:   string;
  status?:     ToolStatus;
  tier?:       ToolTier;
  maxLatencyMs?: number;
  hasApiCost?:   boolean;
  minStcRatio?:  number;
  limit?:      number;
}

export interface ToolQueryResult {
  tool:     WeightedToolEntry;
  stcRatio: number;
  matchedTags: string[];
  rank:     number;
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

export function defaultPerformance(): ToolPerformance {
  return {
    invocations:   0,
    successCount:  0,
    retryCount:    0,
    abandonCount:  0,
    avgLatencyMs:  0,
    avgConfidence: 0,
    successRate:   0,
    stcRatio:      0,
    lastUpdatedAt: null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// WEIGHTED TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════

export class WeightedToolRegistry {
  private tools: Map<string, WeightedToolEntry> = new Map();

  // ── Registration ─────────────────────────────────────────────────

  register(entry: Omit<WeightedToolEntry, "performance" | "registeredAt"> & {
    performance?: Partial<ToolPerformance>;
  }): WeightedToolEntry {
    const full: WeightedToolEntry = {
      ...entry,
      performance:  { ...defaultPerformance(), ...(entry.performance ?? {}) },
      registeredAt: Date.now(),
    };
    this.tools.set(entry.toolId, full);
    this.recomputeStC();
    return full;
  }

  registerMany(entries: Parameters<typeof this.register>[0][]): void {
    for (const e of entries) {
      const full: WeightedToolEntry = {
        ...e,
        performance:  { ...defaultPerformance(), ...(e.performance ?? {}) },
        registeredAt: Date.now(),
      };
      this.tools.set(e.toolId, full);
    }
    this.recomputeStC();
  }

  // ── Performance updates ──────────────────────────────────────────

  /**
   * Record a single invocation outcome and refresh the StC ratio.
   */
  recordInvocation(
    toolId:     string,
    outcome:    "SUCCESS" | "RETRY" | "ABANDON",
    latencyMs:  number,
    confidence: number
  ): void {
    const entry = this.tools.get(toolId);
    if (!entry) return;
    const p = entry.performance;
    const n = p.invocations;

    p.invocations++;
    if (outcome === "SUCCESS") p.successCount++;
    else if (outcome === "RETRY")   p.retryCount++;
    else p.abandonCount++;

    // Rolling average for latency and confidence
    p.avgLatencyMs   = (p.avgLatencyMs * n + latencyMs)  / (n + 1);
    p.avgConfidence  = (p.avgConfidence * n + confidence) / (n + 1);
    p.successRate    = p.successCount / p.invocations;
    p.lastUpdatedAt  = Date.now();

    this.tools.set(toolId, entry);
    this.recomputeStC();
  }

  /**
   * Bulk-update performance from Pillar 17-EVO telemetry data.
   */
  syncFromTelemetry(
    toolId:  string,
    stats: {
      invocations:   number;
      successCount:  number;
      retryCount:    number;
      abandonCount:  number;
      avgLatencyMs:  number;
      avgConfidence: number;
    }
  ): void {
    const entry = this.tools.get(toolId);
    if (!entry) return;
    entry.performance = {
      ...entry.performance,
      ...stats,
      successRate:   stats.invocations > 0 ? stats.successCount / stats.invocations : 0,
      lastUpdatedAt: Date.now(),
    };
    this.tools.set(toolId, entry);
    this.recomputeStC();
  }

  // ── StC recomputation ────────────────────────────────────────────

  /**
   * Recompute the Success-to-Cost ratio for all tools.
   * Must be called after any performance or cost update.
   *
   * StC = (successRate × avgConfidence) / normalizedCost
   *
   * Tools with zero invocations receive an assumed successRate of 0.5
   * and avgConfidence of 0.5 (neutral prior) for tie-breaking.
   */
  recomputeStC(): void {
    const entries = [...this.tools.values()];
    const maxCost = Math.max(...entries.map((e) => e.cost.compute), 1);

    for (const entry of entries) {
      const p       = entry.performance;
      const sr      = p.invocations > 0 ? p.successRate    : 0.5;
      const conf    = p.invocations > 0 ? p.avgConfidence  : 0.5;
      const normCost = Math.max(0.001, entry.cost.compute / maxCost);
      p.stcRatio = (sr * conf) / normCost;
      this.tools.set(entry.toolId, entry);
    }
  }

  // ── Query interface ───────────────────────────────────────────────

  /**
   * Find tools matching ALL specified capability tags, sorted by StC ratio.
   */
  byTags(tags: string[]): ToolQueryResult[] {
    return this._query({ tags, status: "ACTIVE" });
  }

  /**
   * Return the top-N most efficient tools for a capability set.
   */
  bestFor(tags: string[], n = 3): ToolQueryResult[] {
    return this._query({ tags, status: "ACTIVE", limit: n });
  }

  /**
   * All tools for a given pillar, sorted by StC ratio.
   */
  byPillar(pillarId: string): ToolQueryResult[] {
    return this._query({ pillarId, status: "ACTIVE" });
  }

  /**
   * Full structured query with all filter options.
   */
  query(q: ToolQuery): ToolQueryResult[] {
    return this._query(q);
  }

  /**
   * Fuzzy substring search across name, description, and tags.
   */
  search(term: string, limit = 10): ToolQueryResult[] {
    const lc = term.toLowerCase();
    const matches = [...this.tools.values()].filter((t) =>
      t.name.toLowerCase().includes(lc)        ||
      t.description.toLowerCase().includes(lc) ||
      t.capabilityTags.some((tag) => tag.includes(lc))
    );
    return matches
      .sort((a, b) => b.performance.stcRatio - a.performance.stcRatio)
      .slice(0, limit)
      .map((t, i) => ({
        tool:        t,
        stcRatio:    t.performance.stcRatio,
        matchedTags: t.capabilityTags.filter((tag) => tag.includes(lc)),
        rank:        i + 1,
      }));
  }

  // ── Direct access ─────────────────────────────────────────────────

  getById(toolId: string): WeightedToolEntry | null {
    return this.tools.get(toolId) ?? null;
  }

  getAll(): WeightedToolEntry[] {
    return [...this.tools.values()];
  }

  count(): number {
    return this.tools.size;
  }

  // ── Internal query engine ─────────────────────────────────────────

  private _query(q: ToolQuery): ToolQueryResult[] {
    let results = [...this.tools.values()];

    if (q.status)        results = results.filter((t) => t.status === q.status);
    if (q.pillarId)      results = results.filter((t) => t.pillarId === q.pillarId);
    if (q.tier)          results = results.filter((t) => t.cost.tier === q.tier);
    if (q.hasApiCost !== undefined) results = results.filter((t) => t.cost.hasApiCost === q.hasApiCost);
    if (q.maxLatencyMs)  results = results.filter((t) => t.cost.latencyMs <= q.maxLatencyMs!);
    if (q.minStcRatio)   results = results.filter((t) => t.performance.stcRatio >= q.minStcRatio!);

    if (q.tags?.length) {
      results = results.filter((t) =>
        q.tags!.every((tag) => t.capabilityTags.includes(tag))
      );
    }
    if (q.anyTags?.length) {
      results = results.filter((t) =>
        q.anyTags!.some((tag) => t.capabilityTags.includes(tag))
      );
    }

    results.sort((a, b) => b.performance.stcRatio - a.performance.stcRatio);
    if (q.limit) results = results.slice(0, q.limit);

    return results.map((t, i) => ({
      tool:        t,
      stcRatio:    t.performance.stcRatio,
      matchedTags: q.tags
        ? t.capabilityTags.filter((tag) => q.tags!.includes(tag))
        : t.capabilityTags,
      rank:        i + 1,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP — seed registry from toolbox-manifest.json entries
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a WeightedToolRegistry from a parsed toolbox-manifest.json.
 * Assigns neutral performance values for all tools.
 * Compute costs are estimated from pillar complexity tiers:
 *   API-dependent tools → compute 5–8
 *   Pure computation    → compute 1–3
 *   Hybrid             → compute 3–5
 */
export function buildRegistryFromManifest(manifest: {
  tools: Array<{
    id: string;
    name: string;
    path: string;
    description: string;
    pillar?: string;
    exports?: string[];
    taxonomyDomains?: string[];
    dependencies?: string[];
  }>;
}): WeightedToolRegistry {
  const registry = new WeightedToolRegistry();

  for (const t of manifest.tools) {
    // Derive capability tags from name, pillar, and description keywords
    const tags = deriveCapabilityTags(t.name, t.description ?? "", t.pillar ?? "");
    const hasApiCost = /openai|llm|vlm|gpt|vision|supabase/i.test(t.description ?? "");
    const compute    = hasApiCost ? 6 : (t.dependencies?.length ?? 0) > 2 ? 4 : 2;

    registry.register({
      toolId:          t.id,
      name:            t.name,
      pillarId:        t.pillar ?? "core",
      description:     (t.description ?? "").slice(0, 300),
      capabilityTags:  tags,
      taxonomyDomains: t.taxonomyDomains ?? [],
      cost: {
        compute,
        latencyMs:   hasApiCost ? 3_000 : 200,
        hasApiCost,
        tier: "INTERNAL",
      },
      status:  "ACTIVE",
      path:    t.path,
      exports: t.exports ?? [],
    });
  }

  return registry;
}

function deriveCapabilityTags(name: string, description: string, pillar: string): string[] {
  const combined = `${name} ${description} ${pillar}`.toLowerCase();
  const tagMap: [RegExp, string][] = [
    [/text.generat|prompt|mutation|crossover|linguistic/,       "text-generation"],
    [/image|vision|camera|visual|vlm|gpt-4o/,                  "image-analysis"],
    [/rate.limit|quota|key.manag|api.key/,                      "rate-limiting"],
    [/taxonomy|categor|tag|classif/,                            "taxonomy"],
    [/telemetr|log|record|invocation/,                          "telemetry"],
    [/score|fitness|confidence|evaluat/,                        "scoring"],
    [/agent|heartbeat|lifecycle|worker|critic|fixer/,           "agent-lifecycle"],
    [/sensor|csi|iot|camera.frame|ambient|ingest/,              "sensor-ingestion"],
    [/equilibrium|nash|correlat|scalar/,                        "optimization"],
    [/scene.graph|3d|geometry|vision.to/,                       "spatial-reasoning"],
    [/format|extract|miner|transmut/,                           "format-extraction"],
    [/cluster|evolv|proposal|seed.categor/,                     "unsupervised-learning"],
    [/sequence|chain|blueprint|invocation.chain/,               "sequence-planning"],
    [/arbitrat|registry|tool.select|capability/,                "tool-selection"],
    [/merchand|sticker|product|shop/,                           "e-commerce"],
    [/gematria|numerolog/,                                      "gematria"],
    [/redesign|brand|visual.identity/,                          "brand-design"],
    [/parasite|bio.audit|biological/,                           "bio-audit"],
    [/ledger|coin|sovereign.ledger|yod/,                        "ledger"],
    [/mcp|gateway|protocol/,                                    "mcp-gateway"],
    [/geographic|geo.spatial|map/,                              "geospatial"],
    [/report|dashboard|format/,                                 "reporting"],
    [/supabase|database|storage/,                               "data-persistence"],
    [/docker|nas|synolog/,                                       "infrastructure"],
    [/crossover|merge|hybrid/,                                   "crossover"],
    [/perturbat|variation|variant/,                             "perturbation"],
    [/archive|index|store|persist/,                             "archival"],
    [/streaming|realtime|live/,                                  "streaming"],
    [/back.off|retry|resilient|anti.fragile/,                   "resilience"],
  ];

  const tags = new Set<string>();
  for (const [pat, tag] of tagMap) {
    if (pat.test(combined)) tags.add(tag);
  }
  return [...tags];
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatRegistryEntry(e: WeightedToolEntry): string {
  const stc   = e.performance.stcRatio.toFixed(4);
  const sr    = e.performance.invocations > 0
    ? `${(e.performance.successRate * 100).toFixed(1)}%`
    : "—";
  const tags  = e.capabilityTags.slice(0, 6).join(", ");
  return [
    `[${e.status.padEnd(12)}] ${e.toolId.padEnd(30)} StC=${stc}  sr=${sr}  lat=${e.cost.latencyMs}ms`,
    `  name: ${e.name}`,
    `  tags: ${tags}`,
  ].join("\n");
}

export function formatQueryResults(results: ToolQueryResult[]): string {
  if (results.length === 0) return "No tools matched.";
  return results.map((r) =>
    `#${r.rank}  ${r.tool.toolId.padEnd(30)}  StC=${r.stcRatio.toFixed(4)}  tags=[${r.matchedTags.join(",")}]`
  ).join("\n");
}

export function formatRegistryDashboard(registry: WeightedToolRegistry): string {
  const all = registry.getAll().sort((a, b) => b.performance.stcRatio - a.performance.stcRatio);
  const lines = [
    `═══ Weighted Tool Registry  (${all.length} tools)  ${new Date().toISOString()}`,
    "  Rank  Tool ID                          StC      SuccRate  Lat(ms)  Tags",
    "  ────  ───────────────────────────────  ───────  ────────  ───────  ────────────────",
  ];
  for (const [i, e] of all.entries()) {
    const sr  = e.performance.invocations > 0 ? `${(e.performance.successRate * 100).toFixed(1)}%` : "   —  ";
    const tags = e.capabilityTags.slice(0, 3).join(",");
    lines.push(
      `  ${String(i + 1).padStart(4)}  ${e.toolId.padEnd(31)}  ${e.performance.stcRatio.toFixed(4).padEnd(7)}  ${sr.padEnd(8)}  ${String(e.cost.latencyMs).padEnd(7)}  ${tags}`
    );
  }
  return lines.join("\n");
}

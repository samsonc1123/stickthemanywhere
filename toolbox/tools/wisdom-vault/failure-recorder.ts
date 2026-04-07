/**
 * toolbox/tools/wisdom-vault/failure-recorder.ts
 * version: 1.0.0
 *
 * Pillar 25: Negative Knowledge Base
 * Domains: SOVEREIGN-CORRECTION | Antifragile-Wisdom
 *
 * Indexes every failure the Mainframe has experienced so future agents
 * can avoid repeating the same mistakes.
 *
 * Three failure categories:
 *
 *   FAILED_SEQUENCE    — a chain of tool invocations that ended in FAILED/ABANDON.
 *                        Stores the exact toolId sequence and where it broke.
 *   REJECTED_OUTPUT    — an output that was rejected by the CRITIC (confidence
 *                        below hallucinationThreshold or flagged as incoherent).
 *                        Stores the output hash, prompt hash, and rejection reason.
 *   HIGH_LATENCY_PATH  — a tool or sequence whose avg latency exceeded the
 *                        pillar's latency budget, degrading the overall score.
 *
 * Root cause taxonomy (three top-level causes):
 *   LINGUISTIC   — prompt phrasing caused hallucination, incoherence, or
 *                  format violation. Fix: Prompt Mutation (Pillar 23).
 *   LOGIC        — agent reasoning broke down (wrong tool selected, invalid
 *                  plan, circular dependency). Fix: Re-arbitration (Pillar 24).
 *   TOOL_MISMATCH — the selected tool was wrong for the capability required
 *                  (StC too low, tier mismatch, hasApiCost when offline).
 *                  Fix: Registry update (Pillar 24 WeightedToolRegistry).
 *
 * Storage:
 *   InMemoryFailureStore  — default; circular buffer
 *   createSupabaseFailureStore — persistent via Supabase REST
 *     Required table: `failure_records` (schema in file footer)
 *
 * Pure TypeScript — no external dependencies.
 */

import { hashPayload } from "../evolution-engine/telemetry-logger.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type FailureCategory =
  | "FAILED_SEQUENCE"
  | "REJECTED_OUTPUT"
  | "HIGH_LATENCY_PATH";

export type RootCause =
  | "LINGUISTIC"      // prompt phrasing caused the failure
  | "LOGIC"           // agent reasoning / plan was wrong
  | "TOOL_MISMATCH";  // wrong tool selected for the task

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FailureRecord {
  /** Unique failure event ID */
  failureId:      string;
  category:       FailureCategory;
  rootCause:      RootCause;
  severity:       SeverityLevel;
  /** Pillar where this failure occurred */
  pillarId:       string;
  /** Agent that was running when the failure occurred */
  agentId:        string;

  // ── Sequence metadata (FAILED_SEQUENCE) ──────────────────────────
  /** Ordered toolId sequence that failed */
  toolSequence?:  string[];
  /** Index in the sequence where the chain broke */
  breakIndex?:    number;
  /** toolId that caused the break */
  breakingToolId?: string;

  // ── Output metadata (REJECTED_OUTPUT) ────────────────────────────
  /** FNV-1a hash of the rejected output */
  outputHash?:    string;
  /** FNV-1a hash of the prompt that produced the rejected output */
  promptHash?:    string;
  /** CRITIC rejection reason — verbatim */
  rejectionReason?: string;
  /** CRITIC confidence at rejection */
  criticConfidence?: number;

  // ── Latency metadata (HIGH_LATENCY_PATH) ─────────────────────────
  /** Observed latency in ms */
  observedLatencyMs?: number;
  /** The pillar's configured latency budget */
  latencyBudgetMs?:   number;
  /** How much over budget (%) */
  latencyOveragePercent?: number;

  // ── Shared ────────────────────────────────────────────────────────
  /** Human-readable description of what went wrong */
  description:    string;
  /**
   * Negative constraint string — injected into future agent prompts.
   * Written in imperative form: "Do NOT use phrasing X because …"
   */
  negativeConstraint: string;
  /** Task-content hash — used to match similar future tasks */
  taskHash:       string;
  /** Tags for filtering and grouping */
  tags:           string[];
  occurredAt:     number;   // Unix ms
  /** How many times this exact failure pattern has recurred */
  recurrenceCount: number;
  /** Unix ms of last recurrence */
  lastRecurredAt: number | null;
}

export interface FailureFilter {
  category?:   FailureCategory;
  rootCause?:  RootCause;
  severity?:   SeverityLevel;
  pillarId?:   string;
  agentId?:    string;
  taskHash?:   string;
  since?:      number;   // Unix ms
  tags?:       string[];
  limit?:      number;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _seq = 0;
function generateFailureId(): string {
  return `fail_${Date.now().toString(36)}_${(++_seq).toString(36).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════
// SEVERITY CALCULATOR
// ═══════════════════════════════════════════════════════════════════

export function computeSeverity(
  category:    FailureCategory,
  rootCause:   RootCause,
  recurrences: number
): SeverityLevel {
  let base = 0;
  // Category weight
  if (category === "REJECTED_OUTPUT")   base += 2;
  if (category === "FAILED_SEQUENCE")   base += 3;
  if (category === "HIGH_LATENCY_PATH") base += 1;
  // Root cause weight
  if (rootCause === "LOGIC")            base += 2;
  if (rootCause === "LINGUISTIC")       base += 1;
  if (rootCause === "TOOL_MISMATCH")    base += 1;
  // Recurrence weight
  if (recurrences >= 5)  base += 3;
  else if (recurrences >= 2) base += 1;

  if (base >= 7) return "CRITICAL";
  if (base >= 5) return "HIGH";
  if (base >= 3) return "MEDIUM";
  return "LOW";
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface FailureStoreAdapter {
  append(record: FailureRecord): Promise<void>;
  getById(failureId: string): Promise<FailureRecord | null>;
  update(failureId: string, patch: Partial<FailureRecord>): Promise<void>;
  query(filter: FailureFilter): Promise<FailureRecord[]>;
  findSimilar(taskHash: string, limit?: number): Promise<FailureRecord[]>;
  count(filter?: Partial<FailureFilter>): Promise<number>;
  clear(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════════════════════════════

export class InMemoryFailureStore implements FailureStoreAdapter {
  private records: FailureRecord[] = [];

  constructor(private readonly maxSize = 5_000) {}

  async append(record: FailureRecord): Promise<void> {
    if (this.records.length >= this.maxSize) this.records.shift();
    this.records.push({ ...record });
  }

  async getById(failureId: string): Promise<FailureRecord | null> {
    return this.records.find((r) => r.failureId === failureId) ?? null;
  }

  async update(failureId: string, patch: Partial<FailureRecord>): Promise<void> {
    const idx = this.records.findIndex((r) => r.failureId === failureId);
    if (idx === -1) throw new Error(`FailureStore: '${failureId}' not found.`);
    this.records[idx] = { ...this.records[idx], ...patch };
  }

  async query(filter: FailureFilter): Promise<FailureRecord[]> {
    let results = [...this.records];
    if (filter.category)  results = results.filter((r) => r.category  === filter.category);
    if (filter.rootCause) results = results.filter((r) => r.rootCause === filter.rootCause);
    if (filter.severity)  results = results.filter((r) => r.severity  === filter.severity);
    if (filter.pillarId)  results = results.filter((r) => r.pillarId  === filter.pillarId);
    if (filter.agentId)   results = results.filter((r) => r.agentId   === filter.agentId);
    if (filter.taskHash)  results = results.filter((r) => r.taskHash  === filter.taskHash);
    if (filter.since)     results = results.filter((r) => r.occurredAt >= filter.since!);
    if (filter.tags?.length) {
      results = results.filter((r) => filter.tags!.every((t) => r.tags.includes(t)));
    }
    results.sort((a, b) => b.occurredAt - a.occurredAt);
    if (filter.limit) results = results.slice(0, filter.limit);
    return results;
  }

  async findSimilar(taskHash: string, limit = 10): Promise<FailureRecord[]> {
    return this.records
      .filter((r) => r.taskHash === taskHash)
      .sort((a, b) => b.recurrenceCount - a.recurrenceCount)
      .slice(0, limit);
  }

  async count(filter?: Partial<FailureFilter>): Promise<number> {
    if (!filter) return this.records.length;
    return (await this.query(filter as FailureFilter)).length;
  }

  async clear(): Promise<void> {
    this.records = [];
  }

  snapshot(): FailureRecord[] {
    return [...this.records];
  }
}

// ═══════════════════════════════════════════════════════════════════
// FAILURE RECORDER  (high-level manager)
// ═══════════════════════════════════════════════════════════════════

export class FailureRecorder {
  constructor(
    private readonly store: FailureStoreAdapter = new InMemoryFailureStore()
  ) {}

  // ── Record a failed sequence ─────────────────────────────────────

  async recordFailedSequence(opts: {
    pillarId:      string;
    agentId:       string;
    taskInput:     unknown;
    toolSequence:  string[];
    breakIndex:    number;
    breakingToolId: string;
    description:   string;
    tags?:         string[];
  }): Promise<FailureRecord> {
    const taskHash = hashPayload(opts.taskInput);
    return this._upsert({
      category:        "FAILED_SEQUENCE",
      rootCause:       this._inferRootCause("FAILED_SEQUENCE", opts.description),
      pillarId:        opts.pillarId,
      agentId:         opts.agentId,
      taskHash,
      toolSequence:    opts.toolSequence,
      breakIndex:      opts.breakIndex,
      breakingToolId:  opts.breakingToolId,
      description:     opts.description,
      negativeConstraint: this._buildNegativeConstraint("FAILED_SEQUENCE", {
        toolSequence:  opts.toolSequence,
        breakingToolId: opts.breakingToolId,
        description:   opts.description,
      }),
      tags: [...(opts.tags ?? []), "failed-sequence", opts.breakingToolId],
    });
  }

  // ── Record a rejected output ──────────────────────────────────────

  async recordRejectedOutput(opts: {
    pillarId:         string;
    agentId:          string;
    taskInput:        unknown;
    promptTemplate:   string;
    output:           unknown;
    rejectionReason:  string;
    criticConfidence: number;
    tags?:            string[];
  }): Promise<FailureRecord> {
    const taskHash = hashPayload(opts.taskInput);
    return this._upsert({
      category:         "REJECTED_OUTPUT",
      rootCause:        this._inferRootCause("REJECTED_OUTPUT", opts.rejectionReason),
      pillarId:         opts.pillarId,
      agentId:          opts.agentId,
      taskHash,
      outputHash:       hashPayload(opts.output),
      promptHash:       hashPayload(opts.promptTemplate),
      rejectionReason:  opts.rejectionReason,
      criticConfidence: opts.criticConfidence,
      description:      `CRITIC rejected output (confidence=${opts.criticConfidence.toFixed(3)}): ${opts.rejectionReason}`,
      negativeConstraint: this._buildNegativeConstraint("REJECTED_OUTPUT", {
        rejectionReason:  opts.rejectionReason,
        promptTemplate:   opts.promptTemplate,
        criticConfidence: opts.criticConfidence,
      }),
      tags: [...(opts.tags ?? []), "rejected-output"],
    });
  }

  // ── Record a high-latency path ────────────────────────────────────

  async recordHighLatencyPath(opts: {
    pillarId:          string;
    agentId:           string;
    taskInput:         unknown;
    toolSequence:      string[];
    observedLatencyMs: number;
    latencyBudgetMs:   number;
    description?:      string;
    tags?:             string[];
  }): Promise<FailureRecord> {
    const taskHash = hashPayload(opts.taskInput);
    const overage  = ((opts.observedLatencyMs - opts.latencyBudgetMs) / opts.latencyBudgetMs) * 100;
    return this._upsert({
      category:               "HIGH_LATENCY_PATH",
      rootCause:              "TOOL_MISMATCH",
      pillarId:               opts.pillarId,
      agentId:                opts.agentId,
      taskHash,
      toolSequence:           opts.toolSequence,
      observedLatencyMs:      opts.observedLatencyMs,
      latencyBudgetMs:        opts.latencyBudgetMs,
      latencyOveragePercent:  overage,
      description:            opts.description ?? `Path exceeded latency budget by ${overage.toFixed(0)}%: ${opts.toolSequence.join("→")}`,
      negativeConstraint: this._buildNegativeConstraint("HIGH_LATENCY_PATH", {
        toolSequence:          opts.toolSequence,
        observedLatencyMs:     opts.observedLatencyMs,
        latencyBudgetMs:       opts.latencyBudgetMs,
      }),
      tags: [...(opts.tags ?? []), "high-latency", ...opts.toolSequence],
    });
  }

  // ── Query API ────────────────────────────────────────────────────

  async query(filter: FailureFilter): Promise<FailureRecord[]> {
    return this.store.query(filter);
  }

  async findSimilar(taskInput: unknown, limit = 10): Promise<FailureRecord[]> {
    const hash = hashPayload(taskInput);
    return this.store.findSimilar(hash, limit);
  }

  async getById(failureId: string): Promise<FailureRecord | null> {
    return this.store.getById(failureId);
  }

  async totalFailures(): Promise<number> {
    return this.store.count();
  }

  // ── Negative constraint extraction ───────────────────────────────

  /**
   * Return all negative constraints relevant to a task and pillar,
   * sorted by severity and recurrence. Used by PreFlightCheck.
   */
  async getConstraintsForTask(
    taskInput: unknown,
    pillarId:  string,
    limit = 15
  ): Promise<Array<{ constraint: string; rootCause: RootCause; severity: SeverityLevel; recurrences: number }>> {
    const taskHash = hashPayload(taskInput);

    // Find failures matching this exact task hash OR same pillar
    const [exactMatches, pillarMatches] = await Promise.all([
      this.store.findSimilar(taskHash, limit),
      this.store.query({ pillarId, limit, since: Date.now() - 7 * 24 * 60 * 60 * 1000 }),
    ]);

    const combined = [...exactMatches];
    for (const r of pillarMatches) {
      if (!combined.find((c) => c.failureId === r.failureId)) combined.push(r);
    }

    return combined
      .filter((r) => r.negativeConstraint.length > 0)
      .sort((a, b) => {
        const sevOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const sevDiff = sevOrder[b.severity] - sevOrder[a.severity];
        return sevDiff !== 0 ? sevDiff : b.recurrenceCount - a.recurrenceCount;
      })
      .slice(0, limit)
      .map((r) => ({
        constraint:  r.negativeConstraint,
        rootCause:   r.rootCause,
        severity:    r.severity,
        recurrences: r.recurrenceCount,
      }));
  }

  // ── Pillar failure summary ────────────────────────────────────────

  async pillarSummary(pillarId: string): Promise<{
    pillarId:           string;
    totalFailures:      number;
    failedSequences:    number;
    rejectedOutputs:    number;
    highLatencyPaths:   number;
    criticalCount:      number;
    topRootCause:       RootCause | null;
    recurringPatterns:  number;
    mostRecentAt:       number | null;
  }> {
    const all = await this.store.query({ pillarId });
    const rootCauseCounts: Record<RootCause, number> = { LINGUISTIC: 0, LOGIC: 0, TOOL_MISMATCH: 0 };
    for (const r of all) rootCauseCounts[r.rootCause]++;
    const topRootCause = all.length > 0
      ? (Object.entries(rootCauseCounts).sort((a, b) => b[1] - a[1])[0][0] as RootCause)
      : null;

    return {
      pillarId,
      totalFailures:    all.length,
      failedSequences:  all.filter((r) => r.category === "FAILED_SEQUENCE").length,
      rejectedOutputs:  all.filter((r) => r.category === "REJECTED_OUTPUT").length,
      highLatencyPaths: all.filter((r) => r.category === "HIGH_LATENCY_PATH").length,
      criticalCount:    all.filter((r) => r.severity === "CRITICAL").length,
      topRootCause,
      recurringPatterns: all.filter((r) => r.recurrenceCount > 1).length,
      mostRecentAt:     all.length > 0 ? Math.max(...all.map((r) => r.occurredAt)) : null,
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────

  /**
   * Upsert: if a record with the same taskHash + category + breakingToolId
   * already exists, increment its recurrenceCount; otherwise insert new.
   */
  private async _upsert(
    fields: Omit<FailureRecord, "failureId" | "severity" | "occurredAt" | "recurrenceCount" | "lastRecurredAt">
  ): Promise<FailureRecord> {
    // Look for an identical pattern
    const existing = await this.store.query({
      taskHash:  fields.taskHash,
      category:  fields.category,
      pillarId:  fields.pillarId,
      limit:     1,
    });

    const match = existing.find(
      (r) => r.breakingToolId === fields.breakingToolId && r.outputHash === fields.outputHash
    );

    if (match) {
      const updated: Partial<FailureRecord> = {
        recurrenceCount: match.recurrenceCount + 1,
        lastRecurredAt:  Date.now(),
        severity:        computeSeverity(match.category, match.rootCause, match.recurrenceCount + 1),
      };
      await this.store.update(match.failureId, updated);
      return { ...match, ...updated };
    }

    const record: FailureRecord = {
      ...fields,
      failureId:       generateFailureId(),
      severity:        computeSeverity(fields.category, fields.rootCause, 0),
      occurredAt:      Date.now(),
      recurrenceCount: 0,
      lastRecurredAt:  null,
    };
    await this.store.append(record);
    return record;
  }

  private _inferRootCause(category: FailureCategory, description: string): RootCause {
    const lc = description.toLowerCase();
    if (/hallucin|phras|tone|format|preamble|word.limit|verbos|incoher/.test(lc)) return "LINGUISTIC";
    if (/tool.mismatch|wrong.tool|capability|latency|timeout|api.cost|unavail/.test(lc)) return "TOOL_MISMATCH";
    if (/logic|loop|circular|plan|sequence|order|depend|reason/.test(lc)) return "LOGIC";
    // Default by category
    if (category === "HIGH_LATENCY_PATH") return "TOOL_MISMATCH";
    if (category === "REJECTED_OUTPUT")   return "LINGUISTIC";
    return "LOGIC";
  }

  private _buildNegativeConstraint(
    category: FailureCategory,
    data: Record<string, unknown>
  ): string {
    switch (category) {
      case "FAILED_SEQUENCE": {
        const seq = (data.toolSequence as string[]).join(" → ");
        const tool = data.breakingToolId as string;
        const desc = data.description as string;
        return `Do NOT use the tool sequence [${seq}] for this task type — it previously failed at '${tool}'. Reason: ${desc.slice(0, 120)}`;
      }
      case "REJECTED_OUTPUT": {
        const reason  = data.rejectionReason as string;
        const conf    = data.criticConfidence as number;
        const tmpl    = (data.promptTemplate as string).slice(0, 80);
        return `Do NOT produce output matching phrasing from prompt starting with "${tmpl}…" — CRITIC rejected it (confidence ${conf.toFixed(3)}). Reason: ${reason.slice(0, 120)}`;
      }
      case "HIGH_LATENCY_PATH": {
        const seq      = (data.toolSequence as string[]).join(" → ");
        const observed = data.observedLatencyMs as number;
        const budget   = data.latencyBudgetMs   as number;
        return `Do NOT invoke the path [${seq}] — it exceeded the latency budget (${observed}ms vs ${budget}ms allowed). Select a lower-latency alternative.`;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Required Supabase table:
 *
 *   CREATE TABLE failure_records (
 *     failure_id              TEXT    PRIMARY KEY,
 *     category                TEXT    NOT NULL,
 *     root_cause              TEXT    NOT NULL,
 *     severity                TEXT    NOT NULL,
 *     pillar_id               TEXT    NOT NULL,
 *     agent_id                TEXT    NOT NULL,
 *     task_hash               TEXT    NOT NULL,
 *     tool_sequence           TEXT[]  NOT NULL DEFAULT '{}',
 *     break_index             INTEGER,
 *     breaking_tool_id        TEXT,
 *     output_hash             TEXT,
 *     prompt_hash             TEXT,
 *     rejection_reason        TEXT,
 *     critic_confidence       REAL,
 *     observed_latency_ms     INTEGER,
 *     latency_budget_ms       INTEGER,
 *     latency_overage_percent REAL,
 *     description             TEXT    NOT NULL,
 *     negative_constraint     TEXT    NOT NULL,
 *     tags                    TEXT[]  NOT NULL DEFAULT '{}',
 *     occurred_at             BIGINT  NOT NULL,
 *     recurrence_count        INTEGER NOT NULL DEFAULT 0,
 *     last_recurred_at        BIGINT
 *   );
 *   CREATE INDEX ON failure_records (pillar_id, occurred_at DESC);
 *   CREATE INDEX ON failure_records (task_hash);
 *   CREATE INDEX ON failure_records (category, severity);
 */
export function createSupabaseFailureStore(
  supabaseUrl: string,
  supabaseKey: string
): FailureStoreAdapter {
  const headers = {
    "apikey":        supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };
  const base = `${supabaseUrl}/rest/v1/failure_records`;

  const toRow = (r: FailureRecord) => ({
    failure_id:              r.failureId,
    category:                r.category,
    root_cause:              r.rootCause,
    severity:                r.severity,
    pillar_id:               r.pillarId,
    agent_id:                r.agentId,
    task_hash:               r.taskHash,
    tool_sequence:           r.toolSequence           ?? [],
    break_index:             r.breakIndex             ?? null,
    breaking_tool_id:        r.breakingToolId         ?? null,
    output_hash:             r.outputHash             ?? null,
    prompt_hash:             r.promptHash             ?? null,
    rejection_reason:        r.rejectionReason        ?? null,
    critic_confidence:       r.criticConfidence       ?? null,
    observed_latency_ms:     r.observedLatencyMs      ?? null,
    latency_budget_ms:       r.latencyBudgetMs        ?? null,
    latency_overage_percent: r.latencyOveragePercent  ?? null,
    description:             r.description,
    negative_constraint:     r.negativeConstraint,
    tags:                    r.tags,
    occurred_at:             r.occurredAt,
    recurrence_count:        r.recurrenceCount,
    last_recurred_at:        r.lastRecurredAt         ?? null,
  });

  const fromRow = (row: Record<string, unknown>): FailureRecord => ({
    failureId:              row.failure_id              as string,
    category:               row.category               as FailureCategory,
    rootCause:              row.root_cause             as RootCause,
    severity:               row.severity               as SeverityLevel,
    pillarId:               row.pillar_id              as string,
    agentId:                row.agent_id               as string,
    taskHash:               row.task_hash              as string,
    toolSequence:           (row.tool_sequence ?? [])  as string[],
    breakIndex:             row.break_index            as number | undefined,
    breakingToolId:         row.breaking_tool_id       as string | undefined,
    outputHash:             row.output_hash            as string | undefined,
    promptHash:             row.prompt_hash            as string | undefined,
    rejectionReason:        row.rejection_reason       as string | undefined,
    criticConfidence:       row.critic_confidence      as number | undefined,
    observedLatencyMs:      row.observed_latency_ms    as number | undefined,
    latencyBudgetMs:        row.latency_budget_ms      as number | undefined,
    latencyOveragePercent:  row.latency_overage_percent as number | undefined,
    description:            row.description            as string,
    negativeConstraint:     row.negative_constraint    as string,
    tags:                   (row.tags ?? [])           as string[],
    occurredAt:             row.occurred_at            as number,
    recurrenceCount:        row.recurrence_count       as number,
    lastRecurredAt:         row.last_recurred_at       as number | null,
  });

  return {
    async append(record) {
      await fetch(base, {
        method:  "POST",
        headers: { ...headers, "Prefer": "resolution=ignore-duplicates" },
        body:    JSON.stringify(toRow(record)),
        signal:  AbortSignal.timeout(8_000),
      });
    },

    async getById(failureId) {
      const resp = await fetch(`${base}?failure_id=eq.${failureId}&limit=1`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows[0] ? fromRow(rows[0]) : null;
    },

    async update(failureId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.recurrenceCount !== undefined) row["recurrence_count"] = patch.recurrenceCount;
      if (patch.lastRecurredAt  !== undefined) row["last_recurred_at"] = patch.lastRecurredAt;
      if (patch.severity)                      row["severity"]          = patch.severity;
      await fetch(`${base}?failure_id=eq.${failureId}`, {
        method:  "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body:    JSON.stringify(row),
        signal:  AbortSignal.timeout(8_000),
      });
    },

    async query(filter) {
      const params: string[] = ["order=occurred_at.desc"];
      if (filter.category)  params.push(`category=eq.${filter.category}`);
      if (filter.rootCause) params.push(`root_cause=eq.${filter.rootCause}`);
      if (filter.severity)  params.push(`severity=eq.${filter.severity}`);
      if (filter.pillarId)  params.push(`pillar_id=eq.${filter.pillarId}`);
      if (filter.agentId)   params.push(`agent_id=eq.${filter.agentId}`);
      if (filter.taskHash)  params.push(`task_hash=eq.${filter.taskHash}`);
      if (filter.since)     params.push(`occurred_at=gte.${filter.since}`);
      if (filter.limit)     params.push(`limit=${filter.limit}`);
      const resp = await fetch(`${base}?${params.join("&")}`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(fromRow);
    },

    async findSimilar(taskHash, limit = 10) {
      const resp = await fetch(
        `${base}?task_hash=eq.${taskHash}&order=recurrence_count.desc&limit=${limit}`,
        { headers, signal: AbortSignal.timeout(8_000) }
      );
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(fromRow);
    },

    async count(filter) {
      const params: string[] = [];
      if (filter?.pillarId) params.push(`pillar_id=eq.${filter.pillarId}`);
      if (filter?.category) params.push(`category=eq.${filter.category}`);
      const resp = await fetch(`${base}?${params.join("&")}`, {
        headers: { ...headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0" },
        signal:  AbortSignal.timeout(8_000),
      });
      const range = resp.headers.get("content-range") ?? "0/0";
      return parseInt(range.split("/")[1] ?? "0", 10);
    },

    async clear() {
      await fetch(`${base}?failure_id=gte.0`, { method: "DELETE", headers, signal: AbortSignal.timeout(8_000) });
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

const SEV_ICON: Record<SeverityLevel, string> = {
  CRITICAL: "🔴",
  HIGH:     "🟠",
  MEDIUM:   "🟡",
  LOW:      "🟢",
};

export function formatFailureRecord(r: FailureRecord): string {
  const ts   = new Date(r.occurredAt).toISOString();
  const icon = SEV_ICON[r.severity];
  return [
    `${icon} [${r.severity.padEnd(8)}] ${r.category.padEnd(18)} ${r.rootCause.padEnd(14)} pillar=${r.pillarId}`,
    `  id=${r.failureId}  agent=${r.agentId}  recurred=${r.recurrenceCount}x  at=${ts}`,
    `  desc: ${r.description.slice(0, 100)}`,
    `  constraint: ${r.negativeConstraint.slice(0, 100)}`,
  ].join("\n");
}

export function formatPillarFailureSummary(summary: Awaited<ReturnType<FailureRecorder["pillarSummary"]>>): string {
  return [
    `Pillar '${summary.pillarId}' — Failure Summary`,
    `  Total: ${summary.totalFailures}  (seq=${summary.failedSequences} rejected=${summary.rejectedOutputs} latency=${summary.highLatencyPaths})`,
    `  Critical: ${summary.criticalCount}  Recurring: ${summary.recurringPatterns}  Top cause: ${summary.topRootCause ?? "none"}`,
    `  Most recent: ${summary.mostRecentAt ? new Date(summary.mostRecentAt).toISOString() : "never"}`,
  ].join("\n");
}

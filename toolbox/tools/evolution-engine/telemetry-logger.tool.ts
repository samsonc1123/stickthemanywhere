/**
 * toolbox/tools/evolution-engine/telemetry-logger.tool.ts
 * version: 1.0.0
 *
 * Pillar 17-EVO: Telemetry & Feedback Ingestion
 * Domain: Universal-Learning
 *
 * Records a structured telemetry event for every agent invocation:
 *   [timestamp, agent_id, input_hash, output_hash, latency_ms, outcome_signal]
 *
 * Outcome signals:
 *   SUCCESS  — agent completed within threshold; output accepted
 *   RETRY    — output rejected (e.g. Trinity CRITIC confidence < threshold);
 *              agent will re-run
 *   ABANDON  — max retries exhausted; result discarded
 *
 * Storage:
 *   In-memory circular log by default.
 *   Swap to createSupabaseTelemetryStore() for persistent multi-session history.
 *   Supabase table: `agent_telemetry` (schema in file footer).
 *
 * Hashing:
 *   Input and output hashes use FNV-1a 32-bit on the serialised string.
 *   Not cryptographic — purely for deduplication and drift detection.
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type OutcomeSignal = "SUCCESS" | "RETRY" | "ABANDON";

export interface TelemetryRecord {
  /** Monotonically increasing event ID within this session */
  eventId:       number;
  /** Unix ms when the agent invocation started */
  timestamp:     number;
  /** Identifier of the agent / pillar that produced this event */
  agentId:       string;
  /** Pillar name this agent belongs to (for pillar-level scoring) */
  pillarId:      string;
  /** FNV-1a hash of the serialised input */
  inputHash:     string;
  /** FNV-1a hash of the serialised output */
  outputHash:    string;
  /** Wall-clock duration of the agent invocation in ms */
  latencyMs:     number;
  outcome:       OutcomeSignal;
  /** Confidence returned by the CRITIC for this invocation [0, 1] */
  confidence:    number;
  /** Number of retries that occurred before this outcome */
  retryCount:    number;
  /** Optional: tags describing the task type, model, or tool used */
  tags:          string[];
  /** Optional: freeform key/value context */
  metadata:      Record<string, string | number | boolean>;
}

export interface TelemetryStoreAdapter {
  append(record: TelemetryRecord): Promise<void>;
  query(filter: TelemetryFilter): Promise<TelemetryRecord[]>;
  count(filter?: Partial<TelemetryFilter>): Promise<number>;
  clear(): Promise<void>;
}

export interface TelemetryFilter {
  agentId?:    string;
  pillarId?:   string;
  outcome?:    OutcomeSignal;
  since?:      number;   // Unix ms — only return records at or after this time
  until?:      number;   // Unix ms — only return records at or before this time
  limit?:      number;   // max records to return
}

// ═══════════════════════════════════════════════════════════════════
// FNV-1a HASH (32-bit)
// ═══════════════════════════════════════════════════════════════════

function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function hashPayload(payload: unknown): string {
  try {
    return fnv1a32(JSON.stringify(payload) ?? "null");
  } catch {
    return fnv1a32(String(payload));
  }
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY STORE (circular buffer)
// ═══════════════════════════════════════════════════════════════════

export class InMemoryTelemetryStore implements TelemetryStoreAdapter {
  private records: TelemetryRecord[] = [];

  constructor(private readonly maxSize: number = 10_000) {}

  async append(record: TelemetryRecord): Promise<void> {
    if (this.records.length >= this.maxSize) {
      this.records.shift();   // drop oldest
    }
    this.records.push(record);
  }

  async query(filter: TelemetryFilter): Promise<TelemetryRecord[]> {
    let results = [...this.records];
    if (filter.agentId)  results = results.filter((r) => r.agentId  === filter.agentId);
    if (filter.pillarId) results = results.filter((r) => r.pillarId === filter.pillarId);
    if (filter.outcome)  results = results.filter((r) => r.outcome  === filter.outcome);
    if (filter.since)    results = results.filter((r) => r.timestamp >= filter.since!);
    if (filter.until)    results = results.filter((r) => r.timestamp <= filter.until!);
    if (filter.limit)    results = results.slice(-filter.limit);
    return results;
  }

  async count(filter?: Partial<TelemetryFilter>): Promise<number> {
    if (!filter) return this.records.length;
    return (await this.query(filter as TelemetryFilter)).length;
  }

  async clear(): Promise<void> {
    this.records = [];
  }

  /** Snapshot all records (for export / serialisation) */
  snapshot(): TelemetryRecord[] {
    return [...this.records];
  }
}

// ═══════════════════════════════════════════════════════════════════
// TELEMETRY LOGGER
// ═══════════════════════════════════════════════════════════════════

export interface LogOptions {
  /** Tags to attach to this event */
  tags?:      string[];
  /** Freeform metadata */
  metadata?:  Record<string, string | number | boolean>;
  /** Confidence score from upstream CRITIC [0, 1]. Default: 1.0 */
  confidence?: number;
  /** How many retries occurred. Default: 0 */
  retryCount?: number;
}

let _eventCounter = 0;

export class TelemetryLogger {
  private store: TelemetryStoreAdapter;

  constructor(store?: TelemetryStoreAdapter) {
    this.store = store ?? new InMemoryTelemetryStore();
  }

  setStore(store: TelemetryStoreAdapter): void {
    this.store = store;
  }

  // ── Core log method ─────────────────────────────────────────────

  /**
   * Record a single agent invocation event.
   *
   * @param agentId   Agent / tool identifier
   * @param pillarId  Pillar this agent belongs to (for pillar scoring)
   * @param input     Raw input (will be hashed — not stored in full)
   * @param output    Raw output (will be hashed — not stored in full)
   * @param latencyMs Wall-clock ms from invocation start to completion
   * @param outcome   SUCCESS / RETRY / ABANDON
   * @param opts      Optional tags, metadata, confidence, retryCount
   */
  async log(
    agentId:   string,
    pillarId:  string,
    input:     unknown,
    output:    unknown,
    latencyMs: number,
    outcome:   OutcomeSignal,
    opts:      LogOptions = {}
  ): Promise<TelemetryRecord> {
    const record: TelemetryRecord = {
      eventId:    ++_eventCounter,
      timestamp:  Date.now(),
      agentId,
      pillarId,
      inputHash:  hashPayload(input),
      outputHash: hashPayload(output),
      latencyMs:  Math.max(0, Math.round(latencyMs)),
      outcome,
      confidence: opts.confidence  ?? 1.0,
      retryCount: opts.retryCount  ?? 0,
      tags:       opts.tags        ?? [],
      metadata:   opts.metadata    ?? {},
    };

    await this.store.append(record);
    return record;
  }

  // ── Convenience wrappers ────────────────────────────────────────

  async logSuccess(agentId: string, pillarId: string, input: unknown, output: unknown, latencyMs: number, opts?: LogOptions): Promise<TelemetryRecord> {
    return this.log(agentId, pillarId, input, output, latencyMs, "SUCCESS", opts);
  }

  async logRetry(agentId: string, pillarId: string, input: unknown, output: unknown, latencyMs: number, retryCount: number, confidence: number, opts?: LogOptions): Promise<TelemetryRecord> {
    return this.log(agentId, pillarId, input, output, latencyMs, "RETRY", { ...opts, retryCount, confidence });
  }

  async logAbandon(agentId: string, pillarId: string, input: unknown, latencyMs: number, retryCount: number, opts?: LogOptions): Promise<TelemetryRecord> {
    return this.log(agentId, pillarId, input, null, latencyMs, "ABANDON", { ...opts, retryCount, confidence: 0 });
  }

  // ── Timing helper ────────────────────────────────────────────────

  /**
   * Returns a `stop(output, outcome, opts?)` function.
   * Call `const stop = logger.startTimer(agentId, pillarId, input)` at
   * the start of an invocation, then `await stop(output, "SUCCESS")` at
   * the end to automatically compute latencyMs.
   */
  startTimer(agentId: string, pillarId: string, input: unknown) {
    const t0 = Date.now();
    return (output: unknown, outcome: OutcomeSignal, opts?: LogOptions) =>
      this.log(agentId, pillarId, input, output, Date.now() - t0, outcome, opts);
  }

  // ── Queries ──────────────────────────────────────────────────────

  async getHistory(filter: TelemetryFilter): Promise<TelemetryRecord[]> {
    return this.store.query(filter);
  }

  async totalEvents(): Promise<number> {
    return this.store.count();
  }

  // ── Per-pillar summary ────────────────────────────────────────────

  async pillarSummary(pillarId: string, since?: number): Promise<{
    pillarId:        string;
    total:           number;
    successes:       number;
    retries:         number;
    abandons:        number;
    avgLatencyMs:    number;
    avgConfidence:   number;
    successRate:     number;
  }> {
    const records = await this.store.query({ pillarId, since });
    const total    = records.length;
    const success  = records.filter((r) => r.outcome === "SUCCESS").length;
    const retry    = records.filter((r) => r.outcome === "RETRY").length;
    const abandon  = records.filter((r) => r.outcome === "ABANDON").length;
    const avgLat   = total > 0 ? records.reduce((s, r) => s + r.latencyMs, 0) / total : 0;
    const avgConf  = total > 0 ? records.reduce((s, r) => s + r.confidence, 0) / total : 0;
    return {
      pillarId,
      total,
      successes:     success,
      retries:       retry,
      abandons:      abandon,
      avgLatencyMs:  Math.round(avgLat),
      avgConfidence: avgConf,
      successRate:   total > 0 ? success / total : 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE TELEMETRY STORE ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Persistent Supabase-backed telemetry store.
 *
 * Required table (run in Supabase SQL editor):
 *
 *   CREATE TABLE agent_telemetry (
 *     event_id      BIGINT PRIMARY KEY,
 *     timestamp     BIGINT  NOT NULL,
 *     agent_id      TEXT    NOT NULL,
 *     pillar_id     TEXT    NOT NULL,
 *     input_hash    TEXT    NOT NULL,
 *     output_hash   TEXT    NOT NULL,
 *     latency_ms    INTEGER NOT NULL,
 *     outcome       TEXT    NOT NULL,
 *     confidence    REAL    NOT NULL DEFAULT 1.0,
 *     retry_count   INTEGER NOT NULL DEFAULT 0,
 *     tags          TEXT[]  NOT NULL DEFAULT '{}',
 *     metadata      JSONB   NOT NULL DEFAULT '{}'
 *   );
 *   CREATE INDEX ON agent_telemetry (pillar_id, timestamp DESC);
 *   CREATE INDEX ON agent_telemetry (agent_id,  timestamp DESC);
 */
export function createSupabaseTelemetryStore(
  supabaseUrl: string,
  supabaseKey: string
): TelemetryStoreAdapter {
  const headers = {
    "apikey":        supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };
  const base = `${supabaseUrl}/rest/v1/agent_telemetry`;

  const toRow = (r: TelemetryRecord) => ({
    event_id:    r.eventId,
    timestamp:   r.timestamp,
    agent_id:    r.agentId,
    pillar_id:   r.pillarId,
    input_hash:  r.inputHash,
    output_hash: r.outputHash,
    latency_ms:  r.latencyMs,
    outcome:     r.outcome,
    confidence:  r.confidence,
    retry_count: r.retryCount,
    tags:        r.tags,
    metadata:    r.metadata,
  });

  const fromRow = (row: Record<string, unknown>): TelemetryRecord => ({
    eventId:    row.event_id    as number,
    timestamp:  row.timestamp   as number,
    agentId:    row.agent_id    as string,
    pillarId:   row.pillar_id   as string,
    inputHash:  row.input_hash  as string,
    outputHash: row.output_hash as string,
    latencyMs:  row.latency_ms  as number,
    outcome:    row.outcome     as OutcomeSignal,
    confidence: row.confidence  as number,
    retryCount: row.retry_count as number,
    tags:       (row.tags       ?? []) as string[],
    metadata:   (row.metadata   ?? {}) as Record<string, string | number | boolean>,
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

    async query(filter) {
      const params: string[] = ["order=timestamp.desc"];
      if (filter.agentId)  params.push(`agent_id=eq.${filter.agentId}`);
      if (filter.pillarId) params.push(`pillar_id=eq.${filter.pillarId}`);
      if (filter.outcome)  params.push(`outcome=eq.${filter.outcome}`);
      if (filter.since)    params.push(`timestamp=gte.${filter.since}`);
      if (filter.until)    params.push(`timestamp=lte.${filter.until}`);
      if (filter.limit)    params.push(`limit=${filter.limit}`);
      const resp = await fetch(`${base}?${params.join("&")}`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(fromRow);
    },

    async count(filter) {
      const params: string[] = [];
      if (filter?.agentId)  params.push(`agent_id=eq.${filter.agentId}`);
      if (filter?.pillarId) params.push(`pillar_id=eq.${filter.pillarId}`);
      const url = `${base}?${params.join("&")}`;
      const resp = await fetch(url, { headers: { ...headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0" }, signal: AbortSignal.timeout(8_000) });
      const range = resp.headers.get("content-range") ?? "0/0";
      return parseInt(range.split("/")[1] ?? "0", 10);
    },

    async clear() {
      // Supabase REST: DELETE with no filter deletes all rows
      await fetch(`${base}?event_id=gte.0`, { method: "DELETE", headers, signal: AbortSignal.timeout(8_000) });
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a telemetry record as a compact single-line log entry.
 */
export function formatTelemetryLine(r: TelemetryRecord): string {
  const ts    = new Date(r.timestamp).toISOString();
  const tags  = r.tags.length ? `  [${r.tags.join(",")}]` : "";
  return `[${ts}] ${r.agentId.padEnd(24)} ${r.outcome.padEnd(7)} lat=${r.latencyMs}ms conf=${r.confidence.toFixed(3)} retry=${r.retryCount} in=${r.inputHash} out=${r.outputHash}${tags}`;
}

/**
 * Export all records in an InMemoryTelemetryStore as NDJSON.
 */
export function exportNdjson(store: InMemoryTelemetryStore): string {
  return store.snapshot().map((r) => JSON.stringify(r)).join("\n");
}

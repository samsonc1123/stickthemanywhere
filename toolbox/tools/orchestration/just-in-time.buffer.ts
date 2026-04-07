/**
 * toolbox/tools/orchestration/just-in-time.buffer.ts
 * version: 1.0.0
 *
 * Context Orchestration Layer — Just-In-Time Context Buffer.
 * Pure TypeScript. Zero framework imports.
 *
 * Assembles a fully-formed ContextPacket immediately before each outgoing
 * agent call — injecting the current DB state, user-activity log, and
 * top-3 memory document excerpts into the call's metadata envelope.
 *
 * Pipeline:
 *   WatcherEvent  ─┐
 *   UserLog       ─┼──► ContextBuffer.assemble() ──► ContextPacket
 *   MemoryMatches ─┘         │
 *                            └──► ContextInjector.inject()
 *                                   │
 *                              outgoing AgentCall + metadata.context
 *
 * Pillar 16: Context Orchestration Layer (GAB domain: NEURAL-INFRASTRUCTURE)
 *
 * Key design principles:
 *   - Every assemble() call is synchronous after the async gather phase —
 *     the packet is built once and is immutable thereafter.
 *   - The injector is a pure transform: it does not mutate the original
 *     AgentCall object. It returns a new decorated copy.
 *   - The buffer retains a rolling history of the last N packets for
 *     debugging and replay without external storage.
 */

import type { WatcherEvent, MemoryMatch }   from "./context-relay.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — USER LOGS
// ═══════════════════════════════════════════════════════════════════

export type UserActionType =
  | "page_view"
  | "cart_add"
  | "cart_remove"
  | "checkout_start"
  | "checkout_complete"
  | "search"
  | "filter_apply"
  | "category_select"
  | "pillar_access"
  | "api_call"
  | "agent_invoke"
  | "auth_event"
  | "error_encountered"
  | "custom";

export interface UserLogEntry {
  id:          string;
  userId:      string;   // anonymous ID or authenticated user ID
  sessionId:   string;
  actionType:  UserActionType;
  /** Page path or feature area */
  context:     string;
  /** Action-specific payload */
  payload:     Record<string, unknown>;
  timestampMs: number;
  /** IP/region (anonymised to /24 or country-level) */
  region?:     string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — DB STATE SNAPSHOT
// ═══════════════════════════════════════════════════════════════════

export interface DbStateSnapshot {
  /** Which tables are included in this snapshot */
  tables:      string[];
  /** Key = "schema.table", Value = recent rows (up to snapshotRowLimit) */
  data:        Record<string, Array<Record<string, unknown>>>;
  /** The WatcherEvent that triggered this snapshot (if event-driven) */
  triggerEvent?: WatcherEvent;
  capturedAt:  number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — MEMORY EXCERPTS
// ═══════════════════════════════════════════════════════════════════

export interface MemoryExcerpt {
  filePath:    string;
  title:       string;
  /** First 600 chars of the document, markdown stripped */
  excerpt:     string;
  score:       number;
  matchedTerms: string[];
}

function toExcerpt(match: MemoryMatch, maxChars = 600): MemoryExcerpt {
  const stripped = match.document.content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[#*_\[\]()>|~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);

  return {
    filePath:    match.document.filePath,
    title:       match.document.title,
    excerpt:     stripped,
    score:       match.score,
    matchedTerms: match.matchedTerms,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — CONTEXT PACKET (the unified output)
// ═══════════════════════════════════════════════════════════════════

export interface ContextPacket {
  /** Unique ID for this packet */
  packetId:    string;
  /** Unix ms when assemble() was called */
  assembledAt: number;
  /** Pillar and session this packet was assembled for */
  pillarIndex: number;
  sessionId:   string;

  /** Current DB state snapshot */
  dbState:     DbStateSnapshot;

  /** Recent user log entries relevant to the current event */
  userLogs:    UserLogEntry[];

  /** Top-N memory document excerpts ranked by relevance */
  memory:      MemoryExcerpt[];

  /** Flattened keyword index derived from all three sources */
  keywordIndex: string[];

  /** A terse natural-language summary of the packet — for prompt injection */
  summary:     string;

  /** Debug: how long each gather phase took */
  timings: {
    dbMs:     number;
    logsMs:   number;
    memoryMs: number;
    totalMs:  number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — AGENT CALLS (generic envelope)
// ═══════════════════════════════════════════════════════════════════

export interface AgentCall<TParams = unknown> {
  callId:     string;
  agentId:    string;
  toolName:   string;
  parameters: TParams;
  metadata:   Record<string, unknown>;
  timestampMs: number;
}

export interface InjectedAgentCall<TParams = unknown> extends AgentCall<TParams> {
  metadata: {
    [key: string]: unknown;
    context:  ContextPacket;
    injectedAt: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — DATA PROVIDERS (interfaces — callers provide implementations)
// ═══════════════════════════════════════════════════════════════════

/** Async function that fetches recent rows for a set of table names */
export type DbStateProvider = (
  tables: string[],
  triggerEvent?: WatcherEvent
) => Promise<DbStateSnapshot>;

/** Async function that fetches recent user log entries for a session/user */
export type UserLogProvider = (
  sessionId: string,
  userId?: string,
  limit?: number
) => Promise<UserLogEntry[]>;

/** Sync function that retrieves the top-N memory matches for an event or query */
export type MemoryProvider = (
  eventOrQuery: WatcherEvent | string,
  topN: number
) => MemoryMatch[];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSummary(
  dbState:  DbStateSnapshot,
  userLogs: UserLogEntry[],
  memory:   MemoryExcerpt[]
): string {
  const tables  = dbState.tables.join(", ") || "none";
  const trigger = dbState.triggerEvent
    ? `Triggered by ${dbState.triggerEvent.changeType} on ${dbState.triggerEvent.table}.`
    : "Periodic assembly.";
  const lastAction = userLogs.length > 0
    ? `Last user action: ${userLogs[0].actionType} in ${userLogs[0].context}.`
    : "No recent user activity.";
  const topDoc = memory.length > 0
    ? `Top memory: "${memory[0].title}" (score ${memory[0].score.toFixed(2)}).`
    : "No memory matches.";

  return `${trigger} DB tables: ${tables}. ${lastAction} ${topDoc}`;
}

function deduplicateKeywords(sources: string[][]): string[] {
  const all = sources.flat().map((k) => k.toLowerCase().trim()).filter((k) => k.length > 2);
  return [...new Set(all)];
}

// ═══════════════════════════════════════════════════════════════════
// 1. CONTEXT BUFFER — assembles ContextPacket on demand
// ═══════════════════════════════════════════════════════════════════

export interface ContextBufferConfig {
  pillarIndex?:        number;
  /** Max user log entries to include. Default 20. */
  userLogLimit?:       number;
  /** Max memory excerpts to include. Default 3. */
  memoryTopN?:         number;
  /** Max chars per memory excerpt. Default 600. */
  excerptMaxChars?:    number;
  /** Max packets to retain in history. Default 100. */
  historyLimit?:       number;
  /** Tables to always include in DB snapshot. */
  watchedTables?:      string[];
}

/**
 * ContextBuffer — central assembler for ContextPackets.
 *
 * Call assemble() with:
 *   - a sessionId / optional userId
 *   - an optional WatcherEvent (if event-driven)
 *   - an optional freeform query override for memory retrieval
 *
 * The buffer calls the three providers concurrently, then stitches the
 * results into an immutable ContextPacket.
 */
export class ContextBuffer {
  private dbProvider:   DbStateProvider;
  private logProvider:  UserLogProvider;
  private memProvider:  MemoryProvider;
  private config:       Required<ContextBufferConfig>;
  private history:      ContextPacket[] = [];

  constructor(
    dbProvider:  DbStateProvider,
    logProvider: UserLogProvider,
    memProvider: MemoryProvider,
    config:      ContextBufferConfig = {}
  ) {
    this.dbProvider  = dbProvider;
    this.logProvider = logProvider;
    this.memProvider = memProvider;
    this.config = {
      pillarIndex:     config.pillarIndex     ?? 16,
      userLogLimit:    config.userLogLimit     ?? 20,
      memoryTopN:      config.memoryTopN       ?? 3,
      excerptMaxChars: config.excerptMaxChars  ?? 600,
      historyLimit:    config.historyLimit     ?? 100,
      watchedTables:   config.watchedTables    ?? [],
    };
  }

  // ── Main assembly ──────────────────────────────────────────────

  /**
   * Assemble a ContextPacket for the given session, optionally driven
   * by a WatcherEvent or a freeform memory query.
   *
   * All three data sources are gathered concurrently. Total assembly
   * time is bounded by the slowest provider.
   */
  async assemble(opts: {
    sessionId:     string;
    userId?:       string;
    triggerEvent?: WatcherEvent;
    memoryQuery?:  string;  // overrides event-based memory query
  }): Promise<ContextPacket> {
    const startMs = Date.now();
    const packetId = generateId("pkt");

    // Determine tables to snapshot
    const tables = [
      ...this.config.watchedTables,
      ...(opts.triggerEvent ? [opts.triggerEvent.table] : []),
    ];
    const uniqueTables = [...new Set(tables)];

    // ── Concurrent gather ────────────────────────────────────────
    const [dbResult, logsResult, memResult] = await Promise.allSettled([
      this._gatherDb(uniqueTables, opts.triggerEvent),
      this._gatherLogs(opts.sessionId, opts.userId),
      Promise.resolve(this._gatherMemory(opts.triggerEvent, opts.memoryQuery)),
    ]);

    const dbMs     = Date.now() - startMs;
    const dbState  = dbResult.status  === "fulfilled" ? dbResult.value  : this._emptyDbState(uniqueTables, opts.triggerEvent);
    const logsMs   = Date.now() - startMs - dbMs;
    const userLogs = logsResult.status === "fulfilled" ? logsResult.value : [];
    const memoryMs = Date.now() - startMs - dbMs - logsMs;
    const memMatches = memResult.status === "fulfilled" ? memResult.value : [];

    const memory = memMatches.map((m) => toExcerpt(m, this.config.excerptMaxChars));

    // ── Keyword index ────────────────────────────────────────────
    const keywordIndex = deduplicateKeywords([
      opts.triggerEvent?.tags                     ?? [],
      dbState.tables,
      userLogs.map((l) => l.actionType),
      memory.flatMap((m) => m.matchedTerms),
    ]);

    const totalMs = Date.now() - startMs;

    const packet: ContextPacket = {
      packetId,
      assembledAt: Date.now(),
      pillarIndex: this.config.pillarIndex,
      sessionId:   opts.sessionId,
      dbState,
      userLogs,
      memory,
      keywordIndex,
      summary:     buildSummary(dbState, userLogs, memory),
      timings:     { dbMs, logsMs, memoryMs, totalMs },
    };

    // History retention
    this.history.push(packet);
    if (this.history.length > this.config.historyLimit) this.history.shift();

    return packet;
  }

  // ── History ────────────────────────────────────────────────────

  getHistory(n = 10): ContextPacket[] {
    return this.history.slice(-n);
  }

  getLatest(): ContextPacket | null {
    return this.history.at(-1) ?? null;
  }

  clearHistory(): void { this.history = []; }

  // ── Private gather helpers ─────────────────────────────────────

  private async _gatherDb(tables: string[], triggerEvent?: WatcherEvent): Promise<DbStateSnapshot> {
    if (tables.length === 0) {
      return { tables: [], data: {}, triggerEvent, capturedAt: Date.now() };
    }
    return this.dbProvider(tables, triggerEvent);
  }

  private async _gatherLogs(sessionId: string, userId?: string): Promise<UserLogEntry[]> {
    return this.logProvider(sessionId, userId, this.config.userLogLimit);
  }

  private _gatherMemory(event?: WatcherEvent, query?: string): MemoryMatch[] {
    const source = event ?? query ?? "";
    if (!source) return [];
    return this.memProvider(source, this.config.memoryTopN);
  }

  private _emptyDbState(tables: string[], triggerEvent?: WatcherEvent): DbStateSnapshot {
    return {
      tables,
      data: Object.fromEntries(tables.map((t) => [t, []])),
      triggerEvent,
      capturedAt: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. CONTEXT INJECTOR — injects ContextPacket into AgentCall metadata
// ═══════════════════════════════════════════════════════════════════

export interface InjectorConfig {
  /** Metadata key under which the packet is stored. Default "context". */
  metadataKey?:   string;
  /** Whether to include full memory content (true) or excerpts only (false). Default false. */
  includeFullMemory?: boolean;
  /** Whether to omit the DB data (useful for token-constrained models). Default false. */
  omitDbData?:    boolean;
}

/**
 * ContextInjector — pure transform that attaches a ContextPacket to an
 * outgoing AgentCall's metadata.
 *
 * Returns a new InjectedAgentCall — the original is never mutated.
 * Works with any AgentCall shape; the `metadata.context` key is reserved.
 *
 * For token-constrained models, set `omitDbData: true` and
 * `includeFullMemory: false` — the injected summary + memory excerpts
 * provide the essential context without the full row data.
 */
export class ContextInjector {
  private config: Required<InjectorConfig>;

  constructor(config: InjectorConfig = {}) {
    this.config = {
      metadataKey:        config.metadataKey       ?? "context",
      includeFullMemory:  config.includeFullMemory  ?? false,
      omitDbData:         config.omitDbData         ?? false,
    };
  }

  /**
   * Inject a ContextPacket into an AgentCall.
   * Returns a new InjectedAgentCall — original is unchanged.
   */
  inject<TParams = unknown>(
    call:   AgentCall<TParams>,
    packet: ContextPacket
  ): InjectedAgentCall<TParams> {
    const contextPayload = this._buildContextPayload(packet);

    return {
      ...call,
      metadata: {
        ...call.metadata,
        [this.config.metadataKey]: contextPayload,
        injectedAt: Date.now(),
      },
    };
  }

  /**
   * Batch-inject a ContextPacket into multiple AgentCalls at once.
   * All calls receive the same packet (assembled once per trigger).
   */
  injectBatch<TParams = unknown>(
    calls:  AgentCall<TParams>[],
    packet: ContextPacket
  ): InjectedAgentCall<TParams>[] {
    return calls.map((c) => this.inject(c, packet));
  }

  /**
   * Build the context payload object that goes into metadata.
   * Respects omitDbData and includeFullMemory config flags.
   */
  private _buildContextPayload(packet: ContextPacket): Partial<ContextPacket> & { summary: string } {
    const payload: Partial<ContextPacket> & { summary: string } = {
      packetId:    packet.packetId,
      assembledAt: packet.assembledAt,
      pillarIndex: packet.pillarIndex,
      sessionId:   packet.sessionId,
      summary:     packet.summary,
      keywordIndex: packet.keywordIndex,
      userLogs:    packet.userLogs,
      memory:      this.config.includeFullMemory
        ? packet.memory
        : packet.memory.map(({ filePath, title, excerpt, score }) => ({ filePath, title, excerpt, score })),
      timings:     packet.timings,
    };

    if (!this.config.omitDbData) {
      payload.dbState = packet.dbState;
    }

    return payload;
  }

  /**
   * Extract the injected ContextPacket from an InjectedAgentCall's metadata.
   * Returns null if not injected.
   */
  extract<TParams = unknown>(call: AgentCall<TParams>): Partial<ContextPacket> | null {
    const ctx = call.metadata?.[this.config.metadataKey];
    return (ctx as Partial<ContextPacket> | null) ?? null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. IN-PROCESS USER LOG SINK
// ═══════════════════════════════════════════════════════════════════

/**
 * InProcessUserLogSink — a simple in-memory log store that satisfies
 * the UserLogProvider contract.
 *
 * Use this in development or when an external log sink is not available.
 * For production, replace the provider with a Supabase or Convex query.
 */
export class InProcessUserLogSink {
  private logs: UserLogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  record(entry: Omit<UserLogEntry, "id" | "timestampMs">): UserLogEntry {
    const full: UserLogEntry = {
      ...entry,
      id:          generateId("log"),
      timestampMs: Date.now(),
    };
    this.logs.push(full);
    if (this.logs.length > this.maxEntries) this.logs.shift();
    return full;
  }

  /**
   * UserLogProvider implementation — returns the N most recent entries
   * for the given sessionId (and optionally userId).
   */
  readonly asProvider: UserLogProvider = async (sessionId, userId, limit = 20) => {
    return this.logs
      .filter((l) => l.sessionId === sessionId || (userId && l.userId === userId))
      .slice(-limit)
      .reverse();   // most recent first
  };

  getAll(): UserLogEntry[] { return [...this.logs]; }
  clear(): void { this.logs = []; }
}

// ═══════════════════════════════════════════════════════════════════
// 4. SUPABASE DB STATE PROVIDER (adapter)
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a DbStateProvider that fetches recent rows from Supabase
 * using the REST API (no SDK required — pure fetch).
 *
 * @param supabaseUrl   From SUPABASE_URL env
 * @param supabaseKey   From SUPABASE_SERVICE_ROLE_KEY env
 * @param rowsPerTable  Max rows per table. Default 50.
 */
export function createSupabaseDbProvider(
  supabaseUrl: string,
  supabaseKey: string,
  rowsPerTable = 50
): DbStateProvider {
  return async (tables, triggerEvent) => {
    const data: Record<string, Array<Record<string, unknown>>> = {};

    await Promise.all(tables.map(async (table) => {
      try {
        const resp = await fetch(
          `${supabaseUrl}/rest/v1/${table}?limit=${rowsPerTable}&order=id.desc`,
          {
            headers: {
              "apikey":         supabaseKey,
              "Authorization":  `Bearer ${supabaseKey}`,
              "Accept":         "application/json",
            },
            signal: AbortSignal.timeout(8_000),
          }
        );
        if (resp.ok) {
          data[table] = await resp.json() as Array<Record<string, unknown>>;
        } else {
          data[table] = [];
        }
      } catch {
        data[table] = [];
      }
    }));

    return { tables, data, triggerEvent, capturedAt: Date.now() };
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5. ORCHESTRATOR — wires everything together
// ═══════════════════════════════════════════════════════════════════

export interface OrchestratorConfig {
  buffer:   ContextBuffer;
  injector: ContextInjector;
  /** Optional hook — called after every assemble(), before injection */
  onPacket?: (packet: ContextPacket) => void | Promise<void>;
}

/**
 * ContextOrchestrator — the top-level coordinator.
 *
 * Exposes a single `process()` method: given an event + agent calls,
 * it assembles a ContextPacket and injects it into all calls in one step.
 *
 * Also exposes `assembleOnly()` for cases where the caller wants the
 * packet but manages injection themselves.
 */
export class ContextOrchestrator {
  private buffer:   ContextBuffer;
  private injector: ContextInjector;
  private onPacket: OrchestratorConfig["onPacket"];

  constructor(config: OrchestratorConfig) {
    this.buffer   = config.buffer;
    this.injector = config.injector;
    this.onPacket = config.onPacket;
  }

  /**
   * Assemble a ContextPacket and inject it into all provided AgentCalls.
   * Returns both the packet and the decorated calls.
   */
  async process<TParams = unknown>(
    calls:         AgentCall<TParams>[],
    sessionId:     string,
    opts?: {
      userId?:       string;
      triggerEvent?: WatcherEvent;
      memoryQuery?:  string;
    }
  ): Promise<{ packet: ContextPacket; calls: InjectedAgentCall<TParams>[] }> {
    const packet = await this.buffer.assemble({
      sessionId,
      userId:       opts?.userId,
      triggerEvent: opts?.triggerEvent,
      memoryQuery:  opts?.memoryQuery,
    });

    if (this.onPacket) await Promise.resolve(this.onPacket(packet));

    const injected = this.injector.injectBatch(calls, packet);
    return { packet, calls: injected };
  }

  /**
   * Assemble only — no injection. Useful for pre-warming the buffer
   * or building the packet for use in a custom injection flow.
   */
  async assembleOnly(
    sessionId: string,
    opts?: {
      userId?:       string;
      triggerEvent?: WatcherEvent;
      memoryQuery?:  string;
    }
  ): Promise<ContextPacket> {
    return this.buffer.assemble({ sessionId, ...opts });
  }

  getLatestPacket(): ContextPacket | null { return this.buffer.getLatest(); }
  getPacketHistory(n = 10): ContextPacket[] { return this.buffer.getHistory(n); }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY — wire up from env in one call
// ═══════════════════════════════════════════════════════════════════

export interface OrchestratorFromEnvOptions {
  memoryProvider:    MemoryProvider;
  watchedTables?:    string[];
  pillarIndex?:      number;
  userLogLimit?:     number;
  memoryTopN?:       number;
  omitDbData?:       boolean;
  includeFullMemory?: boolean;
  rowsPerTable?:     number;
  onPacket?:         OrchestratorConfig["onPacket"];
}

/**
 * Build a fully-wired ContextOrchestrator from environment variables.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * @param logSink    An InProcessUserLogSink (or any provider implementation)
 * @param opts       Additional configuration
 */
export function createOrchestratorFromEnv(
  logSink: InProcessUserLogSink | UserLogProvider,
  opts:    OrchestratorFromEnvOptions
): ContextOrchestrator {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("[jit-buffer] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  const dbProvider  = createSupabaseDbProvider(url, key, opts.rowsPerTable ?? 50);
  const logProvider = typeof logSink === "function" ? logSink : logSink.asProvider;

  const buffer = new ContextBuffer(dbProvider, logProvider, opts.memoryProvider, {
    pillarIndex:   opts.pillarIndex  ?? 16,
    userLogLimit:  opts.userLogLimit ?? 20,
    memoryTopN:    opts.memoryTopN   ?? 3,
    watchedTables: opts.watchedTables ?? [],
  });

  const injector = new ContextInjector({
    omitDbData:        opts.omitDbData        ?? false,
    includeFullMemory: opts.includeFullMemory  ?? false,
  });

  return new ContextOrchestrator({ buffer, injector, onPacket: opts.onPacket });
}

// ═══════════════════════════════════════════════════════════════════
// PURE HELPERS — exported for unit testing without full stack
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a mock AgentCall for testing — no connection required.
 */
export function buildAgentCall<TParams = unknown>(
  agentId:  string,
  toolName: string,
  params:   TParams,
  metadata: Record<string, unknown> = {}
): AgentCall<TParams> {
  return {
    callId:      generateId("call"),
    agentId,
    toolName,
    parameters:  params,
    metadata,
    timestampMs: Date.now(),
  };
}

/**
 * Summarise a ContextPacket into a short prompt-ready string.
 * Suitable for prepending to an LLM system prompt.
 */
export function packetToPrompt(packet: ContextPacket): string {
  const lines: string[] = [
    `## Sovereign Mainframe — Context Packet`,
    `Session: ${packet.sessionId}  |  Pillar: ${packet.pillarIndex}  |  Assembled: ${new Date(packet.assembledAt).toISOString()}`,
    ``,
    `### Summary`,
    packet.summary,
    ``,
    `### Keywords`,
    packet.keywordIndex.slice(0, 30).join(", "),
  ];

  if (packet.userLogs.length > 0) {
    lines.push(``, `### Recent User Actions`);
    for (const log of packet.userLogs.slice(0, 5)) {
      lines.push(`- [${new Date(log.timestampMs).toISOString()}] ${log.actionType} in ${log.context}`);
    }
  }

  if (packet.memory.length > 0) {
    lines.push(``, `### Relevant Memory`);
    for (const m of packet.memory) {
      lines.push(`#### ${m.title} (score: ${m.score.toFixed(2)})`);
      lines.push(m.excerpt);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

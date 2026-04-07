/**
 * toolbox/tools/orchestration/context-relay.tool.ts
 * version: 1.0.0
 *
 * Context Orchestration Layer — Context Relay.
 * Pure TypeScript. Zero framework imports.
 *
 * Two systems in one file:
 *
 *   1. TableWatcher  — subscribes to Supabase/Postgres table-change events
 *      (INSERT / UPDATE / DELETE) via the Supabase Realtime channel API.
 *      Emits typed WatcherEvent objects to registered handlers. Handles
 *      reconnection, heartbeat, and subscription lifecycle.
 *
 *   2. MemoryScraper — maintains an in-memory index of .md files (loaded
 *      from the filesystem or provided programmatically) and, given a
 *      WatcherEvent, scores every document by relevance and returns the
 *      top-N most relevant files as MemoryDocument objects.
 *
 * Pillar 16: Context Orchestration Layer (GAB domain: NEURAL-INFRASTRUCTURE)
 *
 * Required env vars (Supabase Realtime):
 *   SUPABASE_URL              — e.g. https://xyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role JWT for server-side Realtime
 *
 * Filesystem env vars (optional):
 *   MEMORY_BASE_DIR           — absolute path to search for .md files
 *                               default: process.cwd()
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — TABLE WATCHER
// ═══════════════════════════════════════════════════════════════════

export type DbChangeType = "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE";

export type WatcherStatus =
  | "IDLE"          // Not started
  | "CONNECTING"    // WebSocket opening
  | "SUBSCRIBED"    // Receiving events
  | "RECONNECTING"  // Dropped — backoff active
  | "CLOSED";       // Permanently stopped

export interface DbRecord {
  [column: string]: string | number | boolean | null | object;
}

export interface WatcherEvent {
  id:           string;   // unique per event
  table:        string;
  schema:       string;
  changeType:   DbChangeType;
  record:       DbRecord | null;   // new row (null for DELETE)
  oldRecord:    DbRecord | null;   // previous row (UPDATE/DELETE)
  committedAt:  number;            // Unix ms
  /** Tags extracted from the record for relevance scoring */
  tags:         string[];
}

export interface WatcherSubscription {
  subscriptionId: string;
  table:          string;
  schema:         string;
  filter?:        string;          // Postgres-style filter, e.g. "status=eq.active"
  events:         DbChangeType[];
  status:         WatcherStatus;
  createdAt:      number;
  lastEventAt:    number | null;
  totalEvents:    number;
}

export type WatcherHandler = (event: WatcherEvent) => void | Promise<void>;

// ═══════════════════════════════════════════════════════════════════
// TYPES — MEMORY SCRAPER
// ═══════════════════════════════════════════════════════════════════

export interface MemoryDocument {
  id:          string;    // SHA-256-like fingerprint of file path
  filePath:    string;
  fileName:    string;
  /** First h1 heading found, or filename if none */
  title:       string;
  /** Raw markdown content */
  content:     string;
  /** Extracted keywords (headings + bold terms + first-sentence nouns) */
  keywords:    string[];
  /** Size in bytes */
  sizeBytes:   number;
  /** Unix ms of last index */
  indexedAt:   number;
  /** Pillar affinity tags (extracted from YAML front-matter or first paragraph) */
  pillarTags:  string[];
}

export interface MemoryMatch {
  document:    MemoryDocument;
  /** Relevance score 0–1 */
  score:       number;
  /** Which keywords triggered the match */
  matchedTerms: string[];
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Naive stable fingerprint for a string — not crypto-secure, just stable */
function fingerprint(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Tokenise a string into lowercase words, stripping markdown syntax */
function tokenise(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")   // strip code blocks
    .replace(/`[^`]+`/g, " ")          // strip inline code
    .replace(/[#*_\[\]()>|~]/g, " ")   // strip markdown chars
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

/** Extract title from markdown (first h1) */
function extractTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

/** Extract keywords: h2/h3 headings + bold terms */
function extractKeywords(content: string): string[] {
  const headings = [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim().toLowerCase());
  const bold     = [...content.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim().toLowerCase());
  return [...new Set([...headings, ...bold])].filter((k) => k.length > 2);
}

/** Extract pillar tags from YAML front-matter or first 200 chars */
function extractPillarTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (fmMatch) {
    const pillarsLine = fmMatch[1].match(/pillars?:\s*\[?([^\]\n]+)/i);
    if (pillarsLine) {
      return pillarsLine[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
    }
  }
  // Fallback: scan for "pillar N" mentions
  const mentions = [...content.slice(0, 500).matchAll(/pillar\s+(\d+)/gi)].map((m) => `pillar-${m[1]}`);
  return [...new Set(mentions)];
}

/** Score a document against a set of query terms. Returns 0–1. */
function scoreDocument(doc: MemoryDocument, queryTerms: string[]): { score: number; matchedTerms: string[] } {
  if (queryTerms.length === 0) return { score: 0, matchedTerms: [] };

  const docTokens  = new Set(tokenise(doc.content));
  const docKeywords = new Set(doc.keywords.map((k) => k.toLowerCase()));
  const matched    = new Set<string>();
  let weightedHits = 0;

  for (const term of queryTerms) {
    const normTerm = term.toLowerCase();
    // Keyword match (headings / bold) = higher weight
    if (docKeywords.has(normTerm)) { weightedHits += 2; matched.add(term); }
    // Body token match = base weight
    else if (docTokens.has(normTerm)) { weightedHits += 1; matched.add(term); }
    // Pillar tag match = bonus
    if (doc.pillarTags.some((t) => t.includes(normTerm))) { weightedHits += 1.5; matched.add(term); }
  }

  const maxScore = queryTerms.length * 2.5; // max per-term weight
  const score    = Math.min(1, weightedHits / maxScore);
  return { score, matchedTerms: [...matched] };
}

// ═══════════════════════════════════════════════════════════════════
// 1. TABLE WATCHER — Supabase Realtime subscriber
// ═══════════════════════════════════════════════════════════════════

export interface TableWatcherConfig {
  supabaseUrl:      string;
  supabaseKey:      string;
  /** Max reconnection attempts before giving up. 0 = infinite. Default 10. */
  maxReconnects?:   number;
  /** Initial reconnect delay in ms. Exponential backoff doubles each attempt. Default 1000. */
  reconnectDelayMs?: number;
  /** Heartbeat interval in ms. Default 25 000. */
  heartbeatMs?:     number;
}

/**
 * TableWatcher — subscribes to Supabase Realtime for row-level DB changes.
 *
 * Uses the Supabase Realtime WebSocket protocol (phoenix channel format).
 * Handles reconnection with exponential backoff, heartbeat keepalives,
 * and subscription lifecycle per-table.
 *
 * Usage:
 *   const watcher = new TableWatcher({ supabaseUrl, supabaseKey });
 *   const sub = watcher.subscribe({
 *     table: "orders", schema: "public", events: ["INSERT","UPDATE"],
 *   }, (event) => console.log(event));
 *   await watcher.connect();
 */
export class TableWatcher {
  private config:        Required<TableWatcherConfig>;
  private subscriptions: Map<string, WatcherSubscription>   = new Map();
  private handlers:      Map<string, WatcherHandler[]>       = new Map();
  private ws:            WebSocket | null                    = null;
  private status:        WatcherStatus                       = "IDLE";
  private reconnectCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventLog:      WatcherEvent[]                      = [];

  constructor(config: TableWatcherConfig) {
    this.config = {
      supabaseUrl:      config.supabaseUrl.replace(/\/$/, ""),
      supabaseKey:      config.supabaseKey,
      maxReconnects:    config.maxReconnects    ?? 10,
      reconnectDelayMs: config.reconnectDelayMs ?? 1_000,
      heartbeatMs:      config.heartbeatMs      ?? 25_000,
    };
  }

  // ── Public API ─────────────────────────────────────────────────

  get currentStatus(): WatcherStatus { return this.status; }
  getSubscriptions():  WatcherSubscription[] { return [...this.subscriptions.values()]; }
  getEventLog(n = 50): WatcherEvent[]        { return this.eventLog.slice(-n); }

  /**
   * Register a subscription for table changes before or after connect().
   * Returns the subscription record.
   */
  subscribe(
    opts: {
      table:   string;
      schema?: string;
      events?: DbChangeType[];
      filter?: string;
    },
    handler: WatcherHandler
  ): WatcherSubscription {
    const subId = generateId("sub");
    const sub: WatcherSubscription = {
      subscriptionId: subId,
      table:          opts.table,
      schema:         opts.schema  ?? "public",
      filter:         opts.filter,
      events:         opts.events  ?? ["INSERT", "UPDATE", "DELETE"],
      status:         "IDLE",
      createdAt:      Date.now(),
      lastEventAt:    null,
      totalEvents:    0,
    };

    this.subscriptions.set(subId, sub);
    this.handlers.set(subId, [handler]);

    // If already connected, send join immediately
    if (this.status === "SUBSCRIBED" && this.ws) this._joinChannel(sub);

    return sub;
  }

  addHandler(subscriptionId: string, handler: WatcherHandler): boolean {
    const list = this.handlers.get(subscriptionId);
    if (!list) return false;
    list.push(handler);
    return true;
  }

  unsubscribe(subscriptionId: string): boolean {
    if (!this.subscriptions.has(subscriptionId)) return false;
    if (this.ws && this.status === "SUBSCRIBED") {
      this._leaveChannel(subscriptionId);
    }
    this.subscriptions.delete(subscriptionId);
    this.handlers.delete(subscriptionId);
    return true;
  }

  /** Open the WebSocket connection and join all registered channels. */
  async connect(): Promise<void> {
    if (this.status === "SUBSCRIBED" || this.status === "CONNECTING") return;
    this.status = "CONNECTING";

    const realtimeUrl = this.config.supabaseUrl
      .replace("https://", "wss://")
      .replace("http://", "ws://")
      + `/realtime/v1/websocket?apikey=${this.config.supabaseKey}&vsn=1.0.0`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(realtimeUrl);
      } catch (err) {
        this.status = "IDLE";
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.status        = "SUBSCRIBED";
        this.reconnectCount = 0;
        this._startHeartbeat();
        for (const sub of this.subscriptions.values()) this._joinChannel(sub);
        resolve();
      };

      this.ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(typeof msg.data === "string" ? msg.data : "") as Record<string, unknown>;
          this._handleMessage(payload);
        } catch { /* ignore parse errors */ }
      };

      this.ws.onerror = () => {
        // onerror always precedes onclose — let onclose handle reconnect
      };

      this.ws.onclose = () => {
        this._stopHeartbeat();
        if (this.status === "CLOSED") return;
        this._scheduleReconnect();
      };
    });
  }

  /** Permanently close the connection. */
  disconnect(): void {
    this.status = "CLOSED";
    this._stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  // ── Private — WebSocket protocol ──────────────────────────────

  private _joinChannel(sub: WatcherSubscription): void {
    if (!this.ws) return;

    // Build Supabase Realtime channel join payload
    const channelName = `realtime:${sub.schema}:${sub.table}${sub.filter ? `:${sub.filter}` : ""}`;
    const binding     = sub.events.map((ev) => ({
      event:  `postgres_changes`,
      filter: `event=${ev}&schema=${sub.schema}&table=${sub.table}${sub.filter ? `&filter=${sub.filter}` : ""}`,
    }));

    const msg = {
      topic:   channelName,
      event:   "phx_join",
      payload: { config: { postgres_changes: binding }, access_token: this.config.supabaseKey },
      ref:     sub.subscriptionId,
    };

    this.ws.send(JSON.stringify(msg));
    sub.status = "SUBSCRIBED";
  }

  private _leaveChannel(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || !this.ws) return;
    const channelName = `realtime:${sub.schema}:${sub.table}`;
    this.ws.send(JSON.stringify({ topic: channelName, event: "phx_leave", payload: {}, ref: subscriptionId }));
  }

  private _handleMessage(payload: Record<string, unknown>): void {
    const event = payload.event as string | undefined;
    if (event === "phx_reply" || event === "heartbeat") return;

    // Postgres change events
    if (event === "postgres_changes" || event === "*") {
      const data = (payload.payload as Record<string, unknown> | undefined) ?? payload;
      const type        = (data.type ?? data.eventType) as string ?? "INSERT";
      const table       = (data.table ?? (data.data as Record<string, unknown> | undefined)?.table) as string ?? "unknown";
      const schema      = (data.schema ?? "public") as string;
      const record      = (data.record ?? null) as DbRecord | null;
      const oldRecord   = (data.old_record ?? null) as DbRecord | null;

      const watcherEvent: WatcherEvent = {
        id:          generateId("evt"),
        table,
        schema,
        changeType:  type.toUpperCase() as DbChangeType,
        record,
        oldRecord,
        committedAt: Date.now(),
        tags:        this._extractTagsFromRecord(table, record ?? oldRecord),
      };

      this.eventLog.push(watcherEvent);
      if (this.eventLog.length > 5_000) this.eventLog.shift();

      // Route to matching subscriptions
      for (const [subId, sub] of this.subscriptions) {
        if (sub.table !== table) continue;
        if (!sub.events.includes(watcherEvent.changeType)) continue;
        sub.lastEventAt = Date.now();
        sub.totalEvents++;

        const handlers = this.handlers.get(subId) ?? [];
        for (const h of handlers) {
          Promise.resolve(h(watcherEvent)).catch((err) =>
            console.error(`[context-relay] Handler error for ${subId}:`, err)
          );
        }
      }
    }
  }

  /** Extract searchable tags from a DB record to aid memory relevance scoring. */
  private _extractTagsFromRecord(table: string, record: DbRecord | null): string[] {
    if (!record) return [table];
    const tags: string[] = [table];

    // String columns that are likely categorical or descriptive
    for (const [key, val] of Object.entries(record)) {
      if (typeof val === "string" && val.length > 0 && val.length < 120) {
        tags.push(...val.toLowerCase().split(/[\s,_-]+/).filter((t) => t.length > 2));
      }
      // Include column names themselves as context signals
      tags.push(key.toLowerCase());
    }

    return [...new Set(tags)];
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "hb" }));
      }
    }, this.config.heartbeatMs);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private async _scheduleReconnect(): Promise<void> {
    if (this.config.maxReconnects > 0 && this.reconnectCount >= this.config.maxReconnects) {
      console.error(`[context-relay] Max reconnection attempts (${this.config.maxReconnects}) reached. Giving up.`);
      this.status = "CLOSED";
      return;
    }

    this.status = "RECONNECTING";
    this.reconnectCount++;
    const delay = this.config.reconnectDelayMs * Math.pow(2, Math.min(this.reconnectCount - 1, 6));
    console.warn(`[context-relay] Reconnecting in ${delay}ms (attempt ${this.reconnectCount})...`);

    await new Promise((r) => setTimeout(r, delay));
    this.connect().catch(() => { /* handled inside connect */ });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. MEMORY SCRAPER — .md index + relevance scoring
// ═══════════════════════════════════════════════════════════════════

export interface MemoryScraperConfig {
  /** Root directory to scan for .md files. Default: process.cwd() */
  baseDir?:       string;
  /** File-name patterns to include. Default: ["*.md", "**/*.md"] */
  includeGlobs?:  string[];
  /** File-name patterns to exclude. Default: ["node_modules/**", ".git/**"] */
  excludeGlobs?:  string[];
  /** Max file size to index in bytes. Default 512 KB. */
  maxFileSizeBytes?: number;
  /** How many top matches to return by default. Default 3. */
  defaultTopN?:   number;
}

/**
 * MemoryScraper — indexes markdown files and returns the top-N most
 * relevant documents for a given WatcherEvent or freeform query.
 *
 * Two ingestion modes:
 *   - `scanFilesystem()` — reads .md files from disk (Bun/Node native fs)
 *   - `ingestDocument()` — accepts pre-loaded content programmatically
 *     (safe for environments without filesystem access, e.g. Vercel)
 *
 * Relevance scoring:
 *   - Query terms are derived from WatcherEvent.tags or freeform string
 *   - Documents scored by: keyword hit (2×) + body token hit (1×) + pillar-tag hit (1.5×)
 *   - Normalized to 0–1; ties broken by recency of indexing
 */
export class MemoryScraper {
  private index:  Map<string, MemoryDocument> = new Map();
  private config: Required<MemoryScraperConfig>;

  constructor(config: MemoryScraperConfig = {}) {
    this.config = {
      baseDir:         config.baseDir          ?? process.cwd(),
      includeGlobs:    config.includeGlobs     ?? ["*.md", "**/*.md"],
      excludeGlobs:    config.excludeGlobs     ?? ["node_modules/**", ".git/**", "dist/**"],
      maxFileSizeBytes: config.maxFileSizeBytes ?? 512 * 1024,
      defaultTopN:     config.defaultTopN      ?? 3,
    };
  }

  // ── Index management ───────────────────────────────────────────

  /**
   * Ingest a markdown document directly (no filesystem required).
   * Use this when content is already in memory (e.g. fetched from Supabase storage).
   */
  ingestDocument(filePath: string, content: string): MemoryDocument {
    const fileName = filePath.split("/").pop() ?? filePath;
    const doc: MemoryDocument = {
      id:         fingerprint(filePath),
      filePath,
      fileName,
      title:      extractTitle(content, fileName.replace(/\.md$/, "")),
      content,
      keywords:   extractKeywords(content),
      sizeBytes:  content.length,
      indexedAt:  Date.now(),
      pillarTags: extractPillarTags(content),
    };
    this.index.set(doc.id, doc);
    return doc;
  }

  /**
   * Scan the filesystem for .md files and index them.
   * Uses Bun.Glob if available, falls back to recursive fs.readdir.
   * Non-fatal: skips files that cannot be read.
   *
   * @returns Number of files indexed
   */
  async scanFilesystem(): Promise<{ indexed: number; skipped: number; errors: string[] }> {
    let indexed = 0, skipped = 0;
    const errors: string[] = [];

    const files = await this._findMarkdownFiles();

    await Promise.all(files.map(async (filePath) => {
      try {
        const content = await this._readFile(filePath);
        if (!content || content.length > this.config.maxFileSizeBytes) { skipped++; return; }
        this.ingestDocument(filePath, content);
        indexed++;
      } catch (err: unknown) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        skipped++;
      }
    }));

    return { indexed, skipped, errors };
  }

  removeDocument(filePath: string): boolean {
    const id = fingerprint(filePath);
    return this.index.delete(id);
  }

  clearIndex(): void { this.index.clear(); }

  getIndexSize(): number { return this.index.size; }

  listIndexed(): Pick<MemoryDocument, "id" | "filePath" | "title" | "sizeBytes" | "indexedAt">[] {
    return [...this.index.values()].map(({ id, filePath, title, sizeBytes, indexedAt }) =>
      ({ id, filePath, title, sizeBytes, indexedAt })
    );
  }

  // ── Retrieval ──────────────────────────────────────────────────

  /**
   * Score all indexed documents against a WatcherEvent and return top-N matches.
   * Query terms are derived from event.tags + table name + change type.
   */
  queryForEvent(event: WatcherEvent, topN?: number): MemoryMatch[] {
    const terms = [
      ...event.tags,
      event.table,
      event.changeType.toLowerCase(),
      event.schema,
    ];
    return this._query(terms, topN ?? this.config.defaultTopN);
  }

  /**
   * Score all indexed documents against a freeform string query.
   */
  queryFreeform(query: string, topN?: number): MemoryMatch[] {
    const terms = tokenise(query);
    return this._query(terms, topN ?? this.config.defaultTopN);
  }

  /**
   * Retrieve a document by its file path.
   */
  getByPath(filePath: string): MemoryDocument | null {
    return this.index.get(fingerprint(filePath)) ?? null;
  }

  // ── Private ────────────────────────────────────────────────────

  private _query(terms: string[], topN: number): MemoryMatch[] {
    const results: MemoryMatch[] = [];

    for (const doc of this.index.values()) {
      const { score, matchedTerms } = scoreDocument(doc, terms);
      if (score > 0) results.push({ document: doc, score, matchedTerms });
    }

    // Sort by score desc, then by recency desc as tiebreaker
    results.sort((a, b) =>
      b.score - a.score || b.document.indexedAt - a.document.indexedAt
    );

    return results.slice(0, topN);
  }

  private async _findMarkdownFiles(): Promise<string[]> {
    const files: string[] = [];
    const excluded = this.config.excludeGlobs;

    const isExcluded = (p: string) =>
      excluded.some((pat) => p.includes(pat.replace("/**", "").replace("**", "")));

    // Bun native glob
    if (typeof Bun !== "undefined" && (Bun as Record<string, unknown>).Glob) {
      const BunGlob = (Bun as Record<string, unknown>).Glob as new (pat: string) => { scan: (opts: { cwd: string; dot: boolean }) => AsyncIterable<string> };
      try {
        for (const pat of this.config.includeGlobs) {
          const glob = new BunGlob(pat);
          for await (const f of glob.scan({ cwd: this.config.baseDir, dot: false })) {
            const full = `${this.config.baseDir}/${f}`;
            if (!isExcluded(full)) files.push(full);
          }
        }
        return [...new Set(files)];
      } catch { /* fall through to Node */ }
    }

    // Node.js fallback — recursive readdir
    try {
      const fs   = await import("fs/promises");
      const path = await import("path");

      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (isExcluded(full)) continue;
          if (e.isDirectory()) await walk(full);
          else if (e.name.endsWith(".md")) files.push(full);
        }
      };

      await walk(this.config.baseDir);
    } catch { /* silently skip in environments without fs */ }

    return [...new Set(files)];
  }

  private async _readFile(filePath: string): Promise<string | null> {
    // Bun native
    if (typeof Bun !== "undefined") {
      try {
        const f = Bun.file(filePath);
        return await f.text();
      } catch { return null; }
    }
    // Node fallback
    try {
      const fs = await import("fs/promises");
      return await fs.readFile(filePath, "utf-8");
    } catch { return null; }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY — default instances from env
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a TableWatcher from environment variables.
 * Throws if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.
 */
export function createWatcherFromEnv(config?: Partial<TableWatcherConfig>): TableWatcher {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[context-relay] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  return new TableWatcher({ supabaseUrl: url, supabaseKey: key, ...config });
}

/**
 * Build a MemoryScraper from environment variables.
 */
export function createScraperFromEnv(config?: Partial<MemoryScraperConfig>): MemoryScraper {
  return new MemoryScraper({
    baseDir:  process.env.MEMORY_BASE_DIR ?? process.cwd(),
    ...config,
  });
}

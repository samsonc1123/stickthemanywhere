/**
 * toolbox/tools/linguistic-forge/prompt-archive.ts
 * version: 1.0.0
 *
 * Pillar 23: Prompt Mutation System
 * Domain: Linguistic-Evolution
 *
 * Indexes every prompt template alongside its Fitness Score from
 * Pillar 17-EVO (TelemetryLogger / FeedbackScorer).
 *
 * A PromptRecord stores:
 *   - The prompt template (raw string with {{variable}} placeholders)
 *   - Lineage: parentIds[], generationIndex, mutation type that produced it
 *   - Fitness: score [0,1], grade, outcome counts, last evaluated timestamp
 *   - Status: ACTIVE (in rotation), ARCHIVED (retired), CANDIDATE (not yet tested)
 *
 * Storage:
 *   InMemoryPromptArchive  — default; survives process lifetime
 *   createSupabasePromptArchive — persistent via Supabase REST
 *     Required table: `prompt_archive` (schema in file footer)
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type MutationType =
  | "SEED"         // original hand-authored template
  | "TONE"         // tone perturbation variant
  | "STRUCTURE"    // structural reordering variant
  | "CONSTRAINT"   // constraint tightening/relaxing variant
  | "CROSSOVER"    // merged from two parents
  | "MANUAL";      // manually added post-hoc

export type PromptStatus = "CANDIDATE" | "ACTIVE" | "ARCHIVED";

export interface PromptFitness {
  /** Composite score [0, 1] — updated from FeedbackScorer */
  score:          number;
  /** Number of agent invocations using this prompt */
  invocations:    number;
  successCount:   number;
  retryCount:     number;
  abandonCount:   number;
  avgLatencyMs:   number;
  avgConfidence:  number;
  /** Unix ms when fitness was last recalculated */
  lastEvaluatedAt: number | null;
}

export interface PromptRecord {
  /** UUID-style unique identifier */
  promptId:       string;
  /** Human-readable name for dashboards */
  name:           string;
  /** The actual prompt template — use {{variable}} for placeholders */
  template:       string;
  /** Which pillar / agent uses this prompt */
  pillarId:       string;
  /** Optional sub-category within pillar (e.g. "WORKER", "CRITIC") */
  agentRole?:     string;
  /** Generation in the evolutionary lineage (0 = seed) */
  generation:     number;
  /** IDs of parent prompts this was derived from */
  parentIds:      string[];
  /** How this prompt was produced */
  mutationType:   MutationType;
  status:         PromptStatus;
  fitness:        PromptFitness;
  /** Tags for filtering / grouping */
  tags:           string[];
  createdAt:      number;   // Unix ms
  updatedAt:      number;   // Unix ms
}

export interface PromptFilter {
  pillarId?:    string;
  agentRole?:   string;
  status?:      PromptStatus;
  mutationType?: MutationType;
  minScore?:    number;
  maxScore?:    number;
  tags?:        string[];
  limit?:       number;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _idSeq = 0;
export function generatePromptId(): string {
  const ts  = Date.now().toString(36);
  const seq = (++_idSeq).toString(36).padStart(4, "0");
  const rnd = Math.random().toString(36).slice(2, 6);
  return `prm_${ts}_${seq}_${rnd}`;
}

// ═══════════════════════════════════════════════════════════════════
// BLANK FITNESS
// ═══════════════════════════════════════════════════════════════════

export function blankFitness(): PromptFitness {
  return {
    score:           0,
    invocations:     0,
    successCount:    0,
    retryCount:      0,
    abandonCount:    0,
    avgLatencyMs:    0,
    avgConfidence:   0,
    lastEvaluatedAt: null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ARCHIVE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface PromptArchiveAdapter {
  insert(record: PromptRecord): Promise<void>;
  getById(promptId: string): Promise<PromptRecord | null>;
  update(promptId: string, patch: Partial<PromptRecord>): Promise<void>;
  query(filter: PromptFilter): Promise<PromptRecord[]>;
  delete(promptId: string): Promise<void>;
  count(filter?: Partial<PromptFilter>): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY ARCHIVE
// ═══════════════════════════════════════════════════════════════════

export class InMemoryPromptArchive implements PromptArchiveAdapter {
  private store: Map<string, PromptRecord> = new Map();

  async insert(record: PromptRecord): Promise<void> {
    if (this.store.has(record.promptId)) {
      throw new Error(`PromptArchive: prompt '${record.promptId}' already exists.`);
    }
    this.store.set(record.promptId, { ...record });
  }

  async getById(promptId: string): Promise<PromptRecord | null> {
    return this.store.get(promptId) ?? null;
  }

  async update(promptId: string, patch: Partial<PromptRecord>): Promise<void> {
    const existing = this.store.get(promptId);
    if (!existing) throw new Error(`PromptArchive: prompt '${promptId}' not found.`);
    this.store.set(promptId, { ...existing, ...patch, updatedAt: Date.now() });
  }

  async query(filter: PromptFilter): Promise<PromptRecord[]> {
    let results = [...this.store.values()];
    if (filter.pillarId)    results = results.filter((r) => r.pillarId    === filter.pillarId);
    if (filter.agentRole)   results = results.filter((r) => r.agentRole   === filter.agentRole);
    if (filter.status)      results = results.filter((r) => r.status      === filter.status);
    if (filter.mutationType) results = results.filter((r) => r.mutationType === filter.mutationType);
    if (filter.minScore !== undefined) results = results.filter((r) => r.fitness.score >= filter.minScore!);
    if (filter.maxScore !== undefined) results = results.filter((r) => r.fitness.score <= filter.maxScore!);
    if (filter.tags?.length) results = results.filter((r) => filter.tags!.every((t) => r.tags.includes(t)));
    results.sort((a, b) => b.fitness.score - a.fitness.score);
    if (filter.limit) results = results.slice(0, filter.limit);
    return results;
  }

  async delete(promptId: string): Promise<void> {
    this.store.delete(promptId);
  }

  async count(filter?: Partial<PromptFilter>): Promise<number> {
    if (!filter) return this.store.size;
    return (await this.query(filter as PromptFilter)).length;
  }

  snapshot(): PromptRecord[] {
    return [...this.store.values()];
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT ARCHIVE  (high-level manager)
// ═══════════════════════════════════════════════════════════════════

export class PromptArchive {
  constructor(private readonly adapter: PromptArchiveAdapter = new InMemoryPromptArchive()) {}

  // ── Create ───────────────────────────────────────────────────────

  async seed(
    name:      string,
    template:  string,
    pillarId:  string,
    opts?: {
      agentRole?:  string;
      tags?:       string[];
    }
  ): Promise<PromptRecord> {
    const record: PromptRecord = {
      promptId:     generatePromptId(),
      name,
      template,
      pillarId,
      agentRole:    opts?.agentRole,
      generation:   0,
      parentIds:    [],
      mutationType: "SEED",
      status:       "CANDIDATE",
      fitness:      blankFitness(),
      tags:         opts?.tags ?? [],
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
    };
    await this.adapter.insert(record);
    return record;
  }

  async register(record: PromptRecord): Promise<void> {
    await this.adapter.insert(record);
  }

  // ── Read ─────────────────────────────────────────────────────────

  async get(promptId: string): Promise<PromptRecord | null> {
    return this.adapter.getById(promptId);
  }

  async find(filter: PromptFilter): Promise<PromptRecord[]> {
    return this.adapter.query(filter);
  }

  async getBest(pillarId: string, limit = 5): Promise<PromptRecord[]> {
    return this.adapter.query({ pillarId, status: "ACTIVE", limit });
  }

  async getActive(pillarId: string): Promise<PromptRecord[]> {
    return this.adapter.query({ pillarId, status: "ACTIVE" });
  }

  async getCandidates(pillarId: string): Promise<PromptRecord[]> {
    return this.adapter.query({ pillarId, status: "CANDIDATE" });
  }

  // ── Fitness update ───────────────────────────────────────────────

  /**
   * Update the fitness of a prompt from a Pillar 17-EVO pillarSummary result.
   */
  async updateFitness(
    promptId:  string,
    fitness:   Partial<PromptFitness> & { score: number }
  ): Promise<void> {
    const record = await this.adapter.getById(promptId);
    if (!record) throw new Error(`PromptArchive: prompt '${promptId}' not found.`);
    await this.adapter.update(promptId, {
      fitness: { ...record.fitness, ...fitness, lastEvaluatedAt: Date.now() },
    });
  }

  // ── Status transitions ────────────────────────────────────────────

  async activate(promptId: string): Promise<void> {
    await this.adapter.update(promptId, { status: "ACTIVE" });
  }

  async archive(promptId: string): Promise<void> {
    await this.adapter.update(promptId, { status: "ARCHIVED" });
  }

  /**
   * Promote winner and archive loser — called by FitnessEvaluator after A/B test.
   */
  async applyABResult(winnerId: string, loserId: string): Promise<void> {
    await this.activate(winnerId);
    await this.archive(loserId);
  }

  // ── Lineage ──────────────────────────────────────────────────────

  async getLineage(promptId: string): Promise<PromptRecord[]> {
    const lineage: PromptRecord[] = [];
    const visited = new Set<string>();
    const walk = async (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const rec = await this.adapter.getById(id);
      if (!rec) return;
      lineage.push(rec);
      for (const pid of rec.parentIds) await walk(pid);
    };
    await walk(promptId);
    return lineage.sort((a, b) => a.generation - b.generation);
  }

  // ── Stats ────────────────────────────────────────────────────────

  async pillarStats(pillarId: string): Promise<{
    total:     number;
    active:    number;
    candidate: number;
    archived:  number;
    bestScore: number;
    avgScore:  number;
  }> {
    const all   = await this.adapter.query({ pillarId });
    const act   = all.filter((r) => r.status === "ACTIVE").length;
    const cand  = all.filter((r) => r.status === "CANDIDATE").length;
    const arch  = all.filter((r) => r.status === "ARCHIVED").length;
    const scores = all.map((r) => r.fitness.score);
    return {
      total:     all.length,
      active:    act,
      candidate: cand,
      archived:  arch,
      bestScore: scores.length ? Math.max(...scores) : 0,
      avgScore:  scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Required Supabase table:
 *
 *   CREATE TABLE prompt_archive (
 *     prompt_id      TEXT PRIMARY KEY,
 *     name           TEXT    NOT NULL,
 *     template       TEXT    NOT NULL,
 *     pillar_id      TEXT    NOT NULL,
 *     agent_role     TEXT,
 *     generation     INTEGER NOT NULL DEFAULT 0,
 *     parent_ids     TEXT[]  NOT NULL DEFAULT '{}',
 *     mutation_type  TEXT    NOT NULL,
 *     status         TEXT    NOT NULL DEFAULT 'CANDIDATE',
 *     fitness        JSONB   NOT NULL DEFAULT '{}',
 *     tags           TEXT[]  NOT NULL DEFAULT '{}',
 *     created_at     BIGINT  NOT NULL,
 *     updated_at     BIGINT  NOT NULL
 *   );
 *   CREATE INDEX ON prompt_archive (pillar_id, status);
 *   CREATE INDEX ON prompt_archive ((fitness->>'score') DESC);
 */
export function createSupabasePromptArchive(
  supabaseUrl: string,
  supabaseKey: string
): PromptArchiveAdapter {
  const headers = {
    "apikey":        supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };
  const base = `${supabaseUrl}/rest/v1/prompt_archive`;

  const toRow = (r: PromptRecord) => ({
    prompt_id:     r.promptId,
    name:          r.name,
    template:      r.template,
    pillar_id:     r.pillarId,
    agent_role:    r.agentRole ?? null,
    generation:    r.generation,
    parent_ids:    r.parentIds,
    mutation_type: r.mutationType,
    status:        r.status,
    fitness:       r.fitness,
    tags:          r.tags,
    created_at:    r.createdAt,
    updated_at:    r.updatedAt,
  });

  const fromRow = (row: Record<string, unknown>): PromptRecord => ({
    promptId:     row.prompt_id     as string,
    name:         row.name          as string,
    template:     row.template      as string,
    pillarId:     row.pillar_id     as string,
    agentRole:    row.agent_role    as string | undefined,
    generation:   row.generation    as number,
    parentIds:    (row.parent_ids ?? []) as string[],
    mutationType: row.mutation_type as MutationType,
    status:       row.status        as PromptStatus,
    fitness:      (row.fitness ?? blankFitness()) as PromptFitness,
    tags:         (row.tags ?? []) as string[],
    createdAt:    row.created_at    as number,
    updatedAt:    row.updated_at    as number,
  });

  return {
    async insert(record) {
      await fetch(base, {
        method: "POST",
        headers,
        body:   JSON.stringify(toRow(record)),
        signal: AbortSignal.timeout(8_000),
      });
    },
    async getById(promptId) {
      const resp = await fetch(`${base}?prompt_id=eq.${promptId}&limit=1`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows[0] ? fromRow(rows[0]) : null;
    },
    async update(promptId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.status)      row["status"]      = patch.status;
      if (patch.fitness)     row["fitness"]      = patch.fitness;
      if (patch.name)        row["name"]         = patch.name;
      if (patch.template)    row["template"]     = patch.template;
      if (patch.tags)        row["tags"]         = patch.tags;
      row["updated_at"] = Date.now();
      await fetch(`${base}?prompt_id=eq.${promptId}`, {
        method:  "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body:    JSON.stringify(row),
        signal:  AbortSignal.timeout(8_000),
      });
    },
    async query(filter) {
      const params: string[] = ["order=fitness->>score.desc"];
      if (filter.pillarId)     params.push(`pillar_id=eq.${filter.pillarId}`);
      if (filter.agentRole)    params.push(`agent_role=eq.${filter.agentRole}`);
      if (filter.status)       params.push(`status=eq.${filter.status}`);
      if (filter.mutationType) params.push(`mutation_type=eq.${filter.mutationType}`);
      if (filter.limit)        params.push(`limit=${filter.limit}`);
      const resp = await fetch(`${base}?${params.join("&")}`, { headers, signal: AbortSignal.timeout(8_000) });
      const rows = await resp.json() as Record<string, unknown>[];
      return rows.map(fromRow);
    },
    async delete(promptId) {
      await fetch(`${base}?prompt_id=eq.${promptId}`, { method: "DELETE", headers, signal: AbortSignal.timeout(8_000) });
    },
    async count(filter) {
      const params: string[] = [];
      if (filter?.pillarId) params.push(`pillar_id=eq.${filter.pillarId}`);
      if (filter?.status)   params.push(`status=eq.${filter.status}`);
      const resp = await fetch(`${base}?${params.join("&")}`, {
        headers: { ...headers, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0" },
        signal:  AbortSignal.timeout(8_000),
      });
      const range = resp.headers.get("content-range") ?? "0/0";
      return parseInt(range.split("/")[1] ?? "0", 10);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatPromptRecord(r: PromptRecord): string {
  const score = (r.fitness.score * 100).toFixed(1);
  const age   = r.fitness.lastEvaluatedAt
    ? `${Math.round((Date.now() - r.fitness.lastEvaluatedAt) / 60_000)}m ago`
    : "never";
  return [
    `[${r.status.padEnd(9)}] ${r.name.padEnd(30)}  score=${score}%  gen=${r.generation}  type=${r.mutationType}`,
    `  id=${r.promptId}  pillar=${r.pillarId}  invocations=${r.fitness.invocations}  evaluated=${age}`,
    `  template: ${r.template.slice(0, 80)}${r.template.length > 80 ? "…" : ""}`,
  ].join("\n");
}

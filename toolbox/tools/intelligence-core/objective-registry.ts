/**
 * toolbox/tools/intelligence-core/objective-registry.ts
 * version: 1.0.0
 *
 * Pillar 29: Objective Registry
 * Domain: AUTONOMOUS-SOVEREIGNTY
 *
 * Stores Persistent Goals (Objectives) that are injected as the
 * primary system prompt context into every spawned agent.
 *
 * Each Objective carries:
 *   - A goal statement (e.g. "Maximise taxonomy classification accuracy")
 *   - A measurable target metric and current value
 *   - A priority weight [0, 1]
 *   - An owner pillar
 *   - An auto-generated system prompt fragment
 *
 * ObjectiveRegistry assembles all active objectives into a single
 * SOVEREIGN OBJECTIVES BLOCK that is prepended to every agent's
 * system prompt — making the Mainframe's persistent goals visible
 * to all spawned agents at all times.
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ObjectiveStatus = "ACTIVE" | "PAUSED" | "ACHIEVED" | "DEPRECATED";

export type ObjectiveCategory =
  | "ACCURACY"     // e.g. classification accuracy, CRITIC confidence
  | "REVENUE"      // e.g. conversion rate, order value
  | "VELOCITY"     // e.g. latency, throughput, cycle time
  | "QUALITY"      // e.g. rejection rate, hallucination rate
  | "RESILIENCE"   // e.g. uptime, failure rate, retry rate
  | "GROWTH"       // e.g. new category discovery, user growth
  | "SOVEREIGNTY"; // e.g. reduce external API dependency ratio

export interface ObjectiveMetric {
  name:         string;
  currentValue: number;
  targetValue:  number;
  unit:         string;    // e.g. "%", "ms", "count", "$"
  direction:    "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  lastMeasuredAt: number | null;
}

export interface PersistentObjective {
  objectiveId:   string;
  title:         string;
  /** Natural language goal statement */
  statement:     string;
  category:      ObjectiveCategory;
  status:        ObjectiveStatus;
  /** Priority weight [0, 1] — higher = more important */
  weight:        number;
  /** Pillar primarily responsible for this objective */
  ownerPillar:   string;
  /** Pillars that contribute to this objective */
  linkedPillars: string[];
  metric:        ObjectiveMetric;
  /** Auto-generated imperative instruction for agent prompts */
  promptFragment: string;
  createdAt:     number;
  updatedAt:     number;
  achievedAt:    number | null;
}

export interface ObjectiveFilter {
  category?:   ObjectiveCategory;
  status?:     ObjectiveStatus;
  ownerPillar?: string;
  minWeight?:  number;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _objSeq = 0;
function objectiveId(): string {
  return `obj_${Date.now().toString(36)}_${(++_objSeq).toString(36).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT FRAGMENT BUILDER
// ═══════════════════════════════════════════════════════════════════

function buildPromptFragment(obj: PersistentObjective): string {
  const dir  = obj.metric.direction === "HIGHER_IS_BETTER" ? "maximise" : "minimise";
  const gap  = Math.abs(obj.metric.targetValue - obj.metric.currentValue);
  const unit = obj.metric.unit;
  const pct  = obj.weight >= 0.8 ? "CRITICAL PRIORITY" : obj.weight >= 0.5 ? "HIGH PRIORITY" : "STANDARD";

  return `[${pct}] ${obj.title}: ${obj.statement} — ${dir} ${obj.metric.name} ` +
    `(current: ${obj.metric.currentValue}${unit}, target: ${obj.metric.targetValue}${unit}, gap: ${gap.toFixed(2)}${unit}).`;
}

// ═══════════════════════════════════════════════════════════════════
// OBJECTIVE REGISTRY
// ═══════════════════════════════════════════════════════════════════

export class ObjectiveRegistry {
  private objectives: Map<string, PersistentObjective> = new Map();

  // ── Registration ─────────────────────────────────────────────────

  register(opts: {
    title:         string;
    statement:     string;
    category:      ObjectiveCategory;
    weight?:       number;
    ownerPillar?:  string;
    linkedPillars?: string[];
    metric: {
      name:         string;
      currentValue: number;
      targetValue:  number;
      unit:         string;
      direction:    ObjectiveMetric["direction"];
    };
  }): PersistentObjective {
    const obj: PersistentObjective = {
      objectiveId:    objectiveId(),
      title:          opts.title,
      statement:      opts.statement,
      category:       opts.category,
      status:         "ACTIVE",
      weight:         opts.weight         ?? 0.5,
      ownerPillar:    opts.ownerPillar    ?? "core",
      linkedPillars:  opts.linkedPillars  ?? [],
      metric:         { ...opts.metric, lastMeasuredAt: null },
      promptFragment: "",
      createdAt:      Date.now(),
      updatedAt:      Date.now(),
      achievedAt:     null,
    };
    obj.promptFragment = buildPromptFragment(obj);
    this.objectives.set(obj.objectiveId, obj);
    return obj;
  }

  // ── Metric updates ────────────────────────────────────────────────

  updateMetric(objectiveId: string, currentValue: number): PersistentObjective {
    const obj = this.objectives.get(objectiveId);
    if (!obj) throw new Error(`ObjectiveRegistry: '${objectiveId}' not found.`);
    obj.metric.currentValue   = currentValue;
    obj.metric.lastMeasuredAt = Date.now();
    obj.updatedAt             = Date.now();
    obj.promptFragment        = buildPromptFragment(obj);

    // Auto-achieve check
    const achieved = obj.metric.direction === "HIGHER_IS_BETTER"
      ? currentValue >= obj.metric.targetValue
      : currentValue <= obj.metric.targetValue;
    if (achieved && obj.status === "ACTIVE") {
      obj.status      = "ACHIEVED";
      obj.achievedAt  = Date.now();
    }
    this.objectives.set(objectiveId, obj);
    return obj;
  }

  // ── Status management ─────────────────────────────────────────────

  pause(objectiveId: string): void {
    const obj = this.objectives.get(objectiveId);
    if (obj) { obj.status = "PAUSED"; obj.updatedAt = Date.now(); }
  }

  resume(objectiveId: string): void {
    const obj = this.objectives.get(objectiveId);
    if (obj && obj.status === "PAUSED") { obj.status = "ACTIVE"; obj.updatedAt = Date.now(); }
  }

  deprecate(objectiveId: string): void {
    const obj = this.objectives.get(objectiveId);
    if (obj) { obj.status = "DEPRECATED"; obj.updatedAt = Date.now(); }
  }

  // ── Query ─────────────────────────────────────────────────────────

  get(objectiveId: string): PersistentObjective | null {
    return this.objectives.get(objectiveId) ?? null;
  }

  find(filter: ObjectiveFilter = {}): PersistentObjective[] {
    let results = [...this.objectives.values()];
    if (filter.category)    results = results.filter((o) => o.category    === filter.category);
    if (filter.status)      results = results.filter((o) => o.status      === filter.status);
    if (filter.ownerPillar) results = results.filter((o) => o.ownerPillar === filter.ownerPillar);
    if (filter.minWeight !== undefined) results = results.filter((o) => o.weight >= filter.minWeight!);
    return results.sort((a, b) => b.weight - a.weight);
  }

  getActive(): PersistentObjective[] {
    return this.find({ status: "ACTIVE" });
  }

  // ── System prompt generation ──────────────────────────────────────

  /**
   * Build the SOVEREIGN OBJECTIVES BLOCK.
   * This is prepended to every agent's system prompt to keep all
   * agents aligned with the Mainframe's persistent goals.
   *
   * @param pillarFilter  If provided, only include objectives owned by
   *                      or linked to this pillar.
   * @param maxObjectives Maximum objectives to include. Default: 10.
   */
  buildSystemPromptBlock(
    pillarFilter?:  string,
    maxObjectives = 10
  ): string {
    let objectives = this.getActive();

    if (pillarFilter) {
      objectives = objectives.filter(
        (o) => o.ownerPillar === pillarFilter || o.linkedPillars.includes(pillarFilter)
      );
    }

    objectives = objectives
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxObjectives);

    if (objectives.length === 0) return "";

    const lines = [
      "══ SOVEREIGN OBJECTIVES (Persistent Goals — Sovereign Mainframe) ══",
      "The following goals are active across the entire Mainframe.",
      "Every action you take must be evaluated against these objectives.",
      "Prioritise objectives by weight (highest weight = most critical).",
      "",
    ];

    for (const obj of objectives) {
      const progressPct = this._progressPercent(obj);
      const bar         = this._progressBar(progressPct);
      lines.push(`  ${bar} ${obj.promptFragment}`);
    }

    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
  }

  /**
   * Inject the Sovereign Objectives Block into a system prompt string.
   */
  injectIntoPrompt(
    systemPrompt:  string,
    pillarFilter?: string,
    maxObjectives = 10
  ): string {
    const block = this.buildSystemPromptBlock(pillarFilter, maxObjectives);
    if (!block) return systemPrompt;
    return `${block}\n\n${systemPrompt}`;
  }

  // ── Progress tracking ─────────────────────────────────────────────

  getProgress(objectiveId: string): {
    objective:   PersistentObjective;
    progressPct: number;
    gap:         number;
    onTrack:     boolean;
  } | null {
    const obj = this.objectives.get(objectiveId);
    if (!obj) return null;
    const pct  = this._progressPercent(obj);
    const gap  = Math.abs(obj.metric.targetValue - obj.metric.currentValue);
    return { objective: obj, progressPct: pct, gap, onTrack: pct >= 70 };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private _progressPercent(obj: PersistentObjective): number {
    const { currentValue, targetValue, direction } = obj.metric;
    if (targetValue === 0) return 100;
    if (direction === "HIGHER_IS_BETTER") {
      return Math.min(100, (currentValue / targetValue) * 100);
    }
    // For LOWER_IS_BETTER: progress = how far we've reduced from some start
    // Use targetValue as 100%; if below target → 100%
    return currentValue <= targetValue ? 100 : Math.min(100, (targetValue / currentValue) * 100);
  }

  private _progressBar(pct: number, width = 12): string {
    const filled = Math.round(pct / 100 * width);
    return `[${filled > 0 ? "█".repeat(filled) : ""}${"░".repeat(width - filled)}] ${pct.toFixed(0).padStart(3)}%`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT SOVEREIGN OBJECTIVES (Mainframe bootstrap)
// ═══════════════════════════════════════════════════════════════════

/**
 * Seed the ObjectiveRegistry with the three canonical Mainframe objectives:
 * Accuracy, Revenue, Velocity.
 */
export function seedSovereignObjectives(registry: ObjectiveRegistry): void {
  registry.register({
    title:         "System Accuracy",
    statement:     "Maximise the CRITIC confidence score across all agent invocations.",
    category:      "ACCURACY",
    weight:        0.90,
    ownerPillar:   "evolution-engine",
    linkedPillars: ["linguistic-forge", "wisdom-vault", "tactical-strategy"],
    metric: {
      name:         "avg_critic_confidence",
      currentValue: 0.70,
      targetValue:  0.90,
      unit:         "",
      direction:    "HIGHER_IS_BETTER",
    },
  });

  registry.register({
    title:         "Revenue Generation",
    statement:     "Increase sticker shop conversion rate and average order value.",
    category:      "REVENUE",
    weight:        0.80,
    ownerPillar:   "core",
    linkedPillars: ["taxonomy-intelligence", "linguistic-forge"],
    metric: {
      name:         "conversion_rate",
      currentValue: 0.02,
      targetValue:  0.05,
      unit:         "%",
      direction:    "HIGHER_IS_BETTER",
    },
  });

  registry.register({
    title:         "Execution Velocity",
    statement:     "Keep average end-to-end task latency below the 5 000ms budget.",
    category:      "VELOCITY",
    weight:        0.70,
    ownerPillar:   "tactical-strategy",
    linkedPillars: ["evolution-engine", "wisdom-vault"],
    metric: {
      name:         "avg_task_latency_ms",
      currentValue: 3_200,
      targetValue:  5_000,
      unit:         "ms",
      direction:    "LOWER_IS_BETTER",
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatObjective(obj: PersistentObjective): string {
  const pct = obj.metric.targetValue > 0
    ? Math.min(100, obj.metric.direction === "HIGHER_IS_BETTER"
        ? (obj.metric.currentValue / obj.metric.targetValue) * 100
        : (obj.metric.targetValue / obj.metric.currentValue) * 100
      ).toFixed(1)
    : "100.0";
  return [
    `[${obj.status.padEnd(10)}] ${obj.title.padEnd(30)} w=${obj.weight.toFixed(2)}  progress=${pct}%`,
    `  ${obj.category.padEnd(12)} owner=${obj.ownerPillar}  metric=${obj.metric.name}: ${obj.metric.currentValue}${obj.metric.unit} → ${obj.metric.targetValue}${obj.metric.unit}`,
    `  "${obj.statement}"`,
  ].join("\n");
}

export function formatObjectiveDashboard(registry: ObjectiveRegistry): string {
  const all = registry.find();
  const lines = [
    `═══ Sovereign Objectives Registry  (${all.length} objectives)  ${new Date().toISOString()}`,
    "",
  ];
  for (const obj of all) lines.push(formatObjective(obj), "");
  return lines.join("\n");
}

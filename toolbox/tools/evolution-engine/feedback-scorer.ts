/**
 * toolbox/tools/evolution-engine/feedback-scorer.ts
 * version: 1.0.0
 *
 * Pillar 17-EVO: Telemetry & Feedback Ingestion
 * Domain: Universal-Learning
 *
 * Calculates a rolling Confidence Score for each Pillar based on its
 * historical telemetry record, then triggers an Automatic Optimization
 * routine when any Pillar's score falls below the DEGRADATION_THRESHOLD
 * (default: 0.85).
 *
 * Score model:
 *   Confidence = weighted combination of:
 *     - success_rate       (successes / total)          × 0.50
 *     - inverse_abandon    (1 - abandon_rate)            × 0.25
 *     - avg_confidence     (mean CRITIC confidence)      × 0.15
 *     - latency_score      (1 - latency / latencyCap)   × 0.10
 *
 *   All factors are clipped to [0, 1].
 *   Score is therefore in [0, 1].
 *
 * Optimization trigger:
 *   When score < DEGRADATION_THRESHOLD the scorer calls the registered
 *   OptimizationHandler for that pillar.  The handler receives a full
 *   PillarDiagnostic and returns an OptimizationResult.
 *
 *   Built-in handlers:
 *     createRetryWindowHandler    — shrinks the confidence threshold so
 *                                   FIXER runs more aggressively
 *     createAlertHandler          — emits a structured log alert + optional webhook
 *     createCompositeHandler      — chains multiple handlers in order
 *
 * Pure TypeScript — no external dependencies.
 * Consumes TelemetryLogger directly.
 */

import type { TelemetryLogger, TelemetryFilter } from "./telemetry-logger.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — SCORES AND DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════

export interface PillarScore {
  pillarId:        string;
  score:           number;   // [0, 1]
  grade:           ScoreGrade;
  /** Raw factor contributions */
  factors: {
    successRate:      number;
    inverseAbandon:   number;
    avgConfidence:    number;
    latencyScore:     number;
  };
  /** Sample window used to compute this score */
  window: {
    since:   number;   // Unix ms
    total:   number;
    success: number;
    retry:   number;
    abandon: number;
  };
  computedAt: number;   // Unix ms
  /** true if this score is below the degradation threshold */
  degraded:   boolean;
}

export type ScoreGrade =
  | "OPTIMAL"    // ≥ 0.95
  | "HEALTHY"    // ≥ 0.85
  | "WARNING"    // ≥ 0.70
  | "CRITICAL"   // ≥ 0.50
  | "FAILING";   // < 0.50

export interface PillarDiagnostic {
  score:              PillarScore;
  /** Last N telemetry records for this pillar */
  recentRecords:      import("./telemetry-logger.tool.ts").TelemetryRecord[];
  /** Dominant failure mode (most common non-SUCCESS outcome) */
  dominantFailure:    "RETRY" | "ABANDON" | "none";
  /** Most problematic agentId within this pillar */
  weakestAgent:       string | null;
  /** Suggested optimization action */
  suggestion:         string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════

export interface OptimizationResult {
  pillarId:    string;
  handlerId:   string;
  action:      string;
  applied:     boolean;
  /** Any configuration change produced by this optimization */
  configDelta: Record<string, unknown>;
  triggeredAt: number;
  notes:       string;
}

export type OptimizationHandler = (
  diagnostic: PillarDiagnostic
) => Promise<OptimizationResult>;

// ═══════════════════════════════════════════════════════════════════
// SCORE WEIGHTS
// ═══════════════════════════════════════════════════════════════════

const WEIGHTS = {
  successRate:     0.50,
  inverseAbandon:  0.25,
  avgConfidence:   0.15,
  latencyScore:    0.10,
} as const;

// ═══════════════════════════════════════════════════════════════════
// GRADE LOOKUP
// ═══════════════════════════════════════════════════════════════════

function gradeScore(score: number): ScoreGrade {
  if (score >= 0.95) return "OPTIMAL";
  if (score >= 0.85) return "HEALTHY";
  if (score >= 0.70) return "WARNING";
  if (score >= 0.50) return "CRITICAL";
  return "FAILING";
}

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK SCORER
// ═══════════════════════════════════════════════════════════════════

export interface FeedbackScorerOptions {
  /** Score below which Automatic Optimization is triggered. Default: 0.85 */
  degradationThreshold?: number;
  /**
   * Rolling window in ms for score calculation.
   * Default: 24 hours (86_400_000 ms)
   */
  windowMs?: number;
  /**
   * Latency cap in ms — anything above this contributes 0 to latencyScore.
   * Default: 5 000 ms
   */
  latencyCapMs?: number;
  /**
   * Minimum number of events required before scoring a pillar.
   * Pillars with fewer events receive a neutral score of 1.0.
   * Default: 5
   */
  minEvents?: number;
  /** If true, emit score computations to console. Default: false */
  verbose?: boolean;
}

export class FeedbackScorer {
  private handlers:  Map<string, OptimizationHandler[]> = new Map();
  private scores:    Map<string, PillarScore>           = new Map();
  private opts:      Required<FeedbackScorerOptions>;

  constructor(
    private readonly logger: TelemetryLogger,
    opts: FeedbackScorerOptions = {}
  ) {
    this.opts = {
      degradationThreshold: opts.degradationThreshold ?? 0.85,
      windowMs:             opts.windowMs             ?? 86_400_000,
      latencyCapMs:         opts.latencyCapMs         ?? 5_000,
      minEvents:            opts.minEvents            ?? 5,
      verbose:              opts.verbose              ?? false,
    };
  }

  // ── Handler registration ─────────────────────────────────────────

  /**
   * Register an OptimizationHandler for a specific pillar.
   * Multiple handlers can be registered per pillar — all fire on degradation.
   */
  registerHandler(pillarId: string, handler: OptimizationHandler): void {
    const existing = this.handlers.get(pillarId) ?? [];
    this.handlers.set(pillarId, [...existing, handler]);
  }

  /**
   * Register a handler that fires for ALL pillars (wildcard).
   */
  registerGlobalHandler(handler: OptimizationHandler): void {
    this.registerHandler("*", handler);
  }

  // ── Score computation ─────────────────────────────────────────────

  /**
   * Compute the current Confidence Score for a single pillar.
   * Does NOT trigger optimization — call `evaluatePillar()` for that.
   */
  async scoreOf(pillarId: string): Promise<PillarScore> {
    const since   = Date.now() - this.opts.windowMs;
    const records = await this.logger.getHistory({ pillarId, since });

    // Insufficient data — return neutral
    if (records.length < this.opts.minEvents) {
      const neutral: PillarScore = {
        pillarId,
        score:   1.0,
        grade:   "OPTIMAL",
        factors: { successRate: 1, inverseAbandon: 1, avgConfidence: 1, latencyScore: 1 },
        window:  { since, total: records.length, success: 0, retry: 0, abandon: 0 },
        computedAt: Date.now(),
        degraded: false,
      };
      this.scores.set(pillarId, neutral);
      return neutral;
    }

    const total   = records.length;
    const success = records.filter((r) => r.outcome === "SUCCESS").length;
    const retry   = records.filter((r) => r.outcome === "RETRY").length;
    const abandon = records.filter((r) => r.outcome === "ABANDON").length;

    // Factor 1: success rate
    const successRate = success / total;

    // Factor 2: inverse abandon rate
    const inverseAbandon = 1 - abandon / total;

    // Factor 3: average confidence
    const avgConfidence = records.reduce((s, r) => s + r.confidence, 0) / total;

    // Factor 4: latency score (lower = better; above cap = 0)
    const avgLatency = records.reduce((s, r) => s + r.latencyMs, 0) / total;
    const latencyScore = Math.max(0, 1 - avgLatency / this.opts.latencyCapMs);

    const score = Math.min(1, Math.max(0,
      successRate    * WEIGHTS.successRate    +
      inverseAbandon * WEIGHTS.inverseAbandon +
      avgConfidence  * WEIGHTS.avgConfidence  +
      latencyScore   * WEIGHTS.latencyScore
    ));

    const result: PillarScore = {
      pillarId,
      score,
      grade:   gradeScore(score),
      factors: { successRate, inverseAbandon, avgConfidence, latencyScore },
      window:  { since, total, success, retry, abandon },
      computedAt: Date.now(),
      degraded: score < this.opts.degradationThreshold,
    };

    this.scores.set(pillarId, result);

    if (this.opts.verbose) {
      console.log(`[FeedbackScorer] ${pillarId}: score=${score.toFixed(4)} grade=${result.grade} degraded=${result.degraded}`);
    }

    return result;
  }

  // ── Diagnostic ───────────────────────────────────────────────────

  private async buildDiagnostic(score: PillarScore): Promise<PillarDiagnostic> {
    const records = await this.logger.getHistory({
      pillarId: score.pillarId,
      since:    score.window.since,
      limit:    50,
    });

    // Dominant failure mode
    const retryCount  = records.filter((r) => r.outcome === "RETRY").length;
    const abandonCount = records.filter((r) => r.outcome === "ABANDON").length;
    const dominantFailure: PillarDiagnostic["dominantFailure"] =
      abandonCount > retryCount ? "ABANDON" :
      retryCount   > 0         ? "RETRY"   : "none";

    // Weakest agent: most ABANDON events
    const abandonByAgent = new Map<string, number>();
    for (const r of records.filter((r) => r.outcome !== "SUCCESS")) {
      abandonByAgent.set(r.agentId, (abandonByAgent.get(r.agentId) ?? 0) + 1);
    }
    const weakestAgent = abandonByAgent.size > 0
      ? [...abandonByAgent.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // Suggestion
    const suggestion =
      dominantFailure === "ABANDON"
        ? `Agent '${weakestAgent ?? "unknown"}' is abandoning frequently — consider lowering maxConsecutiveErrors or increasing backOffMaxMs.`
        : dominantFailure === "RETRY"
        ? `High retry rate in pillar '${score.pillarId}' — consider reducing hallucinationThreshold or increasing FIXER capability.`
        : `Latency is the primary drag — avg latency affecting score. Review tick interval or external API timeouts.`;

    return {
      score,
      recentRecords:   records.slice(0, 20),
      dominantFailure,
      weakestAgent,
      suggestion,
    };
  }

  // ── Evaluation + automatic optimization ──────────────────────────

  /**
   * Score a pillar and, if degraded, fire all registered optimization handlers.
   *
   * @returns The score + any optimization results produced
   */
  async evaluatePillar(pillarId: string): Promise<{
    score:         PillarScore;
    optimizations: OptimizationResult[];
  }> {
    const score = await this.scoreOf(pillarId);

    if (!score.degraded) {
      return { score, optimizations: [] };
    }

    const diagnostic = await this.buildDiagnostic(score);

    // Collect handlers: pillar-specific + global wildcard
    const specific = this.handlers.get(pillarId)  ?? [];
    const global   = this.handlers.get("*")        ?? [];
    const allHandlers = [...specific, ...global];

    if (allHandlers.length === 0) {
      console.warn(`[FeedbackScorer] Pillar '${pillarId}' is degraded (score=${score.score.toFixed(4)}) but no optimization handlers are registered.`);
      return { score, optimizations: [] };
    }

    const optimizations: OptimizationResult[] = await Promise.all(
      allHandlers.map((h) =>
        h(diagnostic).catch((err): OptimizationResult => ({
          pillarId,
          handlerId:   "unknown",
          action:      "handler-error",
          applied:     false,
          configDelta: {},
          triggeredAt: Date.now(),
          notes:       String(err),
        }))
      )
    );

    return { score, optimizations };
  }

  /**
   * Evaluate ALL pillars that have telemetry in the current window.
   * Returns a full report sorted by score ascending (worst first).
   */
  async evaluateAll(pillarIds: string[]): Promise<ScoreboardReport> {
    const results = await Promise.all(
      pillarIds.map((id) => this.evaluatePillar(id))
    );

    const entries = results.map((r) => ({
      pillarId:      r.score.pillarId,
      score:         r.score.score,
      grade:         r.score.grade,
      degraded:      r.score.degraded,
      optimizations: r.optimizations.length,
    })).sort((a, b) => a.score - b.score);

    const degradedCount = entries.filter((e) => e.degraded).length;

    return {
      evaluatedAt:   Date.now(),
      totalPillars:  pillarIds.length,
      degraded:      degradedCount,
      healthy:       pillarIds.length - degradedCount,
      entries,
      allScores:     results.map((r) => r.score),
      allOptimizations: results.flatMap((r) => r.optimizations),
    };
  }

  /** Return the cached score for a pillar without re-querying telemetry */
  getCachedScore(pillarId: string): PillarScore | null {
    return this.scores.get(pillarId) ?? null;
  }

  /** Return all cached scores */
  getAllCachedScores(): PillarScore[] {
    return [...this.scores.values()];
  }
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — SCOREBOARD REPORT
// ═══════════════════════════════════════════════════════════════════

export interface ScoreboardEntry {
  pillarId:      string;
  score:         number;
  grade:         ScoreGrade;
  degraded:      boolean;
  optimizations: number;
}

export interface ScoreboardReport {
  evaluatedAt:      number;
  totalPillars:     number;
  degraded:         number;
  healthy:          number;
  entries:          ScoreboardEntry[];
  allScores:        PillarScore[];
  allOptimizations: OptimizationResult[];
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN OPTIMIZATION HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Retry-window handler.
 * When a pillar degrades, lowers the Trinity hallucinationThreshold
 * to make FIXER run more aggressively on future invocations.
 *
 * Returns a configDelta that the caller should apply to their
 * TrinityOptions configuration store.
 */
export function createRetryWindowHandler(
  configStore: Map<string, Record<string, unknown>>,
  thresholdStep: number = 0.05
): OptimizationHandler {
  return async (diag: PillarDiagnostic): Promise<OptimizationResult> => {
    const pillarId = diag.score.pillarId;
    const current  = configStore.get(pillarId) ?? {};
    const oldThresh = (current["hallucinationThreshold"] as number) ?? 0.95;
    const newThresh = Math.max(0.50, oldThresh - thresholdStep);
    const delta     = { hallucinationThreshold: newThresh };

    configStore.set(pillarId, { ...current, ...delta });

    return {
      pillarId,
      handlerId:   "retry-window-handler",
      action:      `Lowered hallucinationThreshold: ${oldThresh.toFixed(3)} → ${newThresh.toFixed(3)}`,
      applied:     true,
      configDelta: delta,
      triggeredAt: Date.now(),
      notes:       `Score was ${diag.score.score.toFixed(4)} — dominant failure: ${diag.dominantFailure}. Weakest agent: ${diag.weakestAgent ?? "unknown"}.`,
    };
  };
}

/**
 * Alert handler.
 * Emits a structured console alert and optionally POSTs to a webhook URL.
 */
export function createAlertHandler(webhookUrl?: string): OptimizationHandler {
  return async (diag: PillarDiagnostic): Promise<OptimizationResult> => {
    const msg = [
      `[AUTO-OPT ALERT] Pillar '${diag.score.pillarId}' degraded.`,
      `  Score: ${diag.score.score.toFixed(4)} (${diag.score.grade})`,
      `  Failure: ${diag.dominantFailure}  Weakest agent: ${diag.weakestAgent ?? "—"}`,
      `  Suggestion: ${diag.suggestion}`,
    ].join("\n");

    console.warn(msg);

    let webhookFired = false;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            pillarId:    diag.score.pillarId,
            score:       diag.score.score,
            grade:       diag.score.grade,
            suggestion:  diag.suggestion,
            triggeredAt: Date.now(),
          }),
          signal: AbortSignal.timeout(5_000),
        });
        webhookFired = true;
      } catch (err) {
        console.error("[AlertHandler] Webhook POST failed:", err);
      }
    }

    return {
      pillarId:    diag.score.pillarId,
      handlerId:   "alert-handler",
      action:      `Alert emitted${webhookFired ? " + webhook fired" : ""}`,
      applied:     true,
      configDelta: {},
      triggeredAt: Date.now(),
      notes:       msg,
    };
  };
}

/**
 * Composite handler — runs multiple handlers in sequence.
 * If any handler fails, the error is caught, logged, and the next runs.
 */
export function createCompositeHandler(...handlers: OptimizationHandler[]): OptimizationHandler {
  return async (diag: PillarDiagnostic): Promise<OptimizationResult> => {
    const results: OptimizationResult[] = [];
    for (const h of handlers) {
      try {
        results.push(await h(diag));
      } catch (err) {
        console.error("[CompositeHandler] Sub-handler failed:", err);
      }
    }
    const applied = results.filter((r) => r.applied).length;
    return {
      pillarId:    diag.score.pillarId,
      handlerId:   "composite-handler",
      action:      `Ran ${handlers.length} handlers; ${applied} applied.`,
      applied:     applied > 0,
      configDelta: Object.assign({}, ...results.map((r) => r.configDelta)),
      triggeredAt: Date.now(),
      notes:       results.map((r) => r.action).join(" | "),
    };
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

const GRADE_ICON: Record<ScoreGrade, string> = {
  OPTIMAL:  "✦",
  HEALTHY:  "●",
  WARNING:  "◑",
  CRITICAL: "◐",
  FAILING:  "○",
};

/**
 * Format a ScoreboardReport as a compact ASCII scoreboard.
 */
export function formatScoreboard(report: ScoreboardReport): string {
  const lines: string[] = [
    `═══ Pillar Confidence Scoreboard ═══  ${new Date(report.evaluatedAt).toISOString()}`,
    `Pillars: ${report.totalPillars}  |  Healthy: ${report.healthy}  |  Degraded: ${report.degraded}`,
    "",
  ];
  for (const e of report.entries) {
    const icon  = GRADE_ICON[e.grade];
    const bar   = scoreBar(e.score);
    const opt   = e.optimizations > 0 ? `  ⚡${e.optimizations} opt` : "";
    const deg   = e.degraded ? "  ⚠ AUTO-OPT TRIGGERED" : "";
    lines.push(`  ${icon} ${e.pillarId.padEnd(30)} ${bar}  ${(e.score * 100).toFixed(1).padStart(5)}%  ${e.grade.padEnd(8)}${opt}${deg}`);
  }
  return lines.join("\n");
}

function scoreBar(score: number, width = 20): string {
  const filled = Math.round(score * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

/**
 * Format a single PillarScore as a detailed breakdown.
 */
export function formatPillarScore(s: PillarScore): string {
  return [
    `Pillar: ${s.pillarId}  Score: ${(s.score * 100).toFixed(2)}%  Grade: ${s.grade}  Degraded: ${s.degraded}`,
    `  Factors:  successRate=${(s.factors.successRate * 100).toFixed(1)}%  ` +
    `inverseAbandon=${(s.factors.inverseAbandon * 100).toFixed(1)}%  ` +
    `avgConfidence=${(s.factors.avgConfidence * 100).toFixed(1)}%  ` +
    `latencyScore=${(s.factors.latencyScore * 100).toFixed(1)}%`,
    `  Window:   total=${s.window.total}  success=${s.window.success}  retry=${s.window.retry}  abandon=${s.window.abandon}`,
  ].join("\n");
}

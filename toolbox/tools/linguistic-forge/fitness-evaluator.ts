/**
 * toolbox/tools/linguistic-forge/fitness-evaluator.ts
 * version: 1.0.0
 *
 * Pillar 23: Prompt Mutation System
 * Domain: Linguistic-Evolution
 *
 * Runs A/B test simulations to compare prompt variants, then
 * automatically updates the ACTIVE entry in the PromptArchive
 * with the winner.
 *
 * Three evaluation modes:
 *
 *   SIMULATED   — calls a user-supplied RunFn for each prompt variant,
 *                 collects outcome signals + latency, scores via the
 *                 same weighted model as FeedbackScorer (Pillar 17-EVO)
 *
 *   SHADOW      — sends live traffic to both prompts simultaneously,
 *                 uses real TelemetryLogger records for scoring.
 *                 The current ACTIVE prompt serves user requests; the
 *                 CANDIDATE runs in shadow (output discarded).
 *
 *   SEQUENTIAL  — runs N rounds against the control prompt, then N rounds
 *                 against the challenger, compares statistics.
 *
 * After evaluation:
 *   - Winner is set ACTIVE in the PromptArchive
 *   - Loser is set ARCHIVED
 *   - An ABTestReport is returned for audit / logging
 *
 * The manifest is the PromptArchive itself — "updating the manifest"
 * means calling archive.applyABResult(winnerId, loserId).
 *
 * Pure TypeScript — no external dependencies.
 */

import type { PromptRecord } from "./prompt-archive.ts";
import type { PromptArchive } from "./prompt-archive.ts";
import type { TelemetryLogger } from "../evolution-engine/telemetry-logger.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type EvaluationMode = "SIMULATED" | "SHADOW" | "SEQUENTIAL";

export type RunOutcome = "SUCCESS" | "RETRY" | "ABANDON";

export interface RunResult {
  latencyMs:  number;
  outcome:    RunOutcome;
  confidence: number;
  /** Optional: the raw output produced by the prompt */
  output?:    unknown;
}

/**
 * A function that executes a prompt template and returns a RunResult.
 * Inject a real LLM call, a mock, or a benchmark harness.
 */
export type RunFn = (
  promptTemplate: string,
  input:          unknown
) => Promise<RunResult>;

export interface ABTestConfig {
  /** The current best prompt (control) */
  control:    PromptRecord;
  /** The challenger prompt to test against control */
  challenger: PromptRecord;
  mode:       EvaluationMode;
  /**
   * Number of simulated runs per arm.
   * For SIMULATED / SEQUENTIAL. Default: 10
   */
  runsPerArm?: number;
  /**
   * Minimum confidence delta required for challenger to win.
   * If challenger score − control score < minDelta, control retains ACTIVE.
   * Default: 0.02 (challenger must be at least 2 percentage points better)
   */
  minDelta?: number;
  /** Test inputs to iterate over (SIMULATED / SEQUENTIAL modes) */
  testInputs?: unknown[];
  /** Pillar ID for telemetry logging */
  pillarId?:  string;
}

export interface ArmStats {
  promptId:    string;
  promptName:  string;
  runs:        number;
  successes:   number;
  retries:     number;
  abandons:    number;
  avgLatencyMs: number;
  avgConfidence: number;
  score:       number;
}

export interface ABTestReport {
  testId:      string;
  mode:        EvaluationMode;
  startedAt:   number;
  completedAt: number;
  control:     ArmStats;
  challenger:  ArmStats;
  winner:      "CONTROL" | "CHALLENGER" | "TIE";
  winnerId:    string;
  loserId:     string;
  scoreDelta:  number;
  applied:     boolean;   // true if archive was updated
  notes:       string;
}

// ═══════════════════════════════════════════════════════════════════
// SCORE CALCULATION  (same model as FeedbackScorer)
// ═══════════════════════════════════════════════════════════════════

const WEIGHTS = {
  successRate:    0.50,
  inverseAbandon: 0.25,
  avgConfidence:  0.15,
  latencyScore:   0.10,
} as const;

const LATENCY_CAP_MS = 5_000;

function computeScore(results: RunResult[]): number {
  const n = results.length;
  if (n === 0) return 0;

  const successes   = results.filter((r) => r.outcome === "SUCCESS").length;
  const abandons    = results.filter((r) => r.outcome === "ABANDON").length;
  const avgConf     = results.reduce((s, r) => s + r.confidence, 0) / n;
  const avgLatency  = results.reduce((s, r) => s + r.latencyMs, 0) / n;

  return Math.min(1, Math.max(0,
    (successes / n)                                    * WEIGHTS.successRate    +
    (1 - abandons / n)                                 * WEIGHTS.inverseAbandon +
    avgConf                                            * WEIGHTS.avgConfidence  +
    Math.max(0, 1 - avgLatency / LATENCY_CAP_MS)      * WEIGHTS.latencyScore
  ));
}

function buildArmStats(prompt: PromptRecord, results: RunResult[]): ArmStats {
  const n = results.length;
  return {
    promptId:     prompt.promptId,
    promptName:   prompt.name,
    runs:         n,
    successes:    results.filter((r) => r.outcome === "SUCCESS").length,
    retries:      results.filter((r) => r.outcome === "RETRY").length,
    abandons:     results.filter((r) => r.outcome === "ABANDON").length,
    avgLatencyMs: n > 0 ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / n) : 0,
    avgConfidence: n > 0 ? results.reduce((s, r) => s + r.confidence, 0) / n : 0,
    score:        computeScore(results),
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _testSeq = 0;
function nextTestId(): string {
  return `abt_${Date.now().toString(36)}_${(++_testSeq).toString(36).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════
// FITNESS EVALUATOR
// ═══════════════════════════════════════════════════════════════════

export interface FitnessEvaluatorOptions {
  archive:    PromptArchive;
  logger?:    TelemetryLogger;
  /** Default RunFn used when none is provided per-test */
  defaultRunFn?: RunFn;
  /** Default number of runs per arm. Default: 10 */
  defaultRunsPerArm?: number;
  /** Default minimum score delta for challenger to win. Default: 0.02 */
  defaultMinDelta?: number;
  verbose?: boolean;
}

export class FitnessEvaluator {
  private archive:    PromptArchive;
  private logger?:    TelemetryLogger;
  private defaultRun?: RunFn;
  private defaultRuns: number;
  private defaultDelta: number;
  private verbose:    boolean;
  private history:    ABTestReport[] = [];

  constructor(opts: FitnessEvaluatorOptions) {
    this.archive      = opts.archive;
    this.logger       = opts.logger;
    this.defaultRun   = opts.defaultRunFn;
    this.defaultRuns  = opts.defaultRunsPerArm  ?? 10;
    this.defaultDelta = opts.defaultMinDelta     ?? 0.02;
    this.verbose      = opts.verbose             ?? false;
  }

  // ── Public entry point ────────────────────────────────────────────

  /**
   * Run an A/B test and update the archive with the winner.
   */
  async evaluate(
    config: ABTestConfig,
    runFn?: RunFn
  ): Promise<ABTestReport> {
    const fn = runFn ?? this.defaultRun;
    if (!fn) throw new Error("FitnessEvaluator: no RunFn provided.");

    const report = await this._run(config, fn);
    this.history.push(report);

    if (this.verbose) {
      console.log(`[FitnessEvaluator] Test ${report.testId}  winner=${report.winner}  delta=${report.scoreDelta.toFixed(4)}`);
    }

    return report;
  }

  /** Run multiple tests in parallel. */
  async evaluateBatch(
    configs: ABTestConfig[],
    runFn?: RunFn
  ): Promise<ABTestReport[]> {
    return Promise.all(configs.map((c) => this.evaluate(c, runFn)));
  }

  /** Return all stored test reports. */
  getHistory(): ABTestReport[] {
    return [...this.history];
  }

  /** Return the most recent report for a given pillar. */
  getLatestForPillar(pillarId: string): ABTestReport | null {
    const relevant = this.history.filter(
      (r) =>
        this.history.some((h) => h.control.promptId) &&
        (r.control.promptId.includes(pillarId) || r.challenger.promptId.includes(pillarId))
    );
    return relevant[relevant.length - 1] ?? null;
  }

  // ── Mode dispatch ─────────────────────────────────────────────────

  private async _run(config: ABTestConfig, runFn: RunFn): Promise<ABTestReport> {
    switch (config.mode) {
      case "SIMULATED":  return this._runSimulated(config, runFn);
      case "SEQUENTIAL": return this._runSequential(config, runFn);
      case "SHADOW":     return this._runShadow(config, runFn);
    }
  }

  // ── SIMULATED mode ────────────────────────────────────────────────

  private async _runSimulated(config: ABTestConfig, runFn: RunFn): Promise<ABTestReport> {
    const startedAt   = Date.now();
    const runsPerArm  = config.runsPerArm ?? this.defaultRuns;
    const inputs      = config.testInputs?.length
      ? config.testInputs
      : Array.from({ length: runsPerArm }, (_, i) => ({ run: i }));

    // Run both arms concurrently — interleave to reduce order bias
    const controlResults:    RunResult[] = [];
    const challengerResults: RunResult[] = [];

    await Promise.all(
      inputs.map(async (input) => {
        const [ctrlRes, chalRes] = await Promise.all([
          runFn(config.control.template,    input),
          runFn(config.challenger.template, input),
        ]);
        controlResults.push(ctrlRes);
        challengerResults.push(chalRes);

        // Log to telemetry if logger is available
        if (this.logger && config.pillarId) {
          await Promise.all([
            this.logger.log(
              config.control.promptId,    config.pillarId ?? "unknown",
              input, ctrlRes.output, ctrlRes.latencyMs, ctrlRes.outcome,
              { confidence: ctrlRes.confidence, tags: ["ab-test", "control"] }
            ),
            this.logger.log(
              config.challenger.promptId, config.pillarId ?? "unknown",
              input, chalRes.output, chalRes.latencyMs, chalRes.outcome,
              { confidence: chalRes.confidence, tags: ["ab-test", "challenger"] }
            ),
          ]);
        }
      })
    );

    return this._buildReport(config, startedAt, controlResults, challengerResults);
  }

  // ── SEQUENTIAL mode ───────────────────────────────────────────────

  private async _runSequential(config: ABTestConfig, runFn: RunFn): Promise<ABTestReport> {
    const startedAt   = Date.now();
    const runsPerArm  = config.runsPerArm ?? this.defaultRuns;
    const inputs      = config.testInputs?.length
      ? config.testInputs
      : Array.from({ length: runsPerArm }, (_, i) => ({ run: i }));

    const controlResults:    RunResult[] = [];
    const challengerResults: RunResult[] = [];

    // Control arm first
    for (const input of inputs) {
      controlResults.push(await runFn(config.control.template, input));
    }
    // Challenger arm second
    for (const input of inputs) {
      challengerResults.push(await runFn(config.challenger.template, input));
    }

    return this._buildReport(config, startedAt, controlResults, challengerResults);
  }

  // ── SHADOW mode ───────────────────────────────────────────────────

  /**
   * Shadow mode: runs control synchronously (serving real traffic),
   * runs challenger in the background (output discarded).
   * In shadow mode, both arms receive the same inputs — call this
   * repeatedly from your request handler.
   */
  private async _runShadow(config: ABTestConfig, runFn: RunFn): Promise<ABTestReport> {
    const startedAt   = Date.now();
    const runsPerArm  = config.runsPerArm ?? this.defaultRuns;
    const inputs      = config.testInputs?.length
      ? config.testInputs
      : Array.from({ length: runsPerArm }, (_, i) => ({ run: i }));

    const controlResults:    RunResult[] = [];
    const challengerResults: RunResult[] = [];

    for (const input of inputs) {
      // Control blocks; challenger fires in background
      const ctrlResult = await runFn(config.control.template, input);
      controlResults.push(ctrlResult);

      // Shadow — fire and forget
      runFn(config.challenger.template, input)
        .then((r) => challengerResults.push(r))
        .catch(() => challengerResults.push({ latencyMs: 0, outcome: "ABANDON", confidence: 0 }));
    }

    // Wait briefly for shadow runs to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    return this._buildReport(config, startedAt, controlResults, challengerResults);
  }

  // ── Report builder + archive update ──────────────────────────────

  private async _buildReport(
    config:             ABTestConfig,
    startedAt:          number,
    controlResults:     RunResult[],
    challengerResults:  RunResult[]
  ): Promise<ABTestReport> {
    const ctrlStats  = buildArmStats(config.control,    controlResults);
    const chalStats  = buildArmStats(config.challenger, challengerResults);
    const minDelta   = config.minDelta ?? this.defaultDelta;
    const scoreDelta = chalStats.score - ctrlStats.score;

    let winner:   "CONTROL" | "CHALLENGER" | "TIE";
    let winnerId: string;
    let loserId:  string;
    let notes:    string;

    if (Math.abs(scoreDelta) < minDelta) {
      winner   = "TIE";
      winnerId = config.control.promptId;   // retain current active on tie
      loserId  = config.challenger.promptId;
      notes    = `Score delta ${scoreDelta.toFixed(4)} below minDelta ${minDelta}. Control retained.`;
    } else if (scoreDelta > 0) {
      winner   = "CHALLENGER";
      winnerId = config.challenger.promptId;
      loserId  = config.control.promptId;
      notes    = `Challenger wins by ${scoreDelta.toFixed(4)} points. Promoted to ACTIVE.`;
    } else {
      winner   = "CONTROL";
      winnerId = config.control.promptId;
      loserId  = config.challenger.promptId;
      notes    = `Control wins by ${(-scoreDelta).toFixed(4)} points. Challenger archived.`;
    }

    // Update fitness scores in archive
    await Promise.all([
      this.archive.updateFitness(config.control.promptId, {
        score:         ctrlStats.score,
        invocations:   ctrlStats.runs,
        successCount:  ctrlStats.successes,
        retryCount:    ctrlStats.retries,
        abandonCount:  ctrlStats.abandons,
        avgLatencyMs:  ctrlStats.avgLatencyMs,
        avgConfidence: ctrlStats.avgConfidence,
      }),
      this.archive.updateFitness(config.challenger.promptId, {
        score:         chalStats.score,
        invocations:   chalStats.runs,
        successCount:  chalStats.successes,
        retryCount:    chalStats.retries,
        abandonCount:  chalStats.abandons,
        avgLatencyMs:  chalStats.avgLatencyMs,
        avgConfidence: chalStats.avgConfidence,
      }),
    ]);

    // Apply to archive (promote winner, archive loser) — only if not a tie
    let applied = false;
    if (winner !== "TIE") {
      await this.archive.applyABResult(winnerId, loserId);
      applied = true;
    }

    const report: ABTestReport = {
      testId:      nextTestId(),
      mode:        config.mode,
      startedAt,
      completedAt: Date.now(),
      control:     ctrlStats,
      challenger:  chalStats,
      winner,
      winnerId,
      loserId,
      scoreDelta,
      applied,
      notes,
    };

    if (this.verbose) {
      console.log(formatABReport(report));
    }

    return report;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN RUN FUNCTION FACTORIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Stochastic mock RunFn — simulates realistic agent outcomes.
 * Useful for unit tests and NAS dry-runs without a live LLM.
 *
 * @param successRate    Probability of SUCCESS outcome [0, 1]
 * @param avgLatencyMs   Mean simulated latency
 * @param latencyJitter  ± jitter around mean latency
 */
export function createMockRunFn(
  successRate  = 0.80,
  avgLatencyMs = 1_200,
  latencyJitter = 400
): RunFn {
  return async (_template: string, _input: unknown): Promise<RunResult> => {
    const latencyMs  = Math.max(50, avgLatencyMs + (Math.random() - 0.5) * 2 * latencyJitter);
    const rand       = Math.random();
    const outcome: RunOutcome =
      rand < successRate      ? "SUCCESS" :
      rand < successRate + 0.15 ? "RETRY"  : "ABANDON";
    const confidence = outcome === "SUCCESS"
      ? 0.75 + Math.random() * 0.25
      : Math.random() * 0.5;
    return { latencyMs: Math.round(latencyMs), outcome, confidence };
  };
}

/**
 * LLM-based RunFn factory.
 * Sends the prompt to an OpenAI-compatible API and infers the
 * outcome from the response quality heuristic (length + coherence).
 */
export function createLlmRunFn(opts: {
  apiKey:   string;
  model?:   string;
  baseUrl?: string;
  /** Min response length (chars) to count as SUCCESS. Default: 50 */
  minResponseLength?: number;
}): RunFn {
  const model   = opts.model   ?? "gpt-4o-mini";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  const minLen  = opts.minResponseLength ?? 50;

  return async (template: string, input: unknown): Promise<RunResult> => {
    const t0 = Date.now();
    try {
      const userContent = typeof input === "string"
        ? input
        : JSON.stringify(input);

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${opts.apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: template },
            { role: "user",   content: userContent },
          ],
          temperature: 0.5,
          max_tokens:  512,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const data   = await resp.json() as { choices: { message: { content: string } }[] };
      const output = data.choices[0]?.message?.content?.trim() ?? "";
      const len    = output.length;

      const outcome: RunOutcome = len >= minLen ? "SUCCESS" : "RETRY";
      const confidence = Math.min(1, 0.5 + (len / (minLen * 4)) * 0.5);

      return { latencyMs: Date.now() - t0, outcome, confidence, output };
    } catch {
      return { latencyMs: Date.now() - t0, outcome: "ABANDON", confidence: 0 };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

function armLine(label: string, s: ArmStats, winner: "CONTROL" | "CHALLENGER" | "TIE"): string {
  const isWinner = (label === "Control" && winner === "CONTROL") ||
                   (label === "Challenger" && winner === "CHALLENGER");
  const flag = isWinner ? "  ← WINNER" : "";
  return [
    `  ${label.padEnd(12)} score=${(s.score * 100).toFixed(2)}%  ` +
    `success=${s.successes}/${s.runs}  abandon=${s.abandons}  ` +
    `avgLat=${s.avgLatencyMs}ms  avgConf=${s.avgConfidence.toFixed(3)}${flag}`,
  ].join("");
}

export function formatABReport(r: ABTestReport): string {
  return [
    `═══ A/B Test Report  [${r.testId}]  mode=${r.mode}  duration=${r.completedAt - r.startedAt}ms`,
    armLine("Control",    r.control,    r.winner),
    armLine("Challenger", r.challenger, r.winner),
    `  Result: ${r.winner}  delta=${r.scoreDelta >= 0 ? "+" : ""}${(r.scoreDelta * 100).toFixed(2)}%  applied=${r.applied}`,
    `  Notes: ${r.notes}`,
  ].join("\n");
}

export function formatTestHistory(reports: ABTestReport[]): string {
  if (reports.length === 0) return "No A/B tests recorded.";
  return reports.map((r) => [
    `[${r.testId}] ${r.mode.padEnd(11)} ${r.winner.padEnd(11)} delta=${(r.scoreDelta >= 0 ? "+" : "") + (r.scoreDelta * 100).toFixed(2)}%  ctrl=${(r.control.score * 100).toFixed(1)}%  chal=${(r.challenger.score * 100).toFixed(1)}%  applied=${r.applied}`,
  ]).join("\n");
}

/**
 * toolbox/tools/meta-governance/shadow-test-harness.ts
 * version: 1.0.0
 *
 * Pillar 32-B: Shadow Test Harness
 * Domain: APEX-GOVERNANCE
 *
 * Runs an experimental 'B' strategy in parallel ("shadow mode") with
 * the production 'A' strategy. The production output is ALWAYS returned
 * to the caller — the B result is captured, scored, and stored for
 * offline analysis without touching the live system.
 *
 * Design guarantees:
 *   1. Zero impact on production latency — B runs fire-and-forget
 *      (unless captureMode = "AWAIT" for test environments).
 *   2. No B result ever reaches the caller unless explicitly requested.
 *   3. Full outcome comparison stored in ShadowResults for later diff.
 *
 * Typical use-cases:
 *   - A/B prompt variant testing (Pillar 23 + 28)
 *   - Tool-path comparison (Pillar 24)
 *   - Config canary releases (IVC Pillar 32-A)
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type CaptureMode = "FIRE_AND_FORGET" | "AWAIT";
export type WinnerDecision = "A_WINS" | "B_WINS" | "TIE" | "UNDECIDED";

/** A strategy is any async function that produces a result + metrics. */
export type StrategyFn<I, O> = (input: I) => Promise<{
  output:       O;
  confidence:   number;    // [0, 1]
  latencyMs:    number;
  tokens?:      number;
  cost?:        number;
  metadata?:    Record<string, unknown>;
}>;

export interface ShadowResult<I, O> {
  shadowId:      string;
  pillarId:      string;
  experimentId:  string;
  input:         I;
  /** Production result (always complete) */
  aResult: {
    output:      O;
    confidence:  number;
    latencyMs:   number;
    tokens?:     number;
    cost?:       number;
    metadata?:   Record<string, unknown>;
    error?:      string;
  };
  /** Shadow result (may be null if B errored and FIRE_AND_FORGET) */
  bResult: {
    output:      O;
    confidence:  number;
    latencyMs:   number;
    tokens?:     number;
    cost?:       number;
    metadata?:   Record<string, unknown>;
    error?:      string;
  } | null;
  winner:        WinnerDecision;
  scoreDelta:    number;   // bScore - aScore; positive = B is better
  capturedAt:    number;
  captureMode:   CaptureMode;
  tags:          string[];
}

export interface ShadowExperiment {
  experimentId:  string;
  pillarId:      string;
  label:         string;
  description:   string;
  aVariantId:    string;
  bVariantId:    string;
  captureMode:   CaptureMode;
  /** Fraction of traffic to shadow [0, 1]. Default: 1.0 (shadow all) */
  shadowFraction: number;
  status:        "ACTIVE" | "PAUSED" | "CONCLUDED";
  results:       ShadowResult<unknown, unknown>[];
  summary?: {
    totalRuns:    number;
    aWins:        number;
    bWins:        number;
    ties:         number;
    avgScoreDelta: number;
    winnerDecision: WinnerDecision;
    concludedAt?: number;
  };
  createdAt:     number;
}

// ═══════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════

interface ScoringWeights {
  confidence?: number;  // default 0.60
  latency?:    number;  // default 0.25 (lower = better)
  cost?:       number;  // default 0.15 (lower = better)
}

function scoreResult(
  result: { confidence: number; latencyMs: number; cost?: number },
  weights: ScoringWeights = {},
  baselines: { maxLatency?: number; maxCost?: number } = {}
): number {
  const wConf = weights.confidence ?? 0.60;
  const wLat  = weights.latency    ?? 0.25;
  const wCost = weights.cost       ?? 0.15;

  const maxLat  = baselines.maxLatency ?? 10_000;
  const maxCost = baselines.maxCost    ?? 1.0;

  const latScore  = Math.max(0, 1 - result.latencyMs / maxLat);
  const costScore = Math.max(0, 1 - (result.cost ?? 0) / maxCost);

  return wConf * result.confidence + wLat * latScore + wCost * costScore;
}

function decideWinner(scoreDelta: number, threshold = 0.02): WinnerDecision {
  if (Math.abs(scoreDelta) < threshold) return "TIE";
  return scoreDelta > 0 ? "B_WINS" : "A_WINS";
}

// ═══════════════════════════════════════════════════════════════════
// SHADOW TEST HARNESS
// ═══════════════════════════════════════════════════════════════════

let _shadowSeq = 0;
let _expSeq    = 0;
function shadowId(): string { return `sh_${Date.now().toString(36)}_${(++_shadowSeq).toString(36).padStart(4, "0")}`; }
function expId():    string { return `exp_${Date.now().toString(36)}_${(++_expSeq).toString(36).padStart(4, "0")}`; }

export interface ShadowHarnessOptions {
  /** Score weighting for winner determination */
  scoringWeights?: ScoringWeights;
  /** Latency above which a B error is ignored silently */
  bTimeoutMs?: number;
  /** Win threshold — min score delta to declare B_WINS or A_WINS. Default: 0.02 */
  winThreshold?: number;
  verbose?: boolean;
  /** Called after every shadow run with the captured result */
  onCapture?: (result: ShadowResult<unknown, unknown>) => void | Promise<void>;
}

export class ShadowTestHarness {
  private experiments: Map<string, ShadowExperiment> = new Map();
  private opts: Required<Omit<ShadowHarnessOptions, "onCapture">> & { onCapture?: ShadowHarnessOptions["onCapture"] };

  constructor(opts: ShadowHarnessOptions = {}) {
    this.opts = {
      scoringWeights: opts.scoringWeights ?? {},
      bTimeoutMs:     opts.bTimeoutMs     ?? 15_000,
      winThreshold:   opts.winThreshold   ?? 0.02,
      verbose:        opts.verbose        ?? false,
      onCapture:      opts.onCapture,
    };
  }

  // ── Experiment management ─────────────────────────────────────────

  createExperiment(opts: {
    pillarId:       string;
    label:          string;
    description?:   string;
    aVariantId:     string;
    bVariantId:     string;
    captureMode?:   CaptureMode;
    shadowFraction?: number;
  }): ShadowExperiment {
    const exp: ShadowExperiment = {
      experimentId:   expId(),
      pillarId:       opts.pillarId,
      label:          opts.label,
      description:    opts.description    ?? "",
      aVariantId:     opts.aVariantId,
      bVariantId:     opts.bVariantId,
      captureMode:    opts.captureMode    ?? "FIRE_AND_FORGET",
      shadowFraction: opts.shadowFraction ?? 1.0,
      status:         "ACTIVE",
      results:        [],
      createdAt:      Date.now(),
    };
    this.experiments.set(exp.experimentId, exp);
    return exp;
  }

  pauseExperiment(experimentId: string):  void { const e = this.experiments.get(experimentId); if (e) e.status = "PAUSED"; }
  resumeExperiment(experimentId: string): void { const e = this.experiments.get(experimentId); if (e && e.status === "PAUSED") e.status = "ACTIVE"; }

  // ── Shadow run ────────────────────────────────────────────────────

  /**
   * Run A and B strategies.
   * - A is always awaited; its output is returned immediately.
   * - B runs in shadow mode — FIRE_AND_FORGET or AWAIT per experiment config.
   * - The ShadowResult is stored and the onCapture callback is invoked.
   *
   * @returns The production (A) output — B never affects the return value.
   */
  async run<I, O>(
    experimentId: string,
    input:        I,
    strategyA:    StrategyFn<I, O>,
    strategyB:    StrategyFn<I, O>,
    tags:         string[] = []
  ): Promise<O> {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== "ACTIVE") {
      // Experiment inactive — fall through to A only
      const result = await strategyA(input);
      return result.output;
    }

    // Sample check — only shadow a fraction of traffic
    if (Math.random() > exp.shadowFraction) {
      return (await strategyA(input)).output;
    }

    // Always run A — production path
    const aStart  = Date.now();
    let aResult: ShadowResult<I, O>["aResult"];
    let aOutput!: O;

    try {
      const a = await strategyA(input);
      aOutput = a.output;
      aResult = { output: a.output, confidence: a.confidence, latencyMs: Date.now() - aStart, tokens: a.tokens, cost: a.cost, metadata: a.metadata };
    } catch (err) {
      aResult = { output: null as unknown as O, confidence: 0, latencyMs: Date.now() - aStart, error: String(err) };
    }

    // Shadow B — fire-and-forget or await
    const runB = async (): Promise<ShadowResult<I, O>["bResult"]> => {
      const bStart = Date.now();
      try {
        const b = await Promise.race([
          strategyB(input),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("B_TIMEOUT")), this.opts.bTimeoutMs)),
        ]);
        return { output: b.output, confidence: b.confidence, latencyMs: Date.now() - bStart, tokens: b.tokens, cost: b.cost, metadata: b.metadata };
      } catch (err) {
        return { output: null as unknown as O, confidence: 0, latencyMs: Date.now() - bStart, error: String(err) };
      }
    };

    const captureAndStore = async (bResult: ShadowResult<I, O>["bResult"]) => {
      const aScore = aResult.error ? 0 : scoreResult(aResult, this.opts.scoringWeights);
      const bScore = bResult?.error || !bResult ? 0 : scoreResult(bResult, this.opts.scoringWeights);
      const delta  = bScore - aScore;

      const shadow: ShadowResult<I, O> = {
        shadowId:     shadowId(),
        pillarId:     exp.pillarId,
        experimentId,
        input,
        aResult,
        bResult,
        winner:       bResult?.error ? "A_WINS" : decideWinner(delta, this.opts.winThreshold),
        scoreDelta:   delta,
        capturedAt:   Date.now(),
        captureMode:  exp.captureMode,
        tags,
      };

      (exp.results as ShadowResult<I, O>[]).push(shadow);
      if (this.opts.verbose) {
        console.log(`[Shadow] exp=${experimentId} winner=${shadow.winner} scoreDelta=${delta.toFixed(4)} A_lat=${aResult.latencyMs}ms B_lat=${bResult?.latencyMs ?? "n/a"}ms`);
      }
      await this.opts.onCapture?.(shadow as ShadowResult<unknown, unknown>);
    };

    if (exp.captureMode === "AWAIT") {
      await captureAndStore(await runB());
    } else {
      runB().then(captureAndStore).catch(() => {});
    }

    return aOutput;
  }

  // ── Analysis ──────────────────────────────────────────────────────

  concludeExperiment(experimentId: string): ShadowExperiment["summary"] | null {
    const exp = this.experiments.get(experimentId);
    if (!exp) return null;

    const results = exp.results;
    if (results.length === 0) return null;

    const aWins = results.filter((r) => r.winner === "A_WINS").length;
    const bWins = results.filter((r) => r.winner === "B_WINS").length;
    const ties  = results.filter((r) => r.winner === "TIE").length;
    const avgDelta = results.reduce((s, r) => s + r.scoreDelta, 0) / results.length;

    const winnerDecision: WinnerDecision =
      bWins > aWins ? "B_WINS" :
      aWins > bWins ? "A_WINS" :
      "TIE";

    exp.summary = { totalRuns: results.length, aWins, bWins, ties, avgScoreDelta: avgDelta, winnerDecision, concludedAt: Date.now() };
    exp.status  = "CONCLUDED";
    return exp.summary;
  }

  getExperiment(id: string): ShadowExperiment | null { return this.experiments.get(id) ?? null; }
  getAllExperiments(): ShadowExperiment[] { return [...this.experiments.values()]; }
  getActiveExperiments(): ShadowExperiment[] { return [...this.experiments.values()].filter((e) => e.status === "ACTIVE"); }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatExperimentSummary(exp: ShadowExperiment): string {
  const s = exp.summary;
  const lines = [
    `Shadow Experiment [${exp.experimentId}]  "${exp.label}"  pillar=${exp.pillarId}  status=${exp.status}`,
    `  A=${exp.aVariantId}  B=${exp.bVariantId}  mode=${exp.captureMode}  runs=${exp.results.length}`,
  ];
  if (s) {
    lines.push(
      `  A_wins=${s.aWins}  B_wins=${s.bWins}  ties=${s.ties}  avgDelta=${s.avgScoreDelta >= 0 ? "+" : ""}${s.avgScoreDelta.toFixed(4)}`,
      `  WINNER: ${s.winnerDecision}`
    );
  }
  return lines.join("\n");
}

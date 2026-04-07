/**
 * toolbox/tools/healing-vision/agent-trinity-protocol.ts
 * version: 1.0.0
 *
 * Pillar 18: Anti-Fragile Orchestration
 * Domains: NEURAL-INFRASTRUCTURE | Sovereign-Correction
 *
 * Orchestrates a three-agent closed-loop:
 *
 *   WORKER  → produces an output (text, JSON, geometry, code, etc.)
 *   CRITIC  → evaluates the output; returns confidence [0, 1] + issues[]
 *   FIXER   → receives the output + issues, returns a corrected version
 *
 * Anti-Fragile guarantee:
 *   If CRITIC confidence < hallucinationThreshold (default 0.95),
 *   FIXER is invoked and the loop restarts.  The system grows stronger
 *   under repeated correction — it never silently accepts a low-confidence
 *   result.  After maxRounds the best-scored result seen is returned with
 *   a DEGRADED status rather than a silent failure.
 *
 * Design principles:
 *   - All three agent roles are plain async functions (no framework lock-in)
 *   - Fully typed input/output contracts via generics
 *   - Detailed run log for every round (audit trail)
 *   - Pluggable: swap any role implementation at call time
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** Severity level for a critic issue */
export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

/** A single problem found by the CRITIC */
export interface CriticIssue {
  code:       string;         // e.g. "HALLUCINATION", "SCHEMA_MISMATCH"
  severity:   IssueSeverity;
  field?:     string;         // Which field/key is affected
  message:    string;
  /** Suggested correction hint for the FIXER (optional) */
  hint?:      string;
}

/** Output of the CRITIC agent */
export interface CriticReport {
  /** Confidence that the worker output is correct, range [0, 1] */
  confidence:  number;
  issues:      CriticIssue[];
  /** Optional free-text summary */
  summary?:    string;
}

/** Log entry for a single Trinity loop round */
export interface TrinityRoundLog<T> {
  round:         number;
  workerOutput:  T;
  criticReport:  CriticReport;
  fixerInvoked:  boolean;
  fixerOutput?:  T;
  /** Wall-clock duration of this round in ms */
  durationMs:    number;
}

/** Final result returned by the Trinity orchestrator */
export interface TrinityResult<T> {
  /** The final accepted (or best-seen) output */
  output:      T;
  /** CONVERGED = threshold met; DEGRADED = maxRounds hit without convergence */
  status:      "CONVERGED" | "DEGRADED";
  /** How many rounds the loop ran */
  rounds:      number;
  /** Confidence of the final accepted output */
  finalConfidence: number;
  /** Full per-round audit trail */
  log:         TrinityRoundLog<T>[];
  /** Highest confidence seen across all rounds */
  peakConfidence: number;
}

// ─── Agent role types (generic over the payload T) ────────────────

/**
 * WORKER: produces an initial output from an arbitrary input.
 */
export type WorkerAgent<I, T> = (input: I) => Promise<T>;

/**
 * CRITIC: evaluates an output and returns a confidence + issue list.
 * Receives the original input so it can verify correctness against source.
 */
export type CriticAgent<I, T> = (input: I, output: T) => Promise<CriticReport>;

/**
 * FIXER: receives the current output and the full critic report,
 * returns a corrected version.
 */
export type FixerAgent<I, T> = (input: I, output: T, report: CriticReport) => Promise<T>;

// ─── Configuration ─────────────────────────────────────────────────

export interface TrinityOptions {
  /**
   * Confidence threshold below which FIXER is triggered.
   * Default: 0.95
   */
  hallucinationThreshold?: number;
  /**
   * Maximum number of WORKER→CRITIC→FIXER rounds before giving up.
   * Default: 5
   */
  maxRounds?: number;
  /**
   * If true, emit round summaries to console (debug).
   * Default: false
   */
  verbose?: boolean;
  /**
   * If true, skip re-running WORKER on retry and go straight to FIXER.
   * Default: true
   */
  fixerOnly?: boolean;
  /**
   * If true, on DEGRADED status throw instead of returning best-seen.
   * Default: false
   */
  throwOnDegraded?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// TRINITY ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Run the WORKER → CRITIC → FIXER anti-fragile loop.
 *
 * Generic parameters:
 *   I — type of the input to the WORKER
 *   T — type of the output produced and corrected
 *
 * @param input    The source input (passed to all three agents)
 * @param worker   WORKER agent function
 * @param critic   CRITIC agent function
 * @param fixer    FIXER agent function
 * @param opts     Loop configuration
 */
export async function runTrinityProtocol<I, T>(
  input:  I,
  worker: WorkerAgent<I, T>,
  critic: CriticAgent<I, T>,
  fixer:  FixerAgent<I, T>,
  opts:   TrinityOptions = {}
): Promise<TrinityResult<T>> {

  const threshold     = opts.hallucinationThreshold ?? 0.95;
  const maxRounds     = opts.maxRounds              ?? 5;
  const verbose       = opts.verbose                ?? false;
  const fixerOnly     = opts.fixerOnly              ?? true;
  const throwOnDeg    = opts.throwOnDegraded        ?? false;

  const roundLog: TrinityRoundLog<T>[] = [];
  let   current:  T;
  let   peakConf  = 0;
  let   bestOutput: T | undefined;
  let   round = 0;

  // ── Round 0: initial WORKER run ───────────────────────────────
  current = await worker(input);

  while (round < maxRounds) {
    round++;
    const roundStart = Date.now();

    // ── CRITIC ────────────────────────────────────────────────
    const report = await critic(input, current);

    if (verbose) {
      console.log(
        `[Trinity R${round}] confidence=${report.confidence.toFixed(3)}  issues=${report.issues.length}` +
        (report.summary ? `  "${report.summary}"` : "")
      );
    }

    // Track best-seen output
    if (report.confidence > peakConf) {
      peakConf    = report.confidence;
      bestOutput  = current;
    }

    const needsFix = report.confidence < threshold;
    let   fixerOutput: T | undefined;

    if (needsFix) {
      // ── FIXER ───────────────────────────────────────────────
      if (verbose) {
        const criticalIssues = report.issues.filter((i) => i.severity === "CRITICAL");
        console.log(
          `[Trinity R${round}] Threshold not met (${report.confidence.toFixed(3)} < ${threshold}) — invoking FIXER.` +
          (criticalIssues.length ? `  Critical issues: ${criticalIssues.map((i) => i.code).join(", ")}` : "")
        );
      }

      fixerOutput = await fixer(input, current, report);

      roundLog.push({
        round,
        workerOutput:  current,
        criticReport:  report,
        fixerInvoked:  true,
        fixerOutput,
        durationMs:    Date.now() - roundStart,
      });

      // Prepare for next round
      if (fixerOnly) {
        current = fixerOutput;
      } else {
        // Re-run the worker with fixer output as hint (caller implements this pattern)
        current = await worker(input);
      }

      // Continue loop — CRITIC will re-evaluate fixerOutput next round
      continue;
    }

    // ── Confidence met — ACCEPT ──────────────────────────────
    roundLog.push({
      round,
      workerOutput: current,
      criticReport: report,
      fixerInvoked: false,
      durationMs:   Date.now() - roundStart,
    });

    if (verbose) console.log(`[Trinity R${round}] CONVERGED at confidence=${report.confidence.toFixed(3)}.`);

    return {
      output:          current,
      status:          "CONVERGED",
      rounds:          round,
      finalConfidence: report.confidence,
      log:             roundLog,
      peakConfidence:  peakConf,
    };
  }

  // ── maxRounds exhausted — return best-seen (DEGRADED) ─────────
  const lastReport = roundLog[roundLog.length - 1]?.criticReport ?? { confidence: 0, issues: [] };
  if (verbose) {
    console.warn(`[Trinity] DEGRADED after ${maxRounds} rounds. Best confidence: ${peakConf.toFixed(3)}.`);
  }

  if (throwOnDegraded) {
    throw new TrinityDegradedError(
      `Trinity protocol failed to converge after ${maxRounds} rounds. ` +
      `Peak confidence: ${peakConf.toFixed(3)}, threshold: ${threshold}.`,
      bestOutput as T,
      roundLog,
      peakConf
    );
  }

  return {
    output:          bestOutput as T,
    status:          "DEGRADED",
    rounds:          round,
    finalConfidence: lastReport.confidence,
    log:             roundLog,
    peakConfidence:  peakConf,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════

export class TrinityDegradedError<T> extends Error {
  constructor(
    message:               string,
    public readonly bestOutput:     T,
    public readonly log:            TrinityRoundLog<T>[],
    public readonly peakConfidence: number
  ) {
    super(message);
    this.name = "TrinityDegradedError";
  }
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN CRITIC HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a threshold-based critic from a set of named validation rules.
 * Each rule is a predicate that returns null (pass) or an issue object.
 *
 * Example:
 *   const critic = buildRuleCritic([
 *     (input, output) => output.length > 0 ? null : { code: "EMPTY", severity: "CRITICAL", message: "Output is empty." },
 *   ]);
 */
export function buildRuleCritic<I, T>(
  rules: Array<(input: I, output: T) => CriticIssue | null>
): CriticAgent<I, T> {
  return async (input, output) => {
    const issues: CriticIssue[] = [];
    for (const rule of rules) {
      const issue = rule(input, output);
      if (issue) issues.push(issue);
    }
    const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
    const highCount     = issues.filter((i) => i.severity === "HIGH").length;
    // Simple confidence: penalise per critical/high issue
    const penalty    = criticalCount * 0.3 + highCount * 0.1 + issues.length * 0.02;
    const confidence = Math.max(0, 1 - penalty);
    return { confidence, issues };
  };
}

/**
 * A no-op critic that always returns confidence 1.0 — useful for testing
 * the WORKER + FIXER path in isolation.
 */
export function passThroughCritic<I, T>(): CriticAgent<I, T> {
  return async () => ({ confidence: 1.0, issues: [], summary: "pass-through" });
}

/**
 * A strict critic that always fails — forces FIXER to run every round.
 * Useful for stress-testing FIXER implementations.
 */
export function alwaysFailCritic<I, T>(message = "Always-fail critic"): CriticAgent<I, T> {
  return async () => ({
    confidence: 0,
    issues: [{ code: "FORCE_FAIL", severity: "CRITICAL", message }],
  });
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a TrinityResult as a compact audit summary for logging.
 */
export function formatTrinityAudit<T>(result: TrinityResult<T>): string {
  const lines: string[] = [
    `Trinity Audit — Status: ${result.status}  Rounds: ${result.rounds}  Peak Conf: ${result.peakConfidence.toFixed(4)}  Final Conf: ${result.finalConfidence.toFixed(4)}`,
  ];
  for (const entry of result.log) {
    const issues = entry.criticReport.issues.map((i) => `${i.severity}:${i.code}`).join(", ") || "none";
    lines.push(
      `  R${entry.round}: conf=${entry.criticReport.confidence.toFixed(3)}  issues=[${issues}]  fixer=${entry.fixerInvoked}  ${entry.durationMs}ms`
    );
  }
  return lines.join("\n");
}

/**
 * Summarise issues from all rounds, grouped by severity, for a DEGRADED report.
 */
export function aggregateIssues<T>(log: TrinityRoundLog<T>[]): Record<IssueSeverity, CriticIssue[]> {
  const map: Record<IssueSeverity, CriticIssue[]> = {
    CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [],
  };
  for (const entry of log) {
    for (const issue of entry.criticReport.issues) {
      map[issue.severity].push(issue);
    }
  }
  return map;
}

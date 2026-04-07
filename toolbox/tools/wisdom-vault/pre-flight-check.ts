/**
 * toolbox/tools/wisdom-vault/pre-flight-check.ts
 * version: 1.0.0
 *
 * Pillar 25: Negative Knowledge Base
 * Domains: SOVEREIGN-CORRECTION | Antifragile-Wisdom
 *
 * Runs before every agent invocation to:
 *   1. Hash the incoming task input
 *   2. Query the FailureRecorder for similar past failures
 *   3. Query the SequenceAnalyzer for known-failed chains
 *   4. Assemble a set of Negative Constraints
 *   5. Inject those constraints into the agent's system prompt
 *      as a clearly labelled NEGATIVE KNOWLEDGE block
 *
 * The injected block looks like:
 *
 *   ══ NEGATIVE KNOWLEDGE (Sovereign Correction) ══
 *   The following constraints are derived from past failures.
 *   Violating them is likely to produce a REJECTED or ABANDONED outcome.
 *
 *   [CRITICAL / LINGUISTIC] Do NOT use phrasing X — caused hallucination (3x).
 *   [HIGH     / LOGIC     ] Do NOT invoke sequence [A → B → C] — failed at B.
 *   [MEDIUM   / TOOL_MISMATCH] Do NOT use tool Y for latency-sensitive tasks.
 *   ═══════════════════════════════════════════════
 *
 * Pre-flight also produces a PreFlightReport for audit logging:
 *   - how many constraints were found
 *   - how many were injected
 *   - estimated risk level for this invocation
 *   - recommended actions (skip, proceed, escalate)
 *
 * Pure TypeScript — no external dependencies.
 */

import type { FailureRecorder } from "./failure-recorder.ts";
import type { SequenceAnalyzer } from "../tactical-strategy/sequence-analyzer.ts";
import { hashPayload } from "../evolution-engine/telemetry-logger.tool.ts";
import type { RootCause, SeverityLevel } from "./failure-recorder.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type RiskLevel = "CLEAR" | "LOW" | "ELEVATED" | "HIGH" | "BLOCKED";

export interface NegativeConstraint {
  text:        string;
  rootCause:   RootCause;
  severity:    SeverityLevel;
  recurrences: number;
  source:      "FAILURE_RECORDER" | "SEQUENCE_ANALYZER";
}

export interface PreFlightReport {
  taskHash:           string;
  pillarId:           string;
  agentId:            string;
  constraintsFound:   number;
  constraintsInjected: number;
  riskLevel:          RiskLevel;
  recommendation:     "PROCEED" | "PROCEED_WITH_CAUTION" | "RE_ARBITRATE" | "ESCALATE" | "BLOCK";
  constraints:        NegativeConstraint[];
  /** The full modified system prompt with negative knowledge injected */
  augmentedPrompt:    string;
  /** The injected block alone — for logging */
  negativeKnowledgeBlock: string;
  checkedAt:          number;
  checkLatencyMs:     number;
}

export interface PreFlightOptions {
  /**
   * Maximum number of negative constraints to inject.
   * More constraints = more prompt tokens. Default: 10
   */
  maxConstraints?: number;
  /**
   * Only inject constraints with severity >= this level.
   * Default: "LOW" (inject all)
   */
  minSeverity?: SeverityLevel;
  /**
   * If any CRITICAL constraint exists, block the invocation entirely.
   * Default: false (CRITICAL constraints are injected but not blocking)
   */
  blockOnCritical?: boolean;
  /**
   * If the total recurrence count of all matched failures exceeds this
   * threshold, escalate rather than proceed. Default: 20
   */
  escalateThreshold?: number;
  /**
   * Prefix added before the negative knowledge block in the prompt.
   * Default: a double newline.
   */
  promptSeparator?: string;
  /** Sequence analyzer to also check known-failed chains. Optional. */
  sequenceAnalyzer?: SequenceAnalyzer;
  verbose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// SEVERITY ORDERING
// ═══════════════════════════════════════════════════════════════════

const SEV_ORDER: Record<SeverityLevel, number> = {
  CRITICAL: 4,
  HIGH:     3,
  MEDIUM:   2,
  LOW:      1,
};

function meetsMinSeverity(sev: SeverityLevel, min: SeverityLevel): boolean {
  return SEV_ORDER[sev] >= SEV_ORDER[min];
}

// ═══════════════════════════════════════════════════════════════════
// RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════════════

function assessRisk(constraints: NegativeConstraint[]): RiskLevel {
  if (constraints.length === 0) return "CLEAR";
  const hasCritical = constraints.some((c) => c.severity === "CRITICAL");
  const hasHigh     = constraints.some((c) => c.severity === "HIGH");
  const totalRecurr = constraints.reduce((s, c) => s + c.recurrences, 0);

  if (hasCritical && totalRecurr >= 5) return "BLOCKED";
  if (hasCritical) return "HIGH";
  if (hasHigh || totalRecurr >= 10)    return "ELEVATED";
  if (constraints.length >= 3)         return "LOW";
  return "LOW";
}

function assessRecommendation(
  risk:       RiskLevel,
  opts:       Required<PreFlightOptions>,
  constraints: NegativeConstraint[]
): PreFlightReport["recommendation"] {
  const totalRecurr = constraints.reduce((s, c) => s + c.recurrences, 0);

  if (risk === "BLOCKED" && opts.blockOnCritical)             return "BLOCK";
  if (totalRecurr >= opts.escalateThreshold)                  return "ESCALATE";
  if (risk === "HIGH")                                        return "RE_ARBITRATE";
  if (risk === "ELEVATED")                                    return "PROCEED_WITH_CAUTION";
  return "PROCEED";
}

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE KNOWLEDGE BLOCK BUILDER
// ═══════════════════════════════════════════════════════════════════

function buildNegativeKnowledgeBlock(
  constraints: NegativeConstraint[],
  riskLevel:   RiskLevel
): string {
  if (constraints.length === 0) return "";

  const riskLine = `Risk Level: ${riskLevel}`;
  const lines: string[] = [
    "══ NEGATIVE KNOWLEDGE (Sovereign Correction) ══",
    "The following constraints are derived from past failures in this pillar.",
    "Violating them is statistically likely to produce a REJECTED or ABANDONED outcome.",
    riskLine,
    "",
  ];

  for (const c of constraints) {
    const recurrStr = c.recurrences > 0 ? ` (${c.recurrences}x recurrence)` : "";
    lines.push(`[${c.severity.padEnd(8)} / ${c.rootCause.padEnd(14)}] ${c.text}${recurrStr}`);
  }

  lines.push("═══════════════════════════════════════════════");
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// PRE-FLIGHT CHECK
// ═══════════════════════════════════════════════════════════════════

export class PreFlightCheck {
  private opts: Required<PreFlightOptions>;

  constructor(
    private readonly recorder: FailureRecorder,
    opts: PreFlightOptions = {}
  ) {
    this.opts = {
      maxConstraints:     opts.maxConstraints     ?? 10,
      minSeverity:        opts.minSeverity        ?? "LOW",
      blockOnCritical:    opts.blockOnCritical    ?? false,
      escalateThreshold:  opts.escalateThreshold  ?? 20,
      promptSeparator:    opts.promptSeparator    ?? "\n\n",
      sequenceAnalyzer:   opts.sequenceAnalyzer   ?? undefined as unknown as SequenceAnalyzer,
      verbose:            opts.verbose            ?? false,
    };
  }

  // ── Main entry point ─────────────────────────────────────────────

  /**
   * Run the pre-flight check.
   *
   * @param taskInput      The raw task input (will be hashed — not stored)
   * @param pillarId       The pillar this agent belongs to
   * @param agentId        The agent about to be invoked
   * @param systemPrompt   The agent's current system prompt
   * @returns              A PreFlightReport with the augmented prompt
   */
  async check(
    taskInput:    unknown,
    pillarId:     string,
    agentId:      string,
    systemPrompt: string
  ): Promise<PreFlightReport> {
    const t0       = Date.now();
    const taskHash = hashPayload(taskInput);

    // 1. Query failure recorder
    const rawConstraints = await this.recorder.getConstraintsForTask(
      taskInput,
      pillarId,
      this.opts.maxConstraints * 2   // over-fetch, then filter + deduplicate
    );

    // 2. Query sequence analyzer for known-failed chains (if provided)
    const seqConstraints: NegativeConstraint[] = [];
    if (this.opts.sequenceAnalyzer) {
      const failedChains = this.opts.sequenceAnalyzer
        .getChains({ pillarId, outcome: "FAILED" })
        .slice(0, 20);

      for (const chain of failedChains) {
        const seq = chain.steps.map((s) => s.toolId).join(" → ");
        seqConstraints.push({
          text:        `Do NOT follow the tool sequence [${seq}] — it ended in FAILED (latency=${chain.totalLatencyMs}ms, conf=${chain.avgConfidence.toFixed(3)})`,
          rootCause:   "LOGIC",
          severity:    "MEDIUM",
          recurrences: 0,
          source:      "SEQUENCE_ANALYZER",
        });
      }
    }

    // 3. Merge and deduplicate
    const fromRecorder: NegativeConstraint[] = rawConstraints.map((c) => ({
      ...c,
      source: "FAILURE_RECORDER" as const,
    }));

    const all = [...fromRecorder, ...seqConstraints];

    // 4. Filter by minimum severity
    const filtered = all.filter((c) => meetsMinSeverity(c.severity, this.opts.minSeverity));

    // 5. Sort: CRITICAL first, then by recurrences, then by source (recorder > analyzer)
    filtered.sort((a, b) => {
      const sevDiff = SEV_ORDER[b.severity] - SEV_ORDER[a.severity];
      if (sevDiff !== 0) return sevDiff;
      const recDiff = b.recurrences - a.recurrences;
      if (recDiff !== 0) return recDiff;
      return a.source === "FAILURE_RECORDER" ? -1 : 1;
    });

    // 6. Deduplicate by text prefix (first 80 chars)
    const seen = new Set<string>();
    const deduped = filtered.filter((c) => {
      const key = c.text.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const toInject = deduped.slice(0, this.opts.maxConstraints);

    // 7. Assess risk
    const riskLevel      = assessRisk(toInject);
    const recommendation = assessRecommendation(riskLevel, this.opts, toInject);

    // 8. Build the negative knowledge block
    const negativeKnowledgeBlock = buildNegativeKnowledgeBlock(toInject, riskLevel);

    // 9. Inject into system prompt
    const augmentedPrompt = negativeKnowledgeBlock.length > 0
      ? `${systemPrompt}${this.opts.promptSeparator}${negativeKnowledgeBlock}`
      : systemPrompt;

    if (this.opts.verbose) {
      console.log(
        `[PreFlight] pillar=${pillarId} agent=${agentId} risk=${riskLevel} ` +
        `constraints=${toInject.length} recommendation=${recommendation}`
      );
    }

    return {
      taskHash,
      pillarId,
      agentId,
      constraintsFound:    all.length,
      constraintsInjected: toInject.length,
      riskLevel,
      recommendation,
      constraints:         toInject,
      augmentedPrompt,
      negativeKnowledgeBlock,
      checkedAt:           Date.now(),
      checkLatencyMs:      Date.now() - t0,
    };
  }

  // ── Convenience: check + auto-block ──────────────────────────────

  /**
   * Check the task. If recommendation is BLOCK, throw.
   * Otherwise return the augmented prompt string.
   */
  async checkOrThrow(
    taskInput:    unknown,
    pillarId:     string,
    agentId:      string,
    systemPrompt: string
  ): Promise<string> {
    const report = await this.check(taskInput, pillarId, agentId, systemPrompt);
    if (report.recommendation === "BLOCK") {
      throw new Error(
        `[PreFlight] BLOCKED — pillar='${pillarId}' agent='${agentId}' ` +
        `risk=${report.riskLevel} totalRecurrences=${report.constraints.reduce((s, c) => s + c.recurrences, 0)}. ` +
        `Top constraint: ${report.constraints[0]?.text.slice(0, 120) ?? "none"}`
      );
    }
    return report.augmentedPrompt;
  }

  // ── Batch check ───────────────────────────────────────────────────

  /**
   * Run pre-flight for multiple (pillarId, agentId) pairs concurrently.
   */
  async checkBatch(
    requests: Array<{
      taskInput:    unknown;
      pillarId:     string;
      agentId:      string;
      systemPrompt: string;
    }>
  ): Promise<PreFlightReport[]> {
    return Promise.all(
      requests.map((r) => this.check(r.taskInput, r.pillarId, r.agentId, r.systemPrompt))
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

const RISK_ICON: Record<RiskLevel, string> = {
  CLEAR:    "✅",
  LOW:      "🟢",
  ELEVATED: "🟡",
  HIGH:     "🟠",
  BLOCKED:  "🔴",
};

export function formatPreFlightReport(r: PreFlightReport): string {
  const icon = RISK_ICON[r.riskLevel];
  const lines = [
    `${icon} Pre-Flight Report — ${new Date(r.checkedAt).toISOString()}`,
    `  Pillar: ${r.pillarId}  Agent: ${r.agentId}  Risk: ${r.riskLevel}  Recommendation: ${r.recommendation}`,
    `  Constraints: found=${r.constraintsFound}  injected=${r.constraintsInjected}  check=${r.checkLatencyMs}ms`,
  ];
  if (r.constraints.length > 0) {
    lines.push("  Top constraints:");
    for (const c of r.constraints.slice(0, 3)) {
      lines.push(`    [${c.severity}/${c.rootCause}] ${c.text.slice(0, 90)}…`);
    }
  }
  return lines.join("\n");
}

export function formatNegativeKnowledgeBlock(report: PreFlightReport): string {
  return report.negativeKnowledgeBlock || "(no constraints — clear to proceed)";
}

/**
 * Produce a compact one-line status string suitable for structured logging.
 */
export function preFlightStatusLine(report: PreFlightReport): string {
  return `preflight pillar=${report.pillarId} agent=${report.agentId} hash=${report.taskHash} risk=${report.riskLevel} rec=${report.recommendation} injected=${report.constraintsInjected} latency=${report.checkLatencyMs}ms`;
}

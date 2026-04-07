/**
 * toolbox/tools/meta-governance/cto-dashboard.ts
 * version: 1.0.0
 *
 * Pillar 32-D: CTO Dashboard
 * Domain: APEX-GOVERNANCE
 *
 * Aggregates Latency, Cost, Confidence, and Goal-Alignment from across
 * all Mainframe pillars into a single structured "System Health" report.
 *
 * Four primary health dimensions:
 *   LATENCY      — p50/p95/p99 across all pillar invocations
 *   COST         — token usage and estimated $ cost per pillar
 *   CONFIDENCE   — avg CRITIC confidence, rejection rate
 *   GOAL_ALIGNMENT — per-objective progress vs target (ObjectiveRegistry)
 *
 * Two derived scores:
 *   PILLAR_HEALTH — weighted combination per pillar [0, 1]
 *   SYSTEM_HEALTH — aggregate across all pillars [0, 1]
 *
 * System health bands:
 *   HEALTHY   ≥ 0.85
 *   WARNING   ≥ 0.70
 *   DEGRADED  ≥ 0.50
 *   CRITICAL  < 0.50
 *
 * Pure TypeScript — no external dependencies.
 */

import type { ObjectiveRegistry } from "../intelligence-core/objective-registry.ts";
import type { ReflectionCron }    from "../intelligence-core/reflection-cron.ts";
import type { SkillLibrary }      from "./skill-library.ts";
import type { ShadowTestHarness } from "./shadow-test-harness.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — PILLAR METRICS
// ═══════════════════════════════════════════════════════════════════

export interface LatencyMetrics {
  p50:   number;
  p95:   number;
  p99:   number;
  avg:   number;
  max:   number;
  budget: number;    // configured SLA budget
  budgetBreaches: number;
}

export interface CostMetrics {
  totalTokens:   number;
  promptTokens:  number;
  completionTokens: number;
  estimatedCostUsd: number;
  costPerInvocation: number;
}

export interface ConfidenceMetrics {
  avg:          number;
  min:          number;
  max:          number;
  rejectionRate: number;
  degradationTrend: "IMPROVING" | "STABLE" | "DEGRADING";
}

export interface GoalAlignmentMetrics {
  objectivesTracked: number;
  avgProgressPct:    number;
  onTrackCount:      number;
  offTrackCount:     number;
  achievedCount:     number;
}

export type HealthBand = "HEALTHY" | "WARNING" | "DEGRADED" | "CRITICAL";

export interface PillarHealth {
  pillarId:       string;
  invocations:    number;
  successRate:    number;
  latency:        LatencyMetrics;
  cost:           CostMetrics;
  confidence:     ConfidenceMetrics;
  healthScore:    number;        // [0, 1]
  healthBand:     HealthBand;
  activeSips:     number;
  activeSkills:   number;
  shadowExperiments: number;
  rollbackCount:  number;
  generatedAt:    number;
}

export interface SystemHealthReport {
  reportId:         string;
  systemHealthScore: number;
  systemHealthBand:  HealthBand;
  pillarsReported:  number;
  totalInvocations: number;
  totalCostUsd:     number;
  goalAlignment:    GoalAlignmentMetrics;
  latency:          LatencyMetrics;
  confidence:       ConfidenceMetrics;
  pillars:          PillarHealth[];
  topIssues:        SystemIssue[];
  recommendations:  string[];
  generatedAt:      number;
  windowMs:         number;
}

export interface SystemIssue {
  severity:  "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  pillarId:  string;
  dimension: "LATENCY" | "COST" | "CONFIDENCE" | "GOAL_ALIGNMENT" | "FAILURE" | "GENERAL";
  message:   string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — PILLAR TELEMETRY INPUT
// ═══════════════════════════════════════════════════════════════════

/** Caller pushes pillar telemetry into the dashboard each window. */
export interface PillarTelemetryInput {
  pillarId:      string;
  invocations:   number;
  successRate:   number;
  latencySamples: number[];  // raw latency values in ms
  latencyBudget:  number;
  totalTokens?:   number;
  promptTokens?:  number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  avgConfidence:  number;
  minConfidence:  number;
  maxConfidence:  number;
  rejectionRate:  number;
  confidenceTrend: ConfidenceMetrics["degradationTrend"];
  activeSips?:    number;
  activeSkills?:  number;
  shadowExperiments?: number;
  rollbackCount?: number;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _rptSeq = 0;
function rptId(): string { return `dash_${Date.now().toString(36)}_${(++_rptSeq).toString(36).padStart(4, "0")}`; }

// ═══════════════════════════════════════════════════════════════════
// PERCENTILE HELPER
// ═══════════════════════════════════════════════════════════════════

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ═══════════════════════════════════════════════════════════════════
// HEALTH SCORING
// ═══════════════════════════════════════════════════════════════════

const WEIGHT = { successRate: 0.35, confidence: 0.30, latency: 0.20, cost: 0.15 };

function computePillarHealthScore(p: PillarTelemetryInput): number {
  const latencyScore = p.latencySamples.length > 0
    ? Math.max(0, 1 - (percentile([...p.latencySamples].sort((a, b) => a - b), 95) / (p.latencyBudget * 1.5)))
    : 1;
  const costScore   = 1; // cost is informational; no penalty by default
  return (
    WEIGHT.successRate * p.successRate +
    WEIGHT.confidence  * p.avgConfidence +
    WEIGHT.latency     * latencyScore +
    WEIGHT.cost        * costScore
  );
}

function healthBand(score: number): HealthBand {
  if (score >= 0.85) return "HEALTHY";
  if (score >= 0.70) return "WARNING";
  if (score >= 0.50) return "DEGRADED";
  return "CRITICAL";
}

// ═══════════════════════════════════════════════════════════════════
// CTO DASHBOARD
// ═══════════════════════════════════════════════════════════════════

export interface CtoDashboardOptions {
  windowMs?:  number;
  verbose?:   boolean;
  /** SLA latency budget used when pillar does not specify one. Default: 5000 */
  defaultLatencyBudget?: number;
}

export class CtoDashboard {
  private opts: Required<CtoDashboardOptions>;
  private reports: SystemHealthReport[] = [];

  constructor(
    private readonly objectives?:  ObjectiveRegistry,
    private readonly reflector?:   ReflectionCron,
    private readonly skills?:      SkillLibrary,
    private readonly shadow?:      ShadowTestHarness,
    opts: CtoDashboardOptions = {}
  ) {
    this.opts = {
      windowMs:             opts.windowMs             ?? 6 * 60 * 60 * 1000,
      verbose:              opts.verbose              ?? false,
      defaultLatencyBudget: opts.defaultLatencyBudget ?? 5_000,
    };
  }

  // ── Generate report ───────────────────────────────────────────────

  generate(inputs: PillarTelemetryInput[]): SystemHealthReport {
    const issues:          SystemIssue[] = [];
    const recommendations: string[]     = [];
    const pillars:         PillarHealth[]= [];

    let totalInvocations  = 0;
    let totalCostUsd      = 0;
    const allLatencies:   number[] = [];
    let sumConfidence     = 0;
    let sumRejectionRate  = 0;

    for (const input of inputs) {
      totalInvocations += input.invocations;
      totalCostUsd     += input.estimatedCostUsd ?? 0;

      const sorted   = [...input.latencySamples].sort((a, b) => a - b);
      const breaches = sorted.filter((l) => l > input.latencyBudget).length;
      allLatencies.push(...sorted);
      sumConfidence    += input.avgConfidence;
      sumRejectionRate += input.rejectionRate;

      const score = computePillarHealthScore(input);
      const band  = healthBand(score);

      const pillar: PillarHealth = {
        pillarId:        input.pillarId,
        invocations:     input.invocations,
        successRate:     input.successRate,
        latency: {
          p50:            percentile(sorted, 50),
          p95:            percentile(sorted, 95),
          p99:            percentile(sorted, 99),
          avg:            sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0,
          max:            sorted[sorted.length - 1] ?? 0,
          budget:         input.latencyBudget,
          budgetBreaches: breaches,
        },
        cost: {
          totalTokens:        input.totalTokens        ?? 0,
          promptTokens:       input.promptTokens       ?? 0,
          completionTokens:   input.completionTokens   ?? 0,
          estimatedCostUsd:   input.estimatedCostUsd   ?? 0,
          costPerInvocation:  input.invocations > 0 ? (input.estimatedCostUsd ?? 0) / input.invocations : 0,
        },
        confidence: {
          avg:              input.avgConfidence,
          min:              input.minConfidence,
          max:              input.maxConfidence,
          rejectionRate:    input.rejectionRate,
          degradationTrend: input.confidenceTrend,
        },
        healthScore:        score,
        healthBand:         band,
        activeSips:         input.activeSips         ?? 0,
        activeSkills:       input.activeSkills        ?? 0,
        shadowExperiments:  input.shadowExperiments   ?? 0,
        rollbackCount:      input.rollbackCount       ?? 0,
        generatedAt:        Date.now(),
      };

      pillars.push(pillar);

      // ── Issue detection ─────────────────────────────────────────

      if (band === "CRITICAL" || band === "DEGRADED") {
        issues.push({ severity: band === "CRITICAL" ? "CRITICAL" : "HIGH", pillarId: input.pillarId, dimension: "GENERAL", message: `${input.pillarId}: healthScore=${score.toFixed(3)} (${band})` });
      }
      if (input.successRate < 0.70) {
        issues.push({ severity: input.successRate < 0.50 ? "CRITICAL" : "HIGH", pillarId: input.pillarId, dimension: "FAILURE", message: `${input.pillarId}: successRate=${(input.successRate * 100).toFixed(1)}% — below 70% threshold` });
        recommendations.push(`Run Pillar 23 MutationEngine for '${input.pillarId}'.`);
      }
      if (breaches > input.invocations * 0.20) {
        issues.push({ severity: "HIGH", pillarId: input.pillarId, dimension: "LATENCY", message: `${input.pillarId}: ${breaches}/${input.invocations} invocations exceeded latency budget (${input.latencyBudget}ms)` });
        recommendations.push(`Run Pillar 24 ArbitrationEngine for lower-latency tool paths in '${input.pillarId}'.`);
      }
      if (input.avgConfidence < 0.65) {
        issues.push({ severity: "MEDIUM", pillarId: input.pillarId, dimension: "CONFIDENCE", message: `${input.pillarId}: avgConfidence=${(input.avgConfidence * 100).toFixed(1)}%` });
        recommendations.push(`Check Pillar 25 PreFlightCheck negative constraints for '${input.pillarId}'.`);
      }
      if (input.confidenceTrend === "DEGRADING") {
        issues.push({ severity: "MEDIUM", pillarId: input.pillarId, dimension: "CONFIDENCE", message: `${input.pillarId}: confidence is DEGRADING across windows` });
      }
    }

    // ── System-wide latency ─────────────────────────────────────────

    const allSorted = allLatencies.sort((a, b) => a - b);
    const sysLatency: LatencyMetrics = {
      p50:    percentile(allSorted, 50),
      p95:    percentile(allSorted, 95),
      p99:    percentile(allSorted, 99),
      avg:    allSorted.length > 0 ? allSorted.reduce((s, v) => s + v, 0) / allSorted.length : 0,
      max:    allSorted[allSorted.length - 1] ?? 0,
      budget: this.opts.defaultLatencyBudget,
      budgetBreaches: allSorted.filter((l) => l > this.opts.defaultLatencyBudget).length,
    };

    // ── Goal alignment from ObjectiveRegistry ───────────────────────

    let goalAlignment: GoalAlignmentMetrics = { objectivesTracked: 0, avgProgressPct: 0, onTrackCount: 0, offTrackCount: 0, achievedCount: 0 };
    if (this.objectives) {
      const active = this.objectives.getActive();
      const progresses = active.map((o) => this.objectives!.getProgress(o.objectiveId)!).filter(Boolean);
      goalAlignment = {
        objectivesTracked: active.length,
        avgProgressPct:    progresses.length > 0 ? progresses.reduce((s, p) => s + p.progressPct, 0) / progresses.length : 0,
        onTrackCount:      progresses.filter((p) => p.onTrack).length,
        offTrackCount:     progresses.filter((p) => !p.onTrack).length,
        achievedCount:     this.objectives.find({ status: "ACHIEVED" }).length,
      };
      if (goalAlignment.avgProgressPct < 50) {
        issues.push({ severity: "HIGH", pillarId: "objective-registry", dimension: "GOAL_ALIGNMENT", message: `Avg goal progress: ${goalAlignment.avgProgressPct.toFixed(1)}% — Mainframe is off-track` });
        recommendations.push("Review ObjectiveRegistry — reallocate pillar resources toward lagging goals.");
      }
    }

    // ── Aggregate scores ────────────────────────────────────────────

    const sysScore = pillars.length > 0
      ? pillars.reduce((s, p) => s + p.healthScore, 0) / pillars.length
      : 1;

    const sysConf: ConfidenceMetrics = {
      avg:              pillars.length > 0 ? sumConfidence / pillars.length : 0,
      min:              pillars.length > 0 ? Math.min(...pillars.map((p) => p.confidence.min)) : 0,
      max:              pillars.length > 0 ? Math.max(...pillars.map((p) => p.confidence.max)) : 0,
      rejectionRate:    pillars.length > 0 ? sumRejectionRate / pillars.length : 0,
      degradationTrend: pillars.some((p) => p.confidence.degradationTrend === "DEGRADING") ? "DEGRADING" : pillars.some((p) => p.confidence.degradationTrend === "IMPROVING") ? "IMPROVING" : "STABLE",
    };

    // Deduplicate recommendations
    const uniqueRecs = [...new Set(recommendations)].slice(0, 8);

    // Sort issues by severity
    const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    issues.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));

    const report: SystemHealthReport = {
      reportId:         rptId(),
      systemHealthScore: sysScore,
      systemHealthBand:  healthBand(sysScore),
      pillarsReported:  pillars.length,
      totalInvocations,
      totalCostUsd,
      goalAlignment,
      latency:          sysLatency,
      confidence:       sysConf,
      pillars:          pillars.sort((a, b) => a.healthScore - b.healthScore),
      topIssues:        issues.slice(0, 10),
      recommendations:  uniqueRecs,
      generatedAt:      Date.now(),
      windowMs:         this.opts.windowMs,
    };

    this.reports.push(report);
    if (this.opts.verbose) console.log(`[CtoDashboard] report=${report.reportId} system=${sysScore.toFixed(3)} (${report.systemHealthBand}) pillars=${pillars.length} issues=${issues.length}`);
    return report;
  }

  getLatestReport(): SystemHealthReport | null { return this.reports[this.reports.length - 1] ?? null; }
  getAllReports(): SystemHealthReport[] { return [...this.reports]; }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

const BAND_ICON: Record<HealthBand, string> = { HEALTHY: "✅", WARNING: "⚠️", DEGRADED: "🔴", CRITICAL: "🆘" };

export function formatSystemHealthReport(r: SystemHealthReport): string {
  const lines = [
    `╔══════════════════════════════════════════════════════════════════╗`,
    `║  SOVEREIGN MAINFRAME — SYSTEM HEALTH REPORT  ${new Date(r.generatedAt).toISOString().slice(0, 16)}  ║`,
    `╚══════════════════════════════════════════════════════════════════╝`,
    ``,
    `  ${BAND_ICON[r.systemHealthBand]} SYSTEM HEALTH: ${(r.systemHealthScore * 100).toFixed(1)}%  [${r.systemHealthBand}]`,
    ``,
    `  Pillars: ${r.pillarsReported}   Invocations: ${r.totalInvocations}   Cost: $${r.totalCostUsd.toFixed(4)}`,
    `  Latency p95: ${r.latency.p95}ms   p99: ${r.latency.p99}ms   Breaches: ${r.latency.budgetBreaches}`,
    `  Confidence:  avg=${(r.confidence.avg * 100).toFixed(1)}%  reject=${(r.confidence.rejectionRate * 100).toFixed(1)}%  trend=${r.confidence.degradationTrend}`,
    `  Goals:       ${r.goalAlignment.onTrackCount}/${r.goalAlignment.objectivesTracked} on-track  achieved=${r.goalAlignment.achievedCount}  avg=${r.goalAlignment.avgProgressPct.toFixed(1)}%`,
    ``,
    `  ── PILLAR BREAKDOWN ────────────────────────────────────────────`,
  ];

  for (const p of r.pillars) {
    const icon = BAND_ICON[p.healthBand];
    lines.push(
      `  ${icon} ${p.pillarId.padEnd(32)} ${(p.healthScore * 100).toFixed(1)}%  sr=${(p.successRate * 100).toFixed(1)}%  conf=${(p.confidence.avg * 100).toFixed(1)}%  p95=${p.latency.p95}ms  sips=${p.activeSips}`
    );
  }

  if (r.topIssues.length > 0) {
    lines.push(``, `  ── TOP ISSUES ──────────────────────────────────────────────────`);
    for (const issue of r.topIssues.slice(0, 5)) {
      lines.push(`  [${issue.severity.padEnd(8)}] [${issue.dimension.padEnd(15)}] ${issue.message.slice(0, 70)}`);
    }
  }

  if (r.recommendations.length > 0) {
    lines.push(``, `  ── RECOMMENDATIONS ─────────────────────────────────────────────`);
    for (const rec of r.recommendations) {
      lines.push(`  → ${rec}`);
    }
  }

  lines.push(``, `  Report ID: ${r.reportId}  Window: ${Math.round(r.windowMs / 3_600_000)}h`);
  return lines.join("\n");
}

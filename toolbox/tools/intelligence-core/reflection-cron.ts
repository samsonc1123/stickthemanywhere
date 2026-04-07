/**
 * toolbox/tools/intelligence-core/reflection-cron.ts
 * version: 1.0.0
 *
 * Pillar 27: Reflection Cron
 * Domain: AUTONOMOUS-SOVEREIGNTY
 *
 * Runs on a configurable schedule (default: every 6 hours).
 * Each cycle audits the Telemetry and Failure logs and generates
 * System Improvement Proposals (SIPs).
 *
 * A SIP is a structured, actionable recommendation directed at one
 * of the other Pillars — e.g.:
 *   "Pillar 23: Mutate prompt template prm_xyz — LINGUISTIC failure
 *    rate is 34% over the last 6h."
 *
 * SIP lifecycle:  PROPOSED → ACCEPTED → APPLIED | REJECTED
 *
 * Pure TypeScript — no external dependencies.
 * Integrates with TelemetryLogger (Pillar 17-EVO) and
 * FailureRecorder (Pillar 25).
 */

import type { TelemetryLogger } from "../evolution-engine/telemetry-logger.tool.ts";
import type { FailureRecorder }  from "../wisdom-vault/failure-recorder.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — SIP
// ═══════════════════════════════════════════════════════════════════

export type SipStatus = "PROPOSED" | "ACCEPTED" | "APPLIED" | "REJECTED";

export type SipCategory =
  | "PROMPT_MUTATION"        // Pillar 23 — mutate or retire a prompt
  | "TOOL_DEMOTION"          // Pillar 24 — lower StC / disable a tool
  | "ARBITRATION_REVIEW"     // Pillar 24 — re-run arbitration for a pillar
  | "FAILURE_PATTERN_ALERT"  // Pillar 25 — notify humans of critical pattern
  | "LATENCY_OPTIMIZATION"   // Pillar 24 — switch to lower-latency tool path
  | "OBJECTIVE_REVIEW"       // Pillar 29 — flag a persistent goal for review
  | "BANDIT_REBALANCE"        // Pillar 28 — increase exploration for a pillar
  | "GENERAL";

export interface SystemImprovementProposal {
  sipId:       string;
  title:       string;
  category:    SipCategory;
  /** Which pillar this SIP targets */
  targetPillar: string;
  priority:    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:      SipStatus;
  /** Evidence that triggered this SIP */
  evidence:    string;
  /** Specific action to take */
  action:      string;
  /** Expected outcome if action is applied */
  expectedOutcome: string;
  /** Metrics that support this SIP (key → value) */
  metrics:     Record<string, number | string>;
  generatedAt: number;
  appliedAt:   number | null;
  appliedBy:   string | null;
  notes:       string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — REFLECTION REPORT
// ═══════════════════════════════════════════════════════════════════

export interface ReflectionReport {
  reportId:        string;
  cycleStartedAt:  number;
  cycleCompletedAt: number;
  windowMs:        number;
  pillarsAudited:  string[];
  totalEvents:     number;
  totalFailures:   number;
  sipsGenerated:   number;
  sips:            SystemImprovementProposal[];
  healthSummary:   Record<string, { score: number; trend: "IMPROVING" | "STABLE" | "DEGRADING" }>;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATORS
// ═══════════════════════════════════════════════════════════════════

let _sipSeq    = 0;
let _reportSeq = 0;

function sipId():    string { return `sip_${Date.now().toString(36)}_${(++_sipSeq).toString(36).padStart(4, "0")}`; }
function reportId(): string { return `rpt_${Date.now().toString(36)}_${(++_reportSeq).toString(36).padStart(3, "0")}`; }

// ═══════════════════════════════════════════════════════════════════
// REFLECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

export interface ReflectionCronOptions {
  /** Audit window in ms. Default: 6 hours */
  windowMs?:          number;
  /** Cron interval in ms. Default: 6 hours */
  intervalMs?:        number;
  /** Pillars to audit. If empty, audits all pillars in telemetry. */
  pillarIds?:         string[];
  /** Min success rate below which a PROMPT_MUTATION SIP is raised. Default: 0.75 */
  mutationThreshold?: number;
  /** Min latency overage % to raise LATENCY_OPTIMIZATION. Default: 50 */
  latencyThreshold?:  number;
  /** If true, run immediately on start() instead of waiting for first interval. */
  runOnStart?:        boolean;
  verbose?:           boolean;
  /** Called after every reflection cycle with the report */
  onReport?:          (report: ReflectionReport) => void | Promise<void>;
}

export class ReflectionCron {
  private opts:         Required<Omit<ReflectionCronOptions, "onReport">> & { onReport?: ReflectionCronOptions["onReport"] };
  private sips:         SystemImprovementProposal[] = [];
  private reports:      ReflectionReport[]          = [];
  private timer:        ReturnType<typeof setInterval> | null = null;
  private abort:        AbortController | null = null;
  private prevScores:   Map<string, number> = new Map();

  constructor(
    private readonly telemetry: TelemetryLogger,
    private readonly failures:  FailureRecorder,
    opts: ReflectionCronOptions = {}
  ) {
    this.opts = {
      windowMs:           opts.windowMs           ?? 6 * 60 * 60 * 1000,
      intervalMs:         opts.intervalMs         ?? 6 * 60 * 60 * 1000,
      pillarIds:          opts.pillarIds          ?? [],
      mutationThreshold:  opts.mutationThreshold  ?? 0.75,
      latencyThreshold:   opts.latencyThreshold   ?? 50,
      runOnStart:         opts.runOnStart         ?? false,
      verbose:            opts.verbose            ?? false,
      onReport:           opts.onReport,
    };
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  start(): void {
    this.abort = new AbortController();
    if (this.opts.runOnStart) {
      this.reflect().catch(console.error);
    }
    this.timer = setInterval(() => {
      if (!this.abort?.signal.aborted) {
        this.reflect().catch(console.error);
      }
    }, this.opts.intervalMs);

    if (this.opts.verbose) {
      console.log(`[ReflectionCron] Started — interval=${this.opts.intervalMs}ms window=${this.opts.windowMs}ms`);
    }
  }

  stop(): void {
    this.abort?.abort();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // ── Manual trigger ────────────────────────────────────────────────

  async reflect(): Promise<ReflectionReport> {
    const cycleStartedAt = Date.now();
    const since          = cycleStartedAt - this.opts.windowMs;
    const newSips:       SystemImprovementProposal[] = [];
    const healthSummary: ReflectionReport["healthSummary"] = {};

    // ── Determine pillars to audit ──────────────────────────────────
    let pillars = this.opts.pillarIds;
    if (pillars.length === 0) {
      // Discover from telemetry — last window
      const records = await this.telemetry.getHistory({ since });
      pillars = [...new Set(records.map((r) => r.pillarId))];
    }

    let totalEvents   = 0;
    let totalFailures = 0;

    for (const pillarId of pillars) {
      // ── Telemetry audit ───────────────────────────────────────────
      const summary = await this.telemetry.pillarSummary(pillarId, since);
      totalEvents  += summary.total;

      const prevScore = this.prevScores.get(pillarId) ?? summary.successRate;
      const trend: "IMPROVING" | "STABLE" | "DEGRADING" =
        summary.successRate > prevScore + 0.03 ? "IMPROVING" :
        summary.successRate < prevScore - 0.03 ? "DEGRADING" : "STABLE";
      this.prevScores.set(pillarId, summary.successRate);

      healthSummary[pillarId] = { score: summary.successRate, trend };

      // SIP: low success rate → prompt mutation
      if (summary.total >= 5 && summary.successRate < this.opts.mutationThreshold) {
        newSips.push({
          sipId:        sipId(),
          title:        `Low success rate in '${pillarId}' — prompt mutation recommended`,
          category:     "PROMPT_MUTATION",
          targetPillar: pillarId,
          priority:     summary.successRate < 0.5 ? "CRITICAL" : "HIGH",
          status:       "PROPOSED",
          evidence:     `Success rate: ${(summary.successRate * 100).toFixed(1)}% over ${summary.total} invocations in the last ${Math.round(this.opts.windowMs / 3_600_000)}h window.`,
          action:       `Trigger Pillar 23 MutationEngine.evolveGeneration() for all ACTIVE prompts in pillar '${pillarId}'.`,
          expectedOutcome: "New CANDIDATE prompt variants generated for A/B testing.",
          metrics:      { successRate: summary.successRate, total: summary.total, abandons: summary.abandons },
          generatedAt:  Date.now(),
          appliedAt:    null,
          appliedBy:    null,
          notes:        `avgLatency=${summary.avgLatencyMs}ms avgConfidence=${summary.avgConfidence.toFixed(3)}`,
        });
      }

      // SIP: degrading trend
      if (trend === "DEGRADING" && summary.total >= 3) {
        newSips.push({
          sipId:        sipId(),
          title:        `Degrading performance trend in '${pillarId}'`,
          category:     "ARBITRATION_REVIEW",
          targetPillar: pillarId,
          priority:     "MEDIUM",
          status:       "PROPOSED",
          evidence:     `Success rate fell from ${(prevScore * 100).toFixed(1)}% to ${(summary.successRate * 100).toFixed(1)}% over the last window.`,
          action:       `Re-run Pillar 24 ArbitrationEngine for '${pillarId}' — current tool selection may no longer be optimal.`,
          expectedOutcome: "Updated Arbitration Plan with higher-StC tool selection.",
          metrics:      { prevScore, currentScore: summary.successRate, delta: summary.successRate - prevScore },
          generatedAt:  Date.now(),
          appliedAt:    null,
          appliedBy:    null,
          notes:        "",
        });
      }

      // ── Failure audit ─────────────────────────────────────────────
      const fSummary = await this.failures.pillarSummary(pillarId);
      totalFailures += fSummary.totalFailures;

      // SIP: critical recurring failures
      if (fSummary.criticalCount > 0) {
        newSips.push({
          sipId:        sipId(),
          title:        `CRITICAL failure pattern in '${pillarId}' — human review required`,
          category:     "FAILURE_PATTERN_ALERT",
          targetPillar: pillarId,
          priority:     "CRITICAL",
          status:       "PROPOSED",
          evidence:     `${fSummary.criticalCount} CRITICAL failure record(s). Dominant root cause: ${fSummary.topRootCause ?? "unknown"}. Recurring patterns: ${fSummary.recurringPatterns}.`,
          action:       `Review Pillar 25 FailureRecorder for pillar '${pillarId}'. Inspect top CRITICAL records and manually author negative constraints or retire the failing prompt/tool.`,
          expectedOutcome: "CRITICAL failure patterns acknowledged and mitigated.",
          metrics:      { criticalCount: fSummary.criticalCount, recurringPatterns: fSummary.recurringPatterns, totalFailures: fSummary.totalFailures },
          generatedAt:  Date.now(),
          appliedAt:    null,
          appliedBy:    null,
          notes:        `Failure breakdown: seq=${fSummary.failedSequences} rejected=${fSummary.rejectedOutputs} latency=${fSummary.highLatencyPaths}`,
        });
      }

      // SIP: high-latency paths
      if (fSummary.highLatencyPaths > 0) {
        newSips.push({
          sipId:        sipId(),
          title:        `High-latency paths detected in '${pillarId}'`,
          category:     "LATENCY_OPTIMIZATION",
          targetPillar: pillarId,
          priority:     "MEDIUM",
          status:       "PROPOSED",
          evidence:     `${fSummary.highLatencyPaths} HIGH_LATENCY_PATH failure(s) recorded.`,
          action:       `Query Pillar 24 WeightedToolRegistry for lower-latency alternatives (maxLatencyMs filter). Update Arbitration Plan.`,
          expectedOutcome: "Latency budget compliance restored.",
          metrics:      { highLatencyPaths: fSummary.highLatencyPaths },
          generatedAt:  Date.now(),
          appliedAt:    null,
          appliedBy:    null,
          notes:        "",
        });
      }

      // SIP: bandit rebalance — consistently high success rate
      if (summary.total >= 10 && summary.successRate >= 0.92) {
        newSips.push({
          sipId:        sipId(),
          title:        `'${pillarId}' is highly stable — increase exploration allocation`,
          category:     "BANDIT_REBALANCE",
          targetPillar: pillarId,
          priority:     "LOW",
          status:       "PROPOSED",
          evidence:     `Success rate ${(summary.successRate * 100).toFixed(1)}% over ${summary.total} events — exploitation is saturating.`,
          action:       `Increase Pillar 28 BanditStrategyManager exploration arm weight for '${pillarId}' by 5%.`,
          expectedOutcome: "New prompt mutations get more traffic; potential for further improvement discovered.",
          metrics:      { successRate: summary.successRate, total: summary.total },
          generatedAt:  Date.now(),
          appliedAt:    null,
          appliedBy:    null,
          notes:        "",
        });
      }
    }

    // Deduplicate SIPs by category + targetPillar (keep highest priority)
    const sipMap = new Map<string, SystemImprovementProposal>();
    for (const sip of newSips) {
      const key = `${sip.category}::${sip.targetPillar}`;
      const existing = sipMap.get(key);
      if (!existing || ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(sip.priority) < ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(existing.priority)) {
        sipMap.set(key, sip);
      }
    }

    const dedupedSips = [...sipMap.values()];
    this.sips.push(...dedupedSips);

    const report: ReflectionReport = {
      reportId:         reportId(),
      cycleStartedAt,
      cycleCompletedAt: Date.now(),
      windowMs:         this.opts.windowMs,
      pillarsAudited:   pillars,
      totalEvents,
      totalFailures,
      sipsGenerated:    dedupedSips.length,
      sips:             dedupedSips,
      healthSummary,
    };

    this.reports.push(report);
    if (this.opts.verbose) {
      console.log(`[ReflectionCron] Cycle complete — pillars=${pillars.length} events=${totalEvents} failures=${totalFailures} SIPs=${dedupedSips.length}`);
    }
    await this.opts.onReport?.(report);
    return report;
  }

  // ── SIP management ────────────────────────────────────────────────

  acceptSip(sipId: string, appliedBy: string): void {
    const sip = this.sips.find((s) => s.sipId === sipId);
    if (sip) { sip.status = "ACCEPTED"; sip.appliedBy = appliedBy; }
  }

  applySip(sipId: string): void {
    const sip = this.sips.find((s) => s.sipId === sipId);
    if (sip) { sip.status = "APPLIED"; sip.appliedAt = Date.now(); }
  }

  rejectSip(sipId: string, reason: string): void {
    const sip = this.sips.find((s) => s.sipId === sipId);
    if (sip) { sip.status = "REJECTED"; sip.notes += ` | Rejected: ${reason}`; }
  }

  getAllSips(filter?: { status?: SipStatus; category?: SipCategory; targetPillar?: string }): SystemImprovementProposal[] {
    let sips = [...this.sips];
    if (filter?.status)       sips = sips.filter((s) => s.status      === filter.status);
    if (filter?.category)     sips = sips.filter((s) => s.category    === filter.category);
    if (filter?.targetPillar) sips = sips.filter((s) => s.targetPillar === filter.targetPillar);
    return sips.sort((a, b) => b.generatedAt - a.generatedAt);
  }

  getLatestReport(): ReflectionReport | null {
    return this.reports[this.reports.length - 1] ?? null;
  }

  getAllReports(): ReflectionReport[] { return [...this.reports]; }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

const PRIORITY_ICON: Record<string, string> = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢" };

export function formatSip(sip: SystemImprovementProposal): string {
  const icon = PRIORITY_ICON[sip.priority] ?? "⚪";
  return [
    `${icon} [${sip.priority.padEnd(8)}] [${sip.category.padEnd(22)}] ${sip.title}`,
    `  target=${sip.targetPillar}  status=${sip.status}  id=${sip.sipId}`,
    `  evidence: ${sip.evidence.slice(0, 120)}`,
    `  action:   ${sip.action.slice(0, 120)}`,
  ].join("\n");
}

export function formatReflectionReport(r: ReflectionReport): string {
  const dur = r.cycleCompletedAt - r.cycleStartedAt;
  const lines = [
    `Reflection Report [${r.reportId}]  ${new Date(r.cycleStartedAt).toISOString()}  (${dur}ms)`,
    `  Pillars: ${r.pillarsAudited.length}  Events: ${r.totalEvents}  Failures: ${r.totalFailures}  SIPs: ${r.sipsGenerated}`,
    "",
    "  Health:",
  ];
  for (const [pid, h] of Object.entries(r.healthSummary)) {
    const trend = h.trend === "IMPROVING" ? "↑" : h.trend === "DEGRADING" ? "↓" : "→";
    lines.push(`    ${pid.padEnd(30)} score=${(h.score * 100).toFixed(1)}% ${trend}`);
  }
  if (r.sips.length > 0) {
    lines.push("", "  SIPs:");
    for (const sip of r.sips.slice(0, 5)) {
      lines.push(`    ${PRIORITY_ICON[sip.priority]} ${sip.title.slice(0, 70)}`);
    }
  }
  return lines.join("\n");
}

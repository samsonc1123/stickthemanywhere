/**
 * toolbox/tools/meta-governance/intelligence-version-control.ts
 * version: 1.0.0
 *
 * Pillar 32-A: Intelligence Version Control
 * Domain: APEX-GOVERNANCE
 *
 * Snapshots and rollbacks the Mainframe's mutable intelligence state:
 *   - Prompt templates (PromptArchive records)
 *   - Arbitration strategies (ArbitrationPlan configs)
 *   - Objective metric values (ObjectiveRegistry state)
 *   - Bandit arm statistics (BanditStrategyManager state)
 *   - Generic config blobs (any pillar's runtime configuration)
 *
 * Every snapshot is immutable once written. Rollback restores a prior
 * snapshot and emits a RollbackEvent for the audit log.
 *
 * Snapshot policy:
 *   AUTO  — triggered by performance drop (StC or successRate crosses threshold)
 *   MANUAL — triggered by human or Meta-Agent directive
 *   CRON  — triggered by ReflectionCron after each cycle
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type SnapshotPolicy  = "AUTO" | "MANUAL" | "CRON";
export type SnapshotDomain  = "PROMPT" | "ARBITRATION" | "OBJECTIVE" | "BANDIT" | "CONFIG";
export type RollbackReason  =
  | "PERFORMANCE_DROP"
  | "CRITIC_REJECTION_SURGE"
  | "LATENCY_SPIKE"
  | "SIP_DIRECTIVE"
  | "HUMAN_OVERRIDE"
  | "REGRESSION_DETECTED";

export interface SnapshotMetrics {
  successRate:      number;
  avgConfidence:    number;
  avgLatencyMs:     number;
  stcScore:         number;
  totalInvocations: number;
}

export interface IntelligenceSnapshot {
  snapshotId:   string;
  pillarId:     string;
  domain:       SnapshotDomain;
  policy:       SnapshotPolicy;
  version:      number;          // monotonically incrementing per pillar+domain
  label:        string;
  /** Serialised state — opaque JSON blob */
  state:        unknown;
  metrics:      SnapshotMetrics;
  createdAt:    number;
  createdBy:    string;          // agentId | "cron" | "human" | "meta-agent"
  tags:         string[];
  notes:        string;
}

export interface RollbackEvent {
  rollbackId:    string;
  pillarId:      string;
  domain:        SnapshotDomain;
  fromVersion:   number;
  toVersion:     number;
  fromSnapshotId: string;
  toSnapshotId:  string;
  reason:        RollbackReason;
  triggeredBy:   string;
  metricsBefore: SnapshotMetrics;
  metricsAfter:  SnapshotMetrics | null;
  rolledBackAt:  number;
  notes:         string;
}

export interface DiffResult {
  pillarId:    string;
  domain:      SnapshotDomain;
  snapshotA:   string;
  snapshotB:   string;
  versionA:    number;
  versionB:    number;
  metricsDelta: {
    successRateDelta:   number;
    confidenceDelta:    number;
    latencyDelta:       number;
    stcScoreDelta:      number;
  };
  /** Keys that differ between the two state blobs */
  changedKeys: string[];
  summary:     string;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATORS
// ═══════════════════════════════════════════════════════════════════

let _snapSeq = 0;
let _rbSeq   = 0;
function snapId(): string { return `snap_${Date.now().toString(36)}_${(++_snapSeq).toString(36).padStart(4, "0")}`; }
function rbId():   string { return `rb_${Date.now().toString(36)}_${(++_rbSeq).toString(36).padStart(4, "0")}`; }

// ═══════════════════════════════════════════════════════════════════
// INTELLIGENCE VERSION CONTROL
// ═══════════════════════════════════════════════════════════════════

export interface IvcOptions {
  /** Max snapshots per pillar+domain before pruning oldest. Default: 50 */
  maxSnapshotsPerSlot?: number;
  /** Auto-snapshot if successRate drops by this delta. Default: 0.10 */
  autoSnapshotDropThreshold?: number;
  verbose?: boolean;
  /** Called after every rollback */
  onRollback?: (event: RollbackEvent) => void | Promise<void>;
}

export class IntelligenceVersionControl {
  /** pillarId::domain → ordered snapshots (oldest first) */
  private snapshots: Map<string, IntelligenceSnapshot[]> = new Map();
  /** pillarId::domain → current active version */
  private activeVersion: Map<string, number> = new Map();
  private rollbacks: RollbackEvent[] = [];
  private opts: Required<Omit<IvcOptions, "onRollback">> & { onRollback?: IvcOptions["onRollback"] };

  constructor(opts: IvcOptions = {}) {
    this.opts = {
      maxSnapshotsPerSlot:       opts.maxSnapshotsPerSlot       ?? 50,
      autoSnapshotDropThreshold: opts.autoSnapshotDropThreshold ?? 0.10,
      verbose:                   opts.verbose                   ?? false,
      onRollback:                opts.onRollback,
    };
  }

  // ── Snapshot ──────────────────────────────────────────────────────

  snapshot(opts: {
    pillarId:  string;
    domain:    SnapshotDomain;
    policy:    SnapshotPolicy;
    label:     string;
    state:     unknown;
    metrics:   SnapshotMetrics;
    createdBy?: string;
    tags?:     string[];
    notes?:    string;
  }): IntelligenceSnapshot {
    const key      = `${opts.pillarId}::${opts.domain}`;
    const existing = this.snapshots.get(key) ?? [];
    const version  = (existing[existing.length - 1]?.version ?? 0) + 1;

    const snap: IntelligenceSnapshot = {
      snapshotId: snapId(),
      pillarId:   opts.pillarId,
      domain:     opts.domain,
      policy:     opts.policy,
      version,
      label:      opts.label,
      state:      opts.state,
      metrics:    opts.metrics,
      createdAt:  Date.now(),
      createdBy:  opts.createdBy ?? "unknown",
      tags:       opts.tags  ?? [],
      notes:      opts.notes ?? "",
    };

    existing.push(snap);

    // Prune oldest beyond maxSnapshotsPerSlot
    while (existing.length > this.opts.maxSnapshotsPerSlot) existing.shift();

    this.snapshots.set(key, existing);
    this.activeVersion.set(key, version);

    if (this.opts.verbose) {
      console.log(`[IVC] snapshot pillar=${opts.pillarId} domain=${opts.domain} v=${version} policy=${opts.policy}`);
    }
    return snap;
  }

  // ── Rollback ──────────────────────────────────────────────────────

  rollback(opts: {
    pillarId:    string;
    domain:      SnapshotDomain;
    toVersion:   number;
    reason:      RollbackReason;
    triggeredBy: string;
    notes?:      string;
  }): { snapshot: IntelligenceSnapshot; event: RollbackEvent } {
    const key  = `${opts.pillarId}::${opts.domain}`;
    const snaps = this.snapshots.get(key) ?? [];
    const target = snaps.find((s) => s.version === opts.toVersion);
    if (!target) throw new Error(`IVC: no snapshot v${opts.toVersion} for '${key}'.`);

    const currentVer  = this.activeVersion.get(key) ?? 0;
    const currentSnap = snaps.find((s) => s.version === currentVer);

    const event: RollbackEvent = {
      rollbackId:     rbId(),
      pillarId:       opts.pillarId,
      domain:         opts.domain,
      fromVersion:    currentVer,
      toVersion:      opts.toVersion,
      fromSnapshotId: currentSnap?.snapshotId ?? "",
      toSnapshotId:   target.snapshotId,
      reason:         opts.reason,
      triggeredBy:    opts.triggeredBy,
      metricsBefore:  currentSnap?.metrics ?? target.metrics,
      metricsAfter:   null,
      rolledBackAt:   Date.now(),
      notes:          opts.notes ?? "",
    };

    this.activeVersion.set(key, opts.toVersion);
    this.rollbacks.push(event);

    if (this.opts.verbose) {
      console.log(`[IVC] rollback pillar=${opts.pillarId} domain=${opts.domain} ${currentVer}→${opts.toVersion} reason=${opts.reason}`);
    }
    this.opts.onRollback?.(event);
    return { snapshot: target, event };
  }

  /** Rollback to the most recent snapshot before a performance drop. */
  rollbackToLastStable(
    pillarId:    string,
    domain:      SnapshotDomain,
    minRate:     number,
    reason:      RollbackReason,
    triggeredBy: string
  ): { snapshot: IntelligenceSnapshot; event: RollbackEvent } | null {
    const key   = `${pillarId}::${domain}`;
    const snaps = [...(this.snapshots.get(key) ?? [])].reverse();
    const stable = snaps.find((s) => s.metrics.successRate >= minRate);
    if (!stable) return null;
    return this.rollback({ pillarId, domain, toVersion: stable.version, reason, triggeredBy });
  }

  // ── Auto-snapshot check ───────────────────────────────────────────

  /**
   * Call after every telemetry flush. If successRate has dropped by
   * more than autoSnapshotDropThreshold since the last snapshot,
   * take an AUTO snapshot before the state degrades further.
   */
  autoCheck(
    pillarId: string,
    domain:   SnapshotDomain,
    currentState: unknown,
    currentMetrics: SnapshotMetrics
  ): IntelligenceSnapshot | null {
    const key    = `${pillarId}::${domain}`;
    const snaps  = this.snapshots.get(key) ?? [];
    const last   = snaps[snaps.length - 1];
    if (!last) {
      return this.snapshot({ pillarId, domain, policy: "AUTO", label: "initial-auto", state: currentState, metrics: currentMetrics, createdBy: "auto-check" });
    }
    const drop = last.metrics.successRate - currentMetrics.successRate;
    if (drop >= this.opts.autoSnapshotDropThreshold) {
      return this.snapshot({ pillarId, domain, policy: "AUTO", label: `auto-before-drop-${Date.now()}`, state: currentState, metrics: currentMetrics, createdBy: "auto-check", notes: `Triggered by ${(drop * 100).toFixed(1)}% successRate drop` });
    }
    return null;
  }

  // ── Query ─────────────────────────────────────────────────────────

  getSnapshots(pillarId: string, domain: SnapshotDomain): IntelligenceSnapshot[] {
    return [...(this.snapshots.get(`${pillarId}::${domain}`) ?? [])];
  }

  getActive(pillarId: string, domain: SnapshotDomain): IntelligenceSnapshot | null {
    const key   = `${pillarId}::${domain}`;
    const ver   = this.activeVersion.get(key);
    const snaps = this.snapshots.get(key) ?? [];
    return snaps.find((s) => s.version === ver) ?? null;
  }

  getRollbacks(pillarId?: string): RollbackEvent[] {
    const all = [...this.rollbacks].reverse();
    return pillarId ? all.filter((r) => r.pillarId === pillarId) : all;
  }

  // ── Diff ──────────────────────────────────────────────────────────

  diff(
    pillarId: string,
    domain:   SnapshotDomain,
    versionA: number,
    versionB: number
  ): DiffResult {
    const key   = `${pillarId}::${domain}`;
    const snaps = this.snapshots.get(key) ?? [];
    const a     = snaps.find((s) => s.version === versionA);
    const b     = snaps.find((s) => s.version === versionB);
    if (!a || !b) throw new Error(`IVC diff: snapshot v${!a ? versionA : versionB} not found for '${key}'.`);

    const aKeys = new Set(Object.keys(a.state as Record<string, unknown> ?? {}));
    const bKeys = new Set(Object.keys(b.state as Record<string, unknown> ?? {}));
    const changed: string[] = [];
    for (const k of new Set([...aKeys, ...bKeys])) {
      if (JSON.stringify((a.state as Record<string, unknown>)?.[k]) !== JSON.stringify((b.state as Record<string, unknown>)?.[k])) {
        changed.push(k);
      }
    }

    const md = {
      successRateDelta: b.metrics.successRate  - a.metrics.successRate,
      confidenceDelta:  b.metrics.avgConfidence - a.metrics.avgConfidence,
      latencyDelta:     b.metrics.avgLatencyMs  - a.metrics.avgLatencyMs,
      stcScoreDelta:    b.metrics.stcScore       - a.metrics.stcScore,
    };

    const direction = md.successRateDelta >= 0 ? "improved" : "degraded";
    const summary   = `${pillarId}/${domain} v${versionA}→v${versionB}: successRate ${direction} by ${Math.abs(md.successRateDelta * 100).toFixed(1)}%; ${changed.length} config key(s) changed.`;

    return { pillarId, domain, snapshotA: a.snapshotId, snapshotB: b.snapshotId, versionA, versionB, metricsDelta: md, changedKeys: changed, summary };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatSnapshot(s: IntelligenceSnapshot): string {
  return [
    `Snapshot [${s.snapshotId}]  ${s.pillarId}/${s.domain}  v${s.version}  ${s.policy}`,
    `  label="${s.label}"  by=${s.createdBy}  ${new Date(s.createdAt).toISOString()}`,
    `  successRate=${(s.metrics.successRate * 100).toFixed(1)}%  confidence=${s.metrics.avgConfidence.toFixed(3)}  latency=${s.metrics.avgLatencyMs}ms  stc=${s.metrics.stcScore.toFixed(3)}`,
  ].join("\n");
}

export function formatRollbackEvent(e: RollbackEvent): string {
  return `Rollback [${e.rollbackId}] ${e.pillarId}/${e.domain} v${e.fromVersion}→v${e.toVersion}  reason=${e.reason}  by=${e.triggeredBy}  ${new Date(e.rolledBackAt).toISOString()}`;
}

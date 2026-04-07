/**
 * toolbox/tools/intelligence-core/bandit-strategy-manager.ts
 * version: 1.0.0
 *
 * Pillar 28: Bandit Strategy Manager
 * Domain: AUTONOMOUS-SOVEREIGNTY
 *
 * Multi-armed bandit allocation layer for prompt variant selection.
 * Allocates a configurable fraction of agent calls to Experimental
 * (CANDIDATE) mutation prompts while the rest exploit the current
 * ACTIVE best-known prompt.
 *
 * Default allocation: 20% explore / 80% exploit
 *
 * Supported strategies:
 *   EPSILON_GREEDY   — explore with probability ε, exploit otherwise
 *   UCB1             — Upper Confidence Bound; balances exploration
 *                      by rewarding under-tested arms
 *   THOMPSON         — Beta-distribution Thompson Sampling;
 *                      samples from posterior belief over each arm
 *   FIXED_SPLIT      — static 80/20 (or configured ratio)
 *
 * "Arm" = one PromptRecord from the PromptArchive.
 * Each arm tracks: pulls, successes, failures, avgReward.
 *
 * Pure TypeScript — no external dependencies.
 */

import type { PromptRecord, PromptArchive } from "../linguistic-forge/prompt-archive.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type BanditStrategy = "EPSILON_GREEDY" | "UCB1" | "THOMPSON" | "FIXED_SPLIT";

export interface ArmStats {
  promptId:     string;
  promptName:   string;
  isExploit:    boolean;   // true = ACTIVE prompt; false = CANDIDATE mutation
  pulls:        number;
  successes:    number;
  failures:     number;
  avgReward:    number;    // [0, 1] — rolling success rate
  ucbScore:     number;    // UCB1 score (updated after each pull)
  alphaParam:   number;    // Beta distribution α (successes + 1)
  betaParam:    number;    // Beta distribution β (failures + 1)
  lastPulledAt: number | null;
}

export interface BanditDecision {
  arm:        ArmStats;
  promptId:   string;
  strategy:   BanditStrategy;
  isExplore:  boolean;
  decidedAt:  number;
}

export interface BanditReport {
  pillarId:        string;
  strategy:        BanditStrategy;
  totalPulls:      number;
  exploitPulls:    number;
  explorePulls:    number;
  exploreRatio:    number;
  bestArmId:       string;
  bestArmReward:   number;
  arms:            ArmStats[];
  generatedAt:     number;
}

// ═══════════════════════════════════════════════════════════════════
// THOMPSON SAMPLING HELPER
// ═══════════════════════════════════════════════════════════════════

/** Sample from a Beta(α, β) distribution using the Johnk method. */
function betaSample(alpha: number, beta: number): number {
  // Johnk's method: X = Gamma(α) / (Gamma(α) + Gamma(β))
  const gammaSample = (shape: number): number => {
    if (shape < 1) return gammaSample(1 + shape) * Math.pow(Math.random(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do { x = normalSample(); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const gA = gammaSample(alpha);
  const gB = gammaSample(beta);
  return gA / (gA + gB);
}

function normalSample(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ═══════════════════════════════════════════════════════════════════
// BANDIT STRATEGY MANAGER
// ═══════════════════════════════════════════════════════════════════

export interface BanditOptions {
  strategy?:       BanditStrategy;
  /** Exploration probability for EPSILON_GREEDY. Default: 0.20 */
  epsilon?:        number;
  /** For FIXED_SPLIT: explore fraction. Default: 0.20 */
  exploreFraction?: number;
  /** UCB1 exploration constant. Default: 1.41 (√2) */
  ucbC?:           number;
  verbose?:        boolean;
}

export class BanditStrategyManager {
  private arms:    Map<string, Map<string, ArmStats>> = new Map(); // pillarId → promptId → ArmStats
  private opts:    Required<BanditOptions>;
  private totalPullsByPillar: Map<string, number> = new Map();

  constructor(
    private readonly archive: PromptArchive,
    opts: BanditOptions = {}
  ) {
    this.opts = {
      strategy:        opts.strategy        ?? "EPSILON_GREEDY",
      epsilon:         opts.epsilon         ?? 0.20,
      exploreFraction: opts.exploreFraction ?? 0.20,
      ucbC:            opts.ucbC            ?? Math.SQRT2,
      verbose:         opts.verbose         ?? false,
    };
  }

  // ── Arm sync from archive ─────────────────────────────────────────

  /**
   * Sync arms from the PromptArchive.
   * ACTIVE prompts → exploit arms
   * CANDIDATE prompts → explore arms
   */
  async syncArms(pillarId: string): Promise<void> {
    const [activePrompts, candidatePrompts] = await Promise.all([
      this.archive.getActive(pillarId),
      this.archive.getCandidates(pillarId),
    ]);

    if (!this.arms.has(pillarId)) this.arms.set(pillarId, new Map());
    const pillarArms = this.arms.get(pillarId)!;

    for (const p of [...activePrompts, ...candidatePrompts]) {
      if (!pillarArms.has(p.promptId)) {
        pillarArms.set(p.promptId, this._newArm(p, activePrompts.some((a) => a.promptId === p.promptId)));
      }
    }
    this._recomputeUcb(pillarId);
  }

  // ── Select ───────────────────────────────────────────────────────

  /**
   * Select a prompt for the next agent invocation.
   * Syncs arms first if none exist for the pillar.
   */
  async select(pillarId: string): Promise<BanditDecision> {
    if (!this.arms.has(pillarId) || this.arms.get(pillarId)!.size === 0) {
      await this.syncArms(pillarId);
    }

    const pillarArms = [...(this.arms.get(pillarId) ?? new Map()).values()];
    if (pillarArms.length === 0) throw new Error(`BanditStrategyManager: no arms for pillar '${pillarId}'.`);

    let selected: ArmStats;
    let isExplore: boolean;

    switch (this.opts.strategy) {
      case "EPSILON_GREEDY":
        ({ selected, isExplore } = this._epsilonGreedy(pillarArms));
        break;
      case "UCB1":
        ({ selected, isExplore } = this._ucb1(pillarArms, pillarId));
        break;
      case "THOMPSON":
        ({ selected, isExplore } = this._thompson(pillarArms));
        break;
      case "FIXED_SPLIT":
        ({ selected, isExplore } = this._fixedSplit(pillarArms));
        break;
    }

    const total = (this.totalPullsByPillar.get(pillarId) ?? 0) + 1;
    this.totalPullsByPillar.set(pillarId, total);

    if (this.opts.verbose) {
      console.log(`[Bandit] ${pillarId} → ${selected.promptId}  explore=${isExplore}  strategy=${this.opts.strategy}  pulls=${selected.pulls}`);
    }

    return {
      arm:       selected,
      promptId:  selected.promptId,
      strategy:  this.opts.strategy,
      isExplore,
      decidedAt: Date.now(),
    };
  }

  // ── Record reward ─────────────────────────────────────────────────

  /** Record the outcome of a pull and update arm statistics. */
  recordReward(
    pillarId:  string,
    promptId:  string,
    success:   boolean,
    confidence = 1.0
  ): void {
    const arm = this.arms.get(pillarId)?.get(promptId);
    if (!arm) return;

    arm.pulls++;
    arm.lastPulledAt = Date.now();
    const reward = success ? confidence : 0;

    if (success) arm.successes++;
    else         arm.failures++;

    // Rolling average reward
    arm.avgReward = (arm.avgReward * (arm.pulls - 1) + reward) / arm.pulls;

    // Beta params for Thompson Sampling
    arm.alphaParam = arm.successes + 1;
    arm.betaParam  = arm.failures  + 1;

    this._recomputeUcb(pillarId);
  }

  // ── Report ────────────────────────────────────────────────────────

  getReport(pillarId: string): BanditReport {
    const arms = [...(this.arms.get(pillarId) ?? new Map()).values()];
    const total = this.totalPullsByPillar.get(pillarId) ?? 0;
    const exploitPulls = arms.filter((a) => a.isExploit).reduce((s, a) => s + a.pulls, 0);
    const explorePulls = arms.filter((a) => !a.isExploit).reduce((s, a) => s + a.pulls, 0);
    const best = arms.sort((a, b) => b.avgReward - a.avgReward)[0];

    return {
      pillarId,
      strategy:       this.opts.strategy,
      totalPulls:     total,
      exploitPulls,
      explorePulls,
      exploreRatio:   total > 0 ? explorePulls / total : 0,
      bestArmId:      best?.promptId ?? "",
      bestArmReward:  best?.avgReward ?? 0,
      arms:           arms.sort((a, b) => b.avgReward - a.avgReward),
      generatedAt:    Date.now(),
    };
  }

  // ── Strategy implementations ──────────────────────────────────────

  private _epsilonGreedy(arms: ArmStats[]): { selected: ArmStats; isExplore: boolean } {
    if (Math.random() < this.opts.epsilon) {
      const exploreCandidates = arms.filter((a) => !a.isExploit);
      const pool = exploreCandidates.length > 0 ? exploreCandidates : arms;
      return { selected: pool[Math.floor(Math.random() * pool.length)], isExplore: true };
    }
    const exploit = arms.filter((a) => a.isExploit);
    const pool    = exploit.length > 0 ? exploit : arms;
    const best    = pool.reduce((a, b) => a.avgReward >= b.avgReward ? a : b);
    return { selected: best, isExplore: false };
  }

  private _ucb1(arms: ArmStats[], pillarId: string): { selected: ArmStats; isExplore: boolean } {
    const total = this.totalPullsByPillar.get(pillarId) ?? 1;
    // Unpulled arms always selected first
    const unpulled = arms.find((a) => a.pulls === 0);
    if (unpulled) return { selected: unpulled, isExplore: !unpulled.isExploit };
    const best = arms.reduce((a, b) => a.ucbScore >= b.ucbScore ? a : b);
    return { selected: best, isExplore: !best.isExploit };
  }

  private _thompson(arms: ArmStats[]): { selected: ArmStats; isExplore: boolean } {
    let best: ArmStats = arms[0];
    let bestSample = -1;
    for (const arm of arms) {
      const sample = betaSample(arm.alphaParam, arm.betaParam);
      if (sample > bestSample) { bestSample = sample; best = arm; }
    }
    return { selected: best, isExplore: !best.isExploit };
  }

  private _fixedSplit(arms: ArmStats[]): { selected: ArmStats; isExplore: boolean } {
    if (Math.random() < this.opts.exploreFraction) {
      const explorers = arms.filter((a) => !a.isExploit);
      if (explorers.length > 0) {
        return { selected: explorers[Math.floor(Math.random() * explorers.length)], isExplore: true };
      }
    }
    const exploiters = arms.filter((a) => a.isExploit);
    const pool = exploiters.length > 0 ? exploiters : arms;
    const best = pool.reduce((a, b) => a.avgReward >= b.avgReward ? a : b);
    return { selected: best, isExplore: false };
  }

  // ── UCB recompute ─────────────────────────────────────────────────

  private _recomputeUcb(pillarId: string): void {
    const arms  = [...(this.arms.get(pillarId) ?? new Map()).values()];
    const total = Math.max(1, arms.reduce((s, a) => s + a.pulls, 0));
    for (const arm of arms) {
      arm.ucbScore = arm.pulls > 0
        ? arm.avgReward + this.opts.ucbC * Math.sqrt(Math.log(total) / arm.pulls)
        : Infinity;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private _newArm(p: PromptRecord, isExploit: boolean): ArmStats {
    const sr = p.fitness.invocations > 0 ? p.fitness.successCount / p.fitness.invocations : 0.5;
    return {
      promptId:     p.promptId,
      promptName:   p.name,
      isExploit,
      pulls:        p.fitness.invocations,
      successes:    p.fitness.successCount,
      failures:     p.fitness.abandonCount + p.fitness.retryCount,
      avgReward:    sr,
      ucbScore:     Infinity,
      alphaParam:   p.fitness.successCount + 1,
      betaParam:    (p.fitness.abandonCount + p.fitness.retryCount) + 1,
      lastPulledAt: p.fitness.lastEvaluatedAt,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatBanditReport(r: BanditReport): string {
  const explorePercent = (r.exploreRatio * 100).toFixed(1);
  const lines = [
    `Bandit Report — pillar=${r.pillarId}  strategy=${r.strategy}  pulls=${r.totalPulls}  explore=${explorePercent}%`,
    `  Best arm: ${r.bestArmId.slice(0, 20)}  reward=${(r.bestArmReward * 100).toFixed(1)}%`,
    "  Arms:",
  ];
  for (const arm of r.arms.slice(0, 8)) {
    const type = arm.isExploit ? "EXPLOIT" : "EXPLORE";
    lines.push(`    [${type}] ${arm.promptName.padEnd(28)} reward=${(arm.avgReward * 100).toFixed(1)}%  pulls=${arm.pulls}  α=${arm.alphaParam}  β=${arm.betaParam}`);
  }
  return lines.join("\n");
}

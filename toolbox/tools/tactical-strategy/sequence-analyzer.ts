/**
 * toolbox/tools/tactical-strategy/sequence-analyzer.ts
 * version: 1.0.0
 *
 * Pillar 24: Tool Arbitration Layer
 * Domain: Strategic-Emergence
 *
 * Tracks the Chain of Invocation for every successful task and
 * distils recurring patterns into Strategic Blueprints — ordered
 * tool sequences that agents can use as hints when planning a task.
 *
 * Concepts:
 *
 *   InvocationChain
 *     A complete sequence of tool calls made during one task execution.
 *     Each step records: toolId, input_hash, output_hash, latencyMs, outcome.
 *     The chain is closed with an overall outcome (SUCCESS | PARTIAL | FAILED).
 *
 *   StrategyBlueprint
 *     A generalised tool sequence extracted from multiple successful chains.
 *     Includes: orderedToolIds[], frequency (how many chains matched),
 *     avgTotalLatencyMs, avgChainConfidence, pillarId, capabilityContext.
 *     Blueprints are passed as hints to the ArbitrationEngine so agents
 *     can skip costly exploration and follow proven paths.
 *
 *   PatternMining
 *     Sequential pattern mining using a sliding-window frequent-sequence
 *     algorithm (no external ML libraries).
 *     A sequence is "frequent" if it appears in ≥ minSupport fraction
 *     of successful chains.
 *
 * Pure TypeScript — no external dependencies.
 */

import { hashPayload } from "../evolution-engine/telemetry-logger.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — INVOCATION CHAIN
// ═══════════════════════════════════════════════════════════════════

export type ChainOutcome = "SUCCESS" | "PARTIAL" | "FAILED";

export interface ChainStep {
  stepIndex:   number;
  toolId:      string;
  inputHash:   string;
  outputHash:  string;
  latencyMs:   number;
  outcome:     "SUCCESS" | "RETRY" | "ABANDON";
  confidence:  number;
  /** Optional: tags from the tool's capability set at invocation time */
  capabilityTags: string[];
  calledAt:    number;   // Unix ms
}

export interface InvocationChain {
  chainId:     string;
  /** Agent or orchestrator that executed this chain */
  agentId:     string;
  pillarId:    string;
  /** High-level goal description (for grouping / search) */
  goalLabel:   string;
  steps:       ChainStep[];
  outcome:     ChainOutcome;
  totalLatencyMs: number;
  avgConfidence:  number;
  /** A hash of the ordered toolId sequence — used for duplicate detection */
  sequenceHash:   string;
  startedAt:   number;
  completedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — STRATEGIC BLUEPRINT
// ═══════════════════════════════════════════════════════════════════

export interface BlueprintStep {
  toolId:          string;
  capabilityTags:  string[];
  /** Average confidence across all chains at this position */
  avgConfidence:   number;
  /** Average latency at this step position across all chains */
  avgLatencyMs:    number;
  /** Fraction of chains where this exact step succeeded */
  successRate:     number;
}

export interface StrategyBlueprint {
  blueprintId:     string;
  /** Ordered list of tool IDs in the sequence */
  toolSequence:    string[];
  /** Enriched step metadata */
  steps:           BlueprintStep[];
  /** Pillar this blueprint was extracted from */
  pillarId:        string;
  /** Goal labels of chains that produced this blueprint */
  goalLabels:      string[];
  /** Number of successful chains this blueprint was derived from */
  frequency:       number;
  /** Fraction of total successful chains that match this sequence */
  support:         number;
  avgTotalLatencyMs: number;
  avgChainConfidence: number;
  /** Confidence that this blueprint will succeed on the next run */
  predictedSuccessRate: number;
  generatedAt:     number;
}

// ═══════════════════════════════════════════════════════════════════
// CHAIN ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _chainSeq = 0;
export function generateChainId(): string {
  return `chn_${Date.now().toString(36)}_${(++_chainSeq).toString(36).padStart(4, "0")}`;
}

let _bpSeq = 0;
function generateBlueprintId(): string {
  return `bp_${Date.now().toString(36)}_${(++_bpSeq).toString(36).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════
// CHAIN BUILDER  (fluent API for recording during execution)
// ═══════════════════════════════════════════════════════════════════

export class ChainBuilder {
  private steps: ChainStep[] = [];
  private startedAt: number  = Date.now();

  constructor(
    private readonly agentId:   string,
    private readonly pillarId:  string,
    private readonly goalLabel: string
  ) {}

  /** Record a single tool invocation step. */
  step(
    toolId:     string,
    input:      unknown,
    output:     unknown,
    latencyMs:  number,
    outcome:    ChainStep["outcome"],
    confidence: number,
    capabilityTags: string[] = []
  ): this {
    this.steps.push({
      stepIndex:      this.steps.length,
      toolId,
      inputHash:      hashPayload(input),
      outputHash:     hashPayload(output),
      latencyMs:      Math.max(0, Math.round(latencyMs)),
      outcome,
      confidence,
      capabilityTags,
      calledAt:       Date.now(),
    });
    return this;
  }

  /** Finalise the chain with an overall outcome. */
  build(outcome: ChainOutcome): InvocationChain {
    const completedAt     = Date.now();
    const totalLatency    = this.steps.reduce((s, st) => s + st.latencyMs, 0);
    const avgConf         = this.steps.length > 0
      ? this.steps.reduce((s, st) => s + st.confidence, 0) / this.steps.length
      : 0;
    const seqHash         = hashPayload(this.steps.map((s) => s.toolId));

    return {
      chainId:        generateChainId(),
      agentId:        this.agentId,
      pillarId:       this.pillarId,
      goalLabel:      this.goalLabel,
      steps:          [...this.steps],
      outcome,
      totalLatencyMs: totalLatency,
      avgConfidence:  avgConf,
      sequenceHash:   seqHash,
      startedAt:      this.startedAt,
      completedAt,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SEQUENCE ANALYZER
// ═══════════════════════════════════════════════════════════════════

export interface SequenceAnalyzerOptions {
  /**
   * Minimum fraction of successful chains a sequence must appear in
   * to be promoted to a StrategyBlueprint. Default: 0.20
   */
  minSupport?:      number;
  /**
   * Minimum sequence length (number of steps) to consider.
   * Default: 2
   */
  minLength?:       number;
  /**
   * Maximum sequence length. Prevents combinatorial explosion.
   * Default: 8
   */
  maxLength?:       number;
  /**
   * Maximum number of chains to retain in memory.
   * Oldest are dropped when exceeded. Default: 1 000
   */
  maxChains?:       number;
  /**
   * Maximum number of blueprints to retain.
   * Lowest-frequency blueprints are pruned. Default: 50
   */
  maxBlueprints?:   number;
  verbose?:         boolean;
}

export class SequenceAnalyzer {
  private chains:     InvocationChain[]  = [];
  private blueprints: StrategyBlueprint[] = [];
  private opts:       Required<SequenceAnalyzerOptions>;

  constructor(opts: SequenceAnalyzerOptions = {}) {
    this.opts = {
      minSupport:    opts.minSupport    ?? 0.20,
      minLength:     opts.minLength     ?? 2,
      maxLength:     opts.maxLength     ?? 8,
      maxChains:     opts.maxChains     ?? 1_000,
      maxBlueprints: opts.maxBlueprints ?? 50,
      verbose:       opts.verbose       ?? false,
    };
  }

  // ── Chain recording ──────────────────────────────────────────────

  /** Record a completed invocation chain. Triggers blueprint mining. */
  record(chain: InvocationChain): void {
    this.chains.push(chain);
    if (this.chains.length > this.opts.maxChains) {
      this.chains.shift();
    }
    if (this.opts.verbose) {
      console.log(`[SequenceAnalyzer] Chain recorded: ${chain.chainId}  outcome=${chain.outcome}  steps=${chain.steps.length}`);
    }
    this._mine();
  }

  /** Create a ChainBuilder scoped to this analyzer. */
  startChain(agentId: string, pillarId: string, goalLabel: string): ChainBuilder {
    return new ChainBuilder(agentId, pillarId, goalLabel);
  }

  /** Build and record a chain in one call. */
  buildAndRecord(builder: ChainBuilder, outcome: ChainOutcome): InvocationChain {
    const chain = builder.build(outcome);
    this.record(chain);
    return chain;
  }

  // ── Blueprint retrieval ──────────────────────────────────────────

  /** Return all blueprints sorted by frequency × confidence (best first). */
  getAllBlueprints(): StrategyBlueprint[] {
    return [...this.blueprints].sort(
      (a, b) => (b.frequency * b.avgChainConfidence) - (a.frequency * a.avgChainConfidence)
    );
  }

  /** Top-N blueprints for a pillar. */
  getBlueprintsForPillar(pillarId: string, limit = 5): StrategyBlueprint[] {
    return this.getAllBlueprints()
      .filter((bp) => bp.pillarId === pillarId)
      .slice(0, limit);
  }

  /**
   * Find the best blueprint for a set of capability tags.
   * A blueprint matches if its step capabilityTags cover all requested tags.
   */
  getBlueprintsForCapabilities(requiredTags: string[], limit = 3): StrategyBlueprint[] {
    return this.getAllBlueprints()
      .filter((bp) => {
        const allBpTags = new Set(bp.steps.flatMap((s) => s.capabilityTags));
        return requiredTags.every((t) => allBpTags.has(t));
      })
      .slice(0, limit);
  }

  /** Best single blueprint for a goal label (substring match). */
  getBlueprintForGoal(goalLabel: string): StrategyBlueprint | null {
    const lc = goalLabel.toLowerCase();
    return this.getAllBlueprints()
      .find((bp) => bp.goalLabels.some((g) => g.toLowerCase().includes(lc))) ?? null;
  }

  // ── Chain history ─────────────────────────────────────────────────

  getChains(filter?: { pillarId?: string; outcome?: ChainOutcome; agentId?: string }): InvocationChain[] {
    let results = [...this.chains];
    if (filter?.pillarId) results = results.filter((c) => c.pillarId === filter.pillarId);
    if (filter?.outcome)  results = results.filter((c) => c.outcome  === filter.outcome);
    if (filter?.agentId)  results = results.filter((c) => c.agentId  === filter.agentId);
    return results;
  }

  stats(): {
    totalChains:      number;
    successChains:    number;
    partialChains:    number;
    failedChains:     number;
    totalBlueprints:  number;
    uniqueSequences:  number;
  } {
    const succ = this.chains.filter((c) => c.outcome === "SUCCESS").length;
    const part = this.chains.filter((c) => c.outcome === "PARTIAL").length;
    const fail = this.chains.filter((c) => c.outcome === "FAILED").length;
    const uniq = new Set(this.chains.map((c) => c.sequenceHash)).size;
    return {
      totalChains:     this.chains.length,
      successChains:   succ,
      partialChains:   part,
      failedChains:    fail,
      totalBlueprints: this.blueprints.length,
      uniqueSequences: uniq,
    };
  }

  // ── Sequential pattern mining ─────────────────────────────────────

  private _mine(): void {
    const successful = this.chains.filter((c) => c.outcome === "SUCCESS");
    if (successful.length === 0) return;

    const total = successful.length;
    const { minSupport, minLength, maxLength } = this.opts;

    // Build a map of subsequence → matching chain indices
    const seqMap = new Map<string, number[]>();

    for (let ci = 0; ci < successful.length; ci++) {
      const toolIds = successful[ci].steps.map((s) => s.toolId);
      // Generate all contiguous subsequences within [minLength, maxLength]
      for (let start = 0; start < toolIds.length; start++) {
        for (let end = start + minLength; end <= Math.min(start + maxLength, toolIds.length); end++) {
          const sub = toolIds.slice(start, end);
          const key = sub.join("→");
          const existing = seqMap.get(key) ?? [];
          if (!existing.includes(ci)) existing.push(ci);
          seqMap.set(key, existing);
        }
      }
    }

    // Filter by minimum support
    const frequent = [...seqMap.entries()]
      .filter(([, indices]) => indices.length / total >= minSupport)
      .sort(([, a], [, b]) => b.length - a.length);   // most frequent first

    // Build blueprints
    const newBlueprints: StrategyBlueprint[] = [];

    for (const [seqKey, chainIndices] of frequent) {
      const toolSequence = seqKey.split("→");
      const matchingChains = chainIndices.map((i) => successful[i]);

      // Build per-step stats
      const steps: BlueprintStep[] = toolSequence.map((toolId, pos) => {
        const stepsAtPos = matchingChains
          .map((c) => c.steps.find((s) => s.toolId === toolId && s.stepIndex === pos))
          .filter(Boolean) as ChainStep[];

        const allSteps = matchingChains
          .flatMap((c) => c.steps.filter((s) => s.toolId === toolId));

        const avgConf    = allSteps.length > 0
          ? allSteps.reduce((s, st) => s + st.confidence, 0) / allSteps.length
          : 0.5;
        const avgLat     = allSteps.length > 0
          ? allSteps.reduce((s, st) => s + st.latencyMs, 0) / allSteps.length
          : 0;
        const successRate = allSteps.length > 0
          ? allSteps.filter((st) => st.outcome === "SUCCESS").length / allSteps.length
          : 0;
        const capTags    = [...new Set(allSteps.flatMap((st) => st.capabilityTags))];

        return { toolId, capabilityTags: capTags, avgConfidence: avgConf, avgLatencyMs: Math.round(avgLat), successRate };
      });

      const avgTotalLat  = matchingChains.reduce((s, c) => s + c.totalLatencyMs, 0) / matchingChains.length;
      const avgConf      = matchingChains.reduce((s, c) => s + c.avgConfidence, 0) / matchingChains.length;
      const goalLabels   = [...new Set(matchingChains.map((c) => c.goalLabel))];
      const pillarId     = matchingChains[0].pillarId;
      const support      = chainIndices.length / total;

      // Predicted success rate — fraction of matching chains at this support level
      const predictedSR  = Math.min(1, support * (avgConf + 0.5) / 1.5);

      newBlueprints.push({
        blueprintId:          generateBlueprintId(),
        toolSequence,
        steps,
        pillarId,
        goalLabels,
        frequency:            chainIndices.length,
        support,
        avgTotalLatencyMs:    Math.round(avgTotalLat),
        avgChainConfidence:   avgConf,
        predictedSuccessRate: predictedSR,
        generatedAt:          Date.now(),
      });
    }

    // Sort by frequency descending, prune to maxBlueprints
    this.blueprints = newBlueprints
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, this.opts.maxBlueprints);

    if (this.opts.verbose) {
      console.log(`[SequenceAnalyzer] Mined ${this.blueprints.length} blueprints from ${successful.length} successful chains.`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatBlueprint(bp: StrategyBlueprint): string {
  const seq  = bp.toolSequence.map((id, i) => `  ${i + 1}. ${id}`).join("\n");
  return [
    `Blueprint [${bp.blueprintId}]  pillar=${bp.pillarId}  freq=${bp.frequency}  support=${(bp.support * 100).toFixed(1)}%`,
    `  Predicted success: ${(bp.predictedSuccessRate * 100).toFixed(1)}%  avgLat=${bp.avgTotalLatencyMs}ms  avgConf=${bp.avgChainConfidence.toFixed(3)}`,
    `  Goals: ${bp.goalLabels.slice(0, 3).join(", ")}`,
    `  Sequence:`,
    seq,
  ].join("\n");
}

export function formatAnalyzerStats(analyzer: SequenceAnalyzer): string {
  const s = analyzer.stats();
  return [
    `SequenceAnalyzer Stats`,
    `  Chains:     total=${s.totalChains}  success=${s.successChains}  partial=${s.partialChains}  failed=${s.failedChains}`,
    `  Sequences:  unique=${s.uniqueSequences}  blueprints=${s.totalBlueprints}`,
  ].join("\n");
}

export function formatBlueprintHint(bp: StrategyBlueprint): string {
  return `HINT: Use the following proven tool sequence for this task:\n${bp.toolSequence.map((id, i) => `  Step ${i + 1}: ${id}`).join("\n")}\nExpected latency: ~${bp.avgTotalLatencyMs}ms  Predicted success: ${(bp.predictedSuccessRate * 100).toFixed(0)}%`;
}

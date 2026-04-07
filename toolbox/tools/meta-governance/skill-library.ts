/**
 * toolbox/tools/meta-governance/skill-library.ts
 * version: 1.0.0
 *
 * Pillar 32-C: Skill Library
 * Domain: APEX-GOVERNANCE
 *
 * Indexes successful "Chains of Thought" (CoT) as reusable, callable
 * functions available to all spawned agents in the Mainframe.
 *
 * A "Skill" is a named, versioned CoT procedure that has demonstrated
 * high performance (confidence × success rate above the registration
 * threshold). Any agent can look up and invoke a skill by name or
 * capability tag.
 *
 * Skill lifecycle:
 *   CANDIDATE → ACTIVE → DEPRECATED | ARCHIVED
 *
 * Skills are indexed by:
 *   - Exact name (e.g. "taxonomy-classify-image")
 *   - Capability tags (e.g. ["image-analysis", "taxonomy"])
 *   - Pillar origin
 *   - Minimum confidence threshold
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type SkillStatus = "CANDIDATE" | "ACTIVE" | "DEPRECATED" | "ARCHIVED";

export interface SkillStep {
  stepIndex:   number;
  label:       string;
  /** Natural-language instruction for the agent */
  instruction: string;
  /** Tool IDs to invoke at this step (Pillar 24 / manifest IDs) */
  toolIds:     string[];
  /** Expected output format */
  outputSchema: string;
  /** Whether this step can be parallelised with adjacent steps */
  parallel:    boolean;
}

export interface SkillPerformance {
  invocations:  number;
  successes:    number;
  failures:     number;
  avgConfidence: number;
  avgLatencyMs: number;
  lastUsedAt:   number | null;
}

export interface Skill {
  skillId:      string;
  name:         string;
  version:      number;
  description:  string;
  capabilityTags: string[];
  ownerPillar:  string;
  linkedPillars: string[];
  status:       SkillStatus;
  /** Ordered chain of thought steps */
  steps:        SkillStep[];
  /** Full serialised CoT prompt template */
  promptTemplate: string;
  performance:  SkillPerformance;
  /** Min confidence to remain ACTIVE */
  minConfidence: number;
  createdAt:    number;
  promotedAt:   number | null;
  deprecatedAt: number | null;
  notes:        string;
}

export interface SkillInvocationResult {
  skillId:     string;
  skillName:   string;
  success:     boolean;
  confidence:  number;
  latencyMs:   number;
  output:      unknown;
  stepsExecuted: number;
  error?:      string;
}

// ═══════════════════════════════════════════════════════════════════
// ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _skillSeq = 0;
function skillId(): string { return `skl_${Date.now().toString(36)}_${(++_skillSeq).toString(36).padStart(4, "0")}`; }

// ═══════════════════════════════════════════════════════════════════
// SKILL LIBRARY
// ═══════════════════════════════════════════════════════════════════

export type SkillExecutorFn = (skill: Skill, input: unknown) => Promise<SkillInvocationResult>;

export interface SkillLibraryOptions {
  /** Min confidence to auto-promote a CANDIDATE to ACTIVE. Default: 0.80 */
  promotionThreshold?: number;
  /** Min confidence to auto-deprecate an ACTIVE skill. Default: 0.60 */
  deprecationThreshold?: number;
  /** Min invocations before promotion/deprecation checks apply. Default: 5 */
  minInvocations?: number;
  verbose?: boolean;
}

export class SkillLibrary {
  private skills: Map<string, Skill>              = new Map(); // skillId → Skill
  private nameIndex: Map<string, string>           = new Map(); // name → skillId (latest active)
  private tagIndex:  Map<string, Set<string>>      = new Map(); // tag → Set<skillId>
  private opts: Required<SkillLibraryOptions>;

  constructor(opts: SkillLibraryOptions = {}) {
    this.opts = {
      promotionThreshold:   opts.promotionThreshold   ?? 0.80,
      deprecationThreshold: opts.deprecationThreshold ?? 0.60,
      minInvocations:       opts.minInvocations       ?? 5,
      verbose:              opts.verbose              ?? false,
    };
  }

  // ── Registration ─────────────────────────────────────────────────

  register(opts: {
    name:            string;
    description:     string;
    capabilityTags:  string[];
    ownerPillar:     string;
    linkedPillars?:  string[];
    steps:           Omit<SkillStep, "stepIndex">[];
    promptTemplate:  string;
    minConfidence?:  number;
    notes?:          string;
    /** If true, immediately ACTIVE; otherwise starts as CANDIDATE. Default: false */
    autoActivate?:   boolean;
  }): Skill {
    const existingId = this.nameIndex.get(opts.name);
    const existing   = existingId ? this.skills.get(existingId) : null;
    const version    = (existing?.version ?? 0) + 1;

    const skill: Skill = {
      skillId:        skillId(),
      name:           opts.name,
      version,
      description:    opts.description,
      capabilityTags: opts.capabilityTags,
      ownerPillar:    opts.ownerPillar,
      linkedPillars:  opts.linkedPillars  ?? [],
      status:         opts.autoActivate   ? "ACTIVE" : "CANDIDATE",
      steps:          opts.steps.map((s, i) => ({ ...s, stepIndex: i })),
      promptTemplate: opts.promptTemplate,
      performance:    { invocations: 0, successes: 0, failures: 0, avgConfidence: 0, avgLatencyMs: 0, lastUsedAt: null },
      minConfidence:  opts.minConfidence  ?? 0.75,
      createdAt:      Date.now(),
      promotedAt:     opts.autoActivate   ? Date.now() : null,
      deprecatedAt:   null,
      notes:          opts.notes          ?? "",
    };

    // Deprecate old version if exists
    if (existing && existing.status === "ACTIVE") {
      existing.status      = "DEPRECATED";
      existing.deprecatedAt = Date.now();
      this.skills.set(existing.skillId, existing);
    }

    this.skills.set(skill.skillId, skill);
    if (skill.status === "ACTIVE") this.nameIndex.set(opts.name, skill.skillId);

    for (const tag of opts.capabilityTags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(skill.skillId);
    }

    if (this.opts.verbose) console.log(`[SkillLib] registered "${opts.name}" v${version} status=${skill.status}`);
    return skill;
  }

  // ── Performance recording ─────────────────────────────────────────

  recordInvocation(
    skillId:    string,
    success:    boolean,
    confidence: number,
    latencyMs:  number
  ): void {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    const p = skill.performance;
    p.invocations++;
    if (success) p.successes++; else p.failures++;
    p.avgConfidence = (p.avgConfidence * (p.invocations - 1) + confidence) / p.invocations;
    p.avgLatencyMs  = (p.avgLatencyMs  * (p.invocations - 1) + latencyMs)  / p.invocations;
    p.lastUsedAt    = Date.now();

    this.skills.set(skillId, skill);
    this._checkLifecycle(skill);
  }

  // ── Lookup ────────────────────────────────────────────────────────

  findByName(name: string): Skill | null {
    const id = this.nameIndex.get(name);
    return id ? (this.skills.get(id) ?? null) : null;
  }

  findByTags(tags: string[], requireAll = false): Skill[] {
    const candidates = new Map<string, number>(); // skillId → match count
    for (const tag of tags) {
      for (const id of (this.tagIndex.get(tag) ?? [])) {
        candidates.set(id, (candidates.get(id) ?? 0) + 1);
      }
    }
    const results: Skill[] = [];
    for (const [id, count] of candidates) {
      if (requireAll && count < tags.length) continue;
      const skill = this.skills.get(id);
      if (skill && skill.status === "ACTIVE") results.push(skill);
    }
    return results.sort((a, b) => b.performance.avgConfidence - a.performance.avgConfidence);
  }

  findByPillar(pillarId: string): Skill[] {
    return [...this.skills.values()].filter((s) => s.ownerPillar === pillarId || s.linkedPillars.includes(pillarId));
  }

  getActive(): Skill[] {
    return [...this.skills.values()].filter((s) => s.status === "ACTIVE").sort((a, b) => b.performance.avgConfidence - a.performance.avgConfidence);
  }

  get(skillId: string): Skill | null { return this.skills.get(skillId) ?? null; }

  // ── Execution ─────────────────────────────────────────────────────

  /**
   * Invoke a skill by name using the provided executor function.
   * The executor receives the full Skill record so it can parse
   * steps and promptTemplate.
   */
  async invoke(
    name:     string,
    input:    unknown,
    executor: SkillExecutorFn
  ): Promise<SkillInvocationResult> {
    const skill = this.findByName(name);
    if (!skill) throw new Error(`SkillLibrary: skill "${name}" not found or not ACTIVE.`);

    const start = Date.now();
    try {
      const result = await executor(skill, input);
      this.recordInvocation(skill.skillId, result.success, result.confidence, Date.now() - start);
      return result;
    } catch (err) {
      this.recordInvocation(skill.skillId, false, 0, Date.now() - start);
      return { skillId: skill.skillId, skillName: skill.name, success: false, confidence: 0, latencyMs: Date.now() - start, output: null, stepsExecuted: 0, error: String(err) };
    }
  }

  // ── Lifecycle management ──────────────────────────────────────────

  promote(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill && skill.status === "CANDIDATE") {
      skill.status     = "ACTIVE";
      skill.promotedAt = Date.now();
      this.nameIndex.set(skill.name, skillId);
      this.skills.set(skillId, skill);
      if (this.opts.verbose) console.log(`[SkillLib] promoted "${skill.name}" v${skill.version}`);
    }
  }

  deprecate(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill && skill.status === "ACTIVE") {
      skill.status       = "DEPRECATED";
      skill.deprecatedAt = Date.now();
      this.nameIndex.delete(skill.name);
      this.skills.set(skillId, skill);
    }
  }

  archive(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill) { skill.status = "ARCHIVED"; this.skills.set(skillId, skill); }
  }

  private _checkLifecycle(skill: Skill): void {
    if (skill.performance.invocations < this.opts.minInvocations) return;
    if (skill.status === "CANDIDATE" && skill.performance.avgConfidence >= this.opts.promotionThreshold) {
      this.promote(skill.skillId);
    } else if (skill.status === "ACTIVE" && skill.performance.avgConfidence < this.opts.deprecationThreshold) {
      this.deprecate(skill.skillId);
      if (this.opts.verbose) console.log(`[SkillLib] auto-deprecated "${skill.name}" — confidence ${(skill.performance.avgConfidence * 100).toFixed(1)}% < threshold`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────

  summary(): { total: number; active: number; candidate: number; deprecated: number; archived: number } {
    const all = [...this.skills.values()];
    return {
      total:      all.length,
      active:     all.filter((s) => s.status === "ACTIVE").length,
      candidate:  all.filter((s) => s.status === "CANDIDATE").length,
      deprecated: all.filter((s) => s.status === "DEPRECATED").length,
      archived:   all.filter((s) => s.status === "ARCHIVED").length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatSkill(skill: Skill): string {
  const p = skill.performance;
  return [
    `Skill [${skill.skillId}]  "${skill.name}"  v${skill.version}  ${skill.status}`,
    `  tags=[${skill.capabilityTags.join(",")}]  owner=${skill.ownerPillar}`,
    `  invocations=${p.invocations}  confidence=${(p.avgConfidence * 100).toFixed(1)}%  latency=${p.avgLatencyMs.toFixed(0)}ms`,
    `  steps=${skill.steps.length}: ${skill.steps.map((s) => s.label).join(" → ")}`,
  ].join("\n");
}

export function formatSkillLibrarySummary(lib: SkillLibrary): string {
  const s = lib.summary();
  const active = lib.getActive().slice(0, 5);
  const lines = [
    `SkillLibrary  total=${s.total}  active=${s.active}  candidate=${s.candidate}  deprecated=${s.deprecated}`,
    "  Top active skills:",
  ];
  for (const skill of active) {
    lines.push(`    "${skill.name.padEnd(30)}" conf=${(skill.performance.avgConfidence * 100).toFixed(1)}%  inv=${skill.performance.invocations}`);
  }
  return lines.join("\n");
}

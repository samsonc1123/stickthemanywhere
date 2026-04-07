/**
 * toolbox/tools/linguistic-forge/mutation-engine.ts
 * version: 1.0.0
 *
 * Pillar 23: Prompt Mutation System
 * Domain: Linguistic-Evolution
 *
 * Evolutionary operators for prompt templates:
 *
 *   Perturbation  — produces 3 variations of a single prompt:
 *     TONE        — rewrites the register (formal/casual/assertive/curious)
 *     STRUCTURE   — reorders instruction blocks and changes sentence forms
 *     CONSTRAINT  — adds/removes/tightens output constraints
 *
 *   Crossover     — merges two high-fitness parents into a single child
 *     INTERLEAVE  — alternates sentence blocks from each parent
 *     PREFIX      — uses parent A's preamble + parent B's body
 *     SUFFIX      — uses parent A's body + parent B's closing
 *
 * Two mutation backends:
 *   createRuleMutator   — deterministic rule-based (no API calls; always works)
 *   createLlmMutator    — OpenAI-powered (richer, context-aware mutations)
 *
 * Pure TypeScript — no external dependencies for createRuleMutator.
 */

import type { PromptRecord, MutationType } from "./prompt-archive.ts";
import { generatePromptId, blankFitness } from "./prompt-archive.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type PerturbationType = "TONE" | "STRUCTURE" | "CONSTRAINT";
export type CrossoverStrategy = "INTERLEAVE" | "PREFIX" | "SUFFIX";

export interface MutationResult {
  parent:   PromptRecord;
  variants: PromptRecord[];
  mutationType: PerturbationType;
}

export interface CrossoverResult {
  parentA:  PromptRecord;
  parentB:  PromptRecord;
  child:    PromptRecord;
  strategy: CrossoverStrategy;
}

export interface MutatorBackend {
  perturb(template: string, type: PerturbationType, context?: string): Promise<string>;
  crossover(templateA: string, templateB: string, strategy: CrossoverStrategy): Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════
// RULE-BASED MUTATOR  (deterministic, no API calls)
// ═══════════════════════════════════════════════════════════════════

// ── Tone maps ────────────────────────────────────────────────────

const FORMAL_SUBS: [RegExp, string][] = [
  [/\byou should\b/gi,   "it is recommended that you"],
  [/\bplease\b/gi,       "kindly"],
  [/\bmake sure\b/gi,    "ensure that"],
  [/\bdon't\b/gi,        "do not"],
  [/\bwon't\b/gi,        "will not"],
  [/\bcan't\b/gi,        "cannot"],
  [/\buse\b/gi,          "utilise"],
  [/\bstart\b/gi,        "commence"],
  [/\bend\b/gi,          "conclude"],
  [/\bget\b/gi,          "obtain"],
];

const CASUAL_SUBS: [RegExp, string][] = [
  [/\bit is recommended that you\b/gi, "you should"],
  [/\bkindly\b/gi,                    "please"],
  [/\bensure that\b/gi,               "make sure"],
  [/\bdo not\b/gi,                    "don't"],
  [/\bwill not\b/gi,                  "won't"],
  [/\bcannot\b/gi,                    "can't"],
  [/\butilise\b/gi,                   "use"],
  [/\bcommence\b/gi,                  "start"],
  [/\bconclude\b/gi,                  "end"],
  [/\bobtain\b/gi,                    "get"],
];

const ASSERTIVE_PREFIX = "Your task is clear and non-negotiable: ";
const CURIOUS_SUFFIX   = "\n\nConsider also: what assumptions might be worth questioning here?";

function applyTone(template: string, tone: "formal" | "casual" | "assertive" | "curious"): string {
  switch (tone) {
    case "formal":
      return FORMAL_SUBS.reduce((t, [pat, rep]) => t.replace(pat, rep), template);
    case "casual":
      return CASUAL_SUBS.reduce((t, [pat, rep]) => t.replace(pat, rep), template);
    case "assertive": {
      const sentences = template.split(/(?<=[.!?])\s+/);
      return ASSERTIVE_PREFIX + sentences.join(" ");
    }
    case "curious":
      return template + CURIOUS_SUFFIX;
  }
}

// ── Structure mutations ──────────────────────────────────────────

function reverseBlocks(template: string): string {
  const blocks = splitBlocks(template);
  return blocks.length > 1 ? blocks.reverse().join("\n\n") : template;
}

function bulletToNumbered(template: string): string {
  let n = 0;
  return template.replace(/^[-*•]\s+/gm, () => `${++n}. `);
}

function numberedToBullet(template: string): string {
  return template.replace(/^\d+\.\s+/gm, "- ");
}

function splitBlocks(template: string): string[] {
  return template.split(/\n{2,}/);
}

// ── Constraint mutations ─────────────────────────────────────────

const CONSTRAINT_ADDITIONS = [
  "\n\nRespond in fewer than 200 words.",
  "\n\nFormat your response as a numbered list.",
  "\n\nDo not include any preamble or explanation — output only the result.",
  "\n\nYour response must be in plain text with no markdown formatting.",
  "\n\nBegin your response with a one-sentence summary.",
];

const CONSTRAINT_REMOVALS = [
  /\n\nRespond in fewer than \d+ words\./gi,
  /\n\nFormat your response as a numbered list\./gi,
  /\n\nDo not include any preamble.*?result\./gi,
  /\n\nYour response must be in plain text.*?formatting\./gi,
  /\n\nBegin your response with a one-sentence summary\./gi,
];

function addConstraint(template: string, seed = 0): string {
  const addition = CONSTRAINT_ADDITIONS[seed % CONSTRAINT_ADDITIONS.length];
  return template + addition;
}

function removeConstraint(template: string): string {
  let t = template;
  for (const pat of CONSTRAINT_REMOVALS) t = t.replace(pat, "");
  return t.trim();
}

// ── Crossover helpers ─────────────────────────────────────────────

function interleaveBlocks(a: string, b: string): string {
  const blocksA = splitBlocks(a);
  const blocksB = splitBlocks(b);
  const merged: string[] = [];
  const len = Math.max(blocksA.length, blocksB.length);
  for (let i = 0; i < len; i++) {
    if (blocksA[i]) merged.push(blocksA[i]);
    if (blocksB[i]) merged.push(blocksB[i]);
  }
  // Deduplicate adjacent identical blocks
  return [...new Set(merged)].join("\n\n");
}

function prefixCrossover(a: string, b: string): string {
  const blocksA = splitBlocks(a);
  const blocksB = splitBlocks(b);
  const prefixA = blocksA.slice(0, Math.ceil(blocksA.length / 2));
  const bodyB   = blocksB.slice(Math.floor(blocksB.length / 2));
  return [...prefixA, ...bodyB].join("\n\n");
}

function suffixCrossover(a: string, b: string): string {
  const blocksA = splitBlocks(a);
  const blocksB = splitBlocks(b);
  const bodyA   = blocksA.slice(0, Math.floor(blocksA.length / 2));
  const suffixB = blocksB.slice(Math.ceil(blocksB.length / 2));
  return [...bodyA, ...suffixB].join("\n\n");
}

// ── Rule mutator factory ──────────────────────────────────────────

export function createRuleMutator(): MutatorBackend {
  return {
    async perturb(template, type) {
      switch (type) {
        case "TONE":
          // Detect current register and flip it
          if (/\bdo not\b|\butilise\b|\bkindly\b/i.test(template)) {
            return applyTone(template, "casual");
          }
          if (/\bdon't\b|\buse\b|\bplease\b/i.test(template)) {
            return applyTone(template, "formal");
          }
          return applyTone(template, "assertive");

        case "STRUCTURE": {
          const blocks = splitBlocks(template);
          if (blocks.length > 1) return reverseBlocks(template);
          if (/^[-*•]/m.test(template)) return bulletToNumbered(template);
          return numberedToBullet(template);
        }

        case "CONSTRAINT": {
          const hasConstraint = CONSTRAINT_REMOVALS.some((pat) => pat.test(template));
          if (hasConstraint) return removeConstraint(template);
          const seed = template.length % CONSTRAINT_ADDITIONS.length;
          return addConstraint(template, seed);
        }
      }
    },

    async crossover(templateA, templateB, strategy) {
      switch (strategy) {
        case "INTERLEAVE": return interleaveBlocks(templateA, templateB);
        case "PREFIX":     return prefixCrossover(templateA, templateB);
        case "SUFFIX":     return suffixCrossover(templateA, templateB);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// LLM-BASED MUTATOR  (OpenAI)
// ═══════════════════════════════════════════════════════════════════

export interface LlmMutatorOptions {
  apiKey:  string;
  model?:  string;   // default: gpt-4o-mini
  baseUrl?: string;  // default: https://api.openai.com/v1
}

export function createLlmMutator(opts: LlmMutatorOptions): MutatorBackend {
  const model   = opts.model   ?? "gpt-4o-mini";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";

  async function chat(systemPrompt: string, userContent: string): Promise<string> {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${opts.apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent },
        ],
        temperature: 0.7,
        max_tokens:  1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await resp.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() ?? "";
  }

  return {
    async perturb(template, type, context) {
      const ctx = context ? `\n\nContext: ${context}` : "";
      const sysMap: Record<PerturbationType, string> = {
        TONE:
          "You are a prompt engineer. Rewrite the given prompt template with a noticeably different tone (e.g. more formal, casual, assertive, or inquisitive). Preserve all {{variable}} placeholders exactly. Return only the rewritten prompt — no explanation.",
        STRUCTURE:
          "You are a prompt engineer. Restructure the given prompt template by reordering its instruction blocks, changing list formats, or altering sentence constructions. Preserve all {{variable}} placeholders exactly. Return only the restructured prompt — no explanation.",
        CONSTRAINT:
          "You are a prompt engineer. Add, remove, or tighten one output constraint in the given prompt template (e.g. word limit, format, scope restriction). Preserve all {{variable}} placeholders exactly. Return only the modified prompt — no explanation.",
      };
      return chat(sysMap[type], `Prompt template:${ctx}\n\n${template}`);
    },

    async crossover(templateA, templateB, strategy) {
      const stratDesc: Record<CrossoverStrategy, string> = {
        INTERLEAVE: "interleave the instruction blocks from both prompts, alternating between them",
        PREFIX:     "use the opening preamble from prompt A and the main body/instructions from prompt B",
        SUFFIX:     "use the main body from prompt A and the closing constraints/instructions from prompt B",
      };
      const system =
        "You are a prompt engineer. You will receive two high-performing prompt templates and must merge them into a single improved prompt using the specified crossover strategy. Preserve all {{variable}} placeholders. Return only the merged prompt — no explanation.";
      const user = [
        `Strategy: ${stratDesc[strategy]}`,
        "",
        "--- Prompt A ---",
        templateA,
        "",
        "--- Prompt B ---",
        templateB,
      ].join("\n");
      return chat(system, user);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// MUTATION ENGINE
// ═══════════════════════════════════════════════════════════════════

export interface MutationEngineOptions {
  /** Backend to use for mutation. Default: createRuleMutator() */
  backend?: MutatorBackend;
  /**
   * Crossover strategy selection order when auto-selecting.
   * Default: ["INTERLEAVE", "PREFIX", "SUFFIX"]
   */
  crossoverOrder?: CrossoverStrategy[];
}

export class MutationEngine {
  private backend: MutatorBackend;
  private crossoverOrder: CrossoverStrategy[];

  constructor(opts: MutationEngineOptions = {}) {
    this.backend        = opts.backend        ?? createRuleMutator();
    this.crossoverOrder = opts.crossoverOrder ?? ["INTERLEAVE", "PREFIX", "SUFFIX"];
  }

  // ── Perturbation ─────────────────────────────────────────────────

  /**
   * Produce 3 variants of a prompt — one per perturbation type.
   * Variants inherit generation = parent.generation + 1.
   */
  async perturb(parent: PromptRecord): Promise<MutationResult[]> {
    const types: PerturbationType[] = ["TONE", "STRUCTURE", "CONSTRAINT"];
    const results: MutationResult[] = [];

    for (const type of types) {
      const mutatedTemplate = await this.backend.perturb(
        parent.template,
        type,
        `pillar=${parent.pillarId} role=${parent.agentRole ?? "general"}`
      );

      const variant: PromptRecord = {
        promptId:     generatePromptId(),
        name:         `${parent.name} [${type}]`,
        template:     mutatedTemplate,
        pillarId:     parent.pillarId,
        agentRole:    parent.agentRole,
        generation:   parent.generation + 1,
        parentIds:    [parent.promptId],
        mutationType: type as MutationType,
        status:       "CANDIDATE",
        fitness:      blankFitness(),
        tags:         [...parent.tags, type.toLowerCase()],
        createdAt:    Date.now(),
        updatedAt:    Date.now(),
      };

      results.push({ parent, variants: [variant], mutationType: type });
    }

    return results;
  }

  /**
   * Produce a single batch of 3 variants and return them flat.
   */
  async perturbAll(parent: PromptRecord): Promise<PromptRecord[]> {
    const results = await this.perturb(parent);
    return results.map((r) => r.variants[0]);
  }

  // ── Crossover ────────────────────────────────────────────────────

  /**
   * Merge two high-fitness parents using a given crossover strategy.
   */
  async crossover(
    parentA:   PromptRecord,
    parentB:   PromptRecord,
    strategy?: CrossoverStrategy
  ): Promise<CrossoverResult> {
    const strat   = strategy ?? this.crossoverOrder[0];
    const merged  = await this.backend.crossover(parentA.template, parentB.template, strat);

    const child: PromptRecord = {
      promptId:     generatePromptId(),
      name:         `${parentA.name} × ${parentB.name} [${strat}]`,
      template:     merged,
      pillarId:     parentA.pillarId,
      agentRole:    parentA.agentRole ?? parentB.agentRole,
      generation:   Math.max(parentA.generation, parentB.generation) + 1,
      parentIds:    [parentA.promptId, parentB.promptId],
      mutationType: "CROSSOVER",
      status:       "CANDIDATE",
      fitness:      blankFitness(),
      tags:         [...new Set([...parentA.tags, ...parentB.tags, "crossover", strat.toLowerCase()])],
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
    };

    return { parentA, parentB, child, strategy: strat };
  }

  /**
   * Produce crossover children using all 3 strategies.
   */
  async crossoverAll(
    parentA: PromptRecord,
    parentB: PromptRecord
  ): Promise<CrossoverResult[]> {
    return Promise.all(
      this.crossoverOrder.map((s) => this.crossover(parentA, parentB, s))
    );
  }

  // ── Elite selection ───────────────────────────────────────────────

  /**
   * Select the top-N prompts from a list by fitness score.
   * Used to feed the next evolutionary round.
   */
  selectElite(prompts: PromptRecord[], n: number): PromptRecord[] {
    return [...prompts]
      .sort((a, b) => b.fitness.score - a.fitness.score)
      .slice(0, n);
  }

  /**
   * Run a full evolutionary round:
   *   1. Select top-2 by fitness
   *   2. Perturb the best
   *   3. Crossover the top-2
   *   Returns all new CANDIDATE PromptRecords
   */
  async evolveGeneration(prompts: PromptRecord[]): Promise<PromptRecord[]> {
    if (prompts.length === 0) return [];
    const elite   = this.selectElite(prompts, 2);
    const best    = elite[0];
    const second  = elite[1];

    const perturbations = await this.perturbAll(best);
    const crossovers    = second
      ? (await this.crossoverAll(best, second)).map((r) => r.child)
      : [];

    return [...perturbations, ...crossovers];
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatMutationSummary(parent: PromptRecord, variants: PromptRecord[]): string {
  const lines = [
    `Parent: ${parent.name}  (gen=${parent.generation}, score=${(parent.fitness.score * 100).toFixed(1)}%)`,
    `Produced ${variants.length} variant(s):`,
  ];
  for (const v of variants) {
    lines.push(`  [${v.mutationType.padEnd(10)}] ${v.name}  id=${v.promptId}`);
    lines.push(`    ${v.template.slice(0, 100)}${v.template.length > 100 ? "…" : ""}`);
  }
  return lines.join("\n");
}

export function formatCrossoverSummary(result: CrossoverResult): string {
  return [
    `Crossover [${result.strategy}]`,
    `  Parent A: ${result.parentA.name}  score=${(result.parentA.fitness.score * 100).toFixed(1)}%`,
    `  Parent B: ${result.parentB.name}  score=${(result.parentB.fitness.score * 100).toFixed(1)}%`,
    `  Child:    ${result.child.name}  id=${result.child.promptId}`,
    `  Template: ${result.child.template.slice(0, 100)}${result.child.template.length > 100 ? "…" : ""}`,
  ].join("\n");
}

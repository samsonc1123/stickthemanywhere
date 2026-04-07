/**
 * toolbox/tools/intelligence-core/recursive-decomposer.ts
 * version: 1.0.0
 *
 * Pillar 26: Recursive Decomposition
 * Domain: AUTONOMOUS-SOVEREIGNTY
 *
 * Breaks a high-level Objective into a depth-bounded task-tree where
 * every node is a concrete, executable unit of work.
 *
 * Key properties:
 *   - Depth limiting:  maxDepth cap prevents infinite recursion.
 *   - Cost tracking:   every node carries an estimated compute cost
 *                      and the tree rolls up a total cost budget.
 *   - Pruning:         sub-trees whose cumulative cost exceeds
 *                      `costBudget` are automatically pruned and
 *                      flagged as DEFERRED.
 *   - Capability tagging: each leaf is annotated with the
 *                      capability tags the Arbitration Engine needs.
 *
 * Pure TypeScript — no external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type TaskStatus =
  | "PENDING"    // not yet started
  | "ACTIVE"     // currently running
  | "COMPLETE"   // finished successfully
  | "FAILED"     // finished with failure
  | "DEFERRED"   // pruned due to cost budget
  | "BLOCKED";   // depends on an incomplete parent

export interface TaskNode {
  nodeId:          string;
  /** Human-readable label */
  label:           string;
  /** Full objective text */
  objective:       string;
  /** Depth from root (root = 0) */
  depth:           number;
  /** ID of parent node; null for root */
  parentId:        string | null;
  /** IDs of child nodes */
  childIds:        string[];
  /** Whether this node is a leaf (no children) */
  isLeaf:          boolean;
  status:          TaskStatus;
  /** Estimated compute cost for this node alone */
  estimatedCost:   number;
  /** Cumulative cost of this node + all descendants */
  cumulativeCost:  number;
  /** Capability tags required to execute this node */
  capabilityTags:  string[];
  /** Tool IDs suggested by the Arbitration Engine */
  suggestedTools:  string[];
  /** Which pillar should handle this task */
  pillarId:        string;
  /** Decomposition rationale */
  rationale:       string;
  createdAt:       number;
  completedAt:     number | null;
}

export interface TaskTree {
  treeId:          string;
  rootNodeId:      string;
  objectiveLabel:  string;
  nodes:           Map<string, TaskNode>;
  totalCost:       number;
  maxDepthReached: number;
  leafCount:       number;
  deferredCount:   number;
  createdAt:       number;
}

export interface DecompositionConfig {
  /** Maximum tree depth. Default: 5 */
  maxDepth?:    number;
  /** Maximum total compute cost before pruning. Default: 100 */
  costBudget?:  number;
  /** Estimated cost per node at each depth tier */
  costPerDepth?: Record<number, number>;
  /** Default pillar to assign leaf tasks */
  defaultPillar?: string;
}

/** A function that decomposes one objective into sub-objectives. */
export type DecomposeFn = (
  objective: string,
  depth:     number,
  context:   string
) => Promise<Array<{
  label:          string;
  objective:      string;
  estimatedCost:  number;
  capabilityTags: string[];
  suggestedTools: string[];
  pillarId:       string;
  rationale:      string;
  isLeaf:         boolean;
}>>;

// ═══════════════════════════════════════════════════════════════════
// ID GENERATOR
// ═══════════════════════════════════════════════════════════════════

let _nodeSeq = 0;
let _treeSeq = 0;

function nodeId(): string {
  return `nd_${Date.now().toString(36)}_${(++_nodeSeq).toString(36).padStart(4, "0")}`;
}
function treeId(): string {
  return `tr_${Date.now().toString(36)}_${(++_treeSeq).toString(36).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN DECOMPOSE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Rule-based decomposer — splits objective by conjunctions and
 * assigns capability tags via keyword matching. Zero API calls.
 */
export function createRuleDecomposer(defaultPillar = "core"): DecomposeFn {
  const capabilityMap: [RegExp, string][] = [
    [/classify|tag|label|categori/i,  "taxonomy"],
    [/generat|write|draft|compose/i,  "text-generation"],
    [/image|photo|visual|camera/i,    "image-analysis"],
    [/score|eval|rate|assess/i,       "scoring"],
    [/store|save|persist|record/i,    "data-persistence"],
    [/retrieve|fetch|query|search/i,  "archival"],
    [/agent|run|execute|invoke/i,     "agent-lifecycle"],
    [/sequence|chain|plan|route/i,    "sequence-planning"],
    [/mutate|vary|perturb|evolv/i,    "perturbation"],
    [/report|dashboard|summar/i,      "reporting"],
  ];

  const deriveCapabilityTags = (text: string): string[] => {
    const tags: string[] = [];
    for (const [pat, tag] of capabilityMap) {
      if (pat.test(text)) tags.push(tag);
    }
    return tags.length > 0 ? tags : ["general"];
  };

  return async (objective, depth) => {
    // Split on "and", "then", semicolons, or numbered steps
    const parts = objective
      .replace(/^\d+\.\s*/gm, "\n")
      .split(/\s+and\s+|\s+then\s+|;\s*|\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    if (parts.length <= 1 || depth >= 3) {
      // Leaf
      return [{
        label:         objective.slice(0, 50),
        objective,
        estimatedCost: 2,
        capabilityTags: deriveCapabilityTags(objective),
        suggestedTools: [],
        pillarId:      defaultPillar,
        rationale:     "Leaf node — no further decomposition possible.",
        isLeaf:        true,
      }];
    }

    return parts.map((part) => ({
      label:         part.slice(0, 50),
      objective:     part,
      estimatedCost: 2,
      capabilityTags: deriveCapabilityTags(part),
      suggestedTools: [],
      pillarId:      defaultPillar,
      rationale:     `Split from compound objective at depth ${depth}.`,
      isLeaf:        depth + 1 >= 3,
    }));
  };
}

/**
 * LLM-based decomposer — uses OpenAI to produce a structured
 * sub-task breakdown.
 */
export function createLlmDecomposer(opts: {
  apiKey:   string;
  model?:   string;
  baseUrl?: string;
}): DecomposeFn {
  const model   = opts.model   ?? "gpt-4o-mini";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";

  return async (objective, depth, context) => {
    const system = `You are a task decomposition engine for an autonomous AI system.
Break the given objective into 2–4 concrete sub-tasks.
Each sub-task must be independently executable by a single AI agent.
Respond ONLY with a JSON array. Each element must have:
  label (string, ≤50 chars)
  objective (string — the full sub-task description)
  estimatedCost (integer 1–10 — relative compute cost)
  capabilityTags (string[] — e.g. ["text-generation","scoring"])
  suggestedTools (string[] — tool IDs from the Sovereign Mainframe manifest)
  pillarId (string — which mainframe pillar should handle this)
  rationale (string — one sentence explaining why this sub-task exists)
  isLeaf (boolean — true if no further decomposition is needed)`;

    const user = `Depth: ${depth}
Context: ${context}
Objective: ${objective}`;

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.3, max_tokens: 1024 }),
        signal: AbortSignal.timeout(30_000),
      });
      const data   = await resp.json() as { choices: { message: { content: string } }[] };
      const raw    = data.choices[0]?.message?.content?.trim() ?? "[]";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("[Decomposer] LLM call failed, falling back to rule decomposer:", err);
      return createRuleDecomposer()(objective, depth, context);
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// RECURSIVE DECOMPOSER
// ═══════════════════════════════════════════════════════════════════

export class RecursiveDecomposer {
  private maxDepth:    number;
  private costBudget:  number;
  private costPerDepth: Record<number, number>;

  constructor(
    private readonly decomposeFn: DecomposeFn,
    private readonly config:      DecompositionConfig = {}
  ) {
    this.maxDepth    = config.maxDepth    ?? 5;
    this.costBudget  = config.costBudget  ?? 100;
    this.costPerDepth = config.costPerDepth ?? { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  }

  // ── Main entry point ─────────────────────────────────────────────

  async decompose(
    objectiveLabel: string,
    objective:      string,
    context = ""
  ): Promise<TaskTree> {
    const tree: TaskTree = {
      treeId:          treeId(),
      rootNodeId:      "",
      objectiveLabel,
      nodes:           new Map(),
      totalCost:       0,
      maxDepthReached: 0,
      leafCount:       0,
      deferredCount:   0,
      createdAt:       Date.now(),
    };

    const root = await this._expand(tree, null, objectiveLabel, objective, 0, context, 0);
    tree.rootNodeId = root.nodeId;
    tree.totalCost  = root.cumulativeCost;

    return tree;
  }

  // ── Recursive expansion ──────────────────────────────────────────

  private async _expand(
    tree:          TaskTree,
    parentId:      string | null,
    label:         string,
    objective:     string,
    depth:         number,
    context:       string,
    runningCost:   number
  ): Promise<TaskNode> {
    const id = nodeId();
    const baseCost = this.costPerDepth[depth] ?? depth + 1;

    // Check depth and cost limits
    if (depth >= this.maxDepth || runningCost + baseCost > this.costBudget) {
      const node: TaskNode = {
        nodeId:         id,
        label:          label.slice(0, 50),
        objective,
        depth,
        parentId,
        childIds:       [],
        isLeaf:         true,
        status:         runningCost + baseCost > this.costBudget ? "DEFERRED" : "PENDING",
        estimatedCost:  baseCost,
        cumulativeCost: baseCost,
        capabilityTags: [],
        suggestedTools: [],
        pillarId:       this.config.defaultPillar ?? "core",
        rationale:      runningCost + baseCost > this.costBudget
          ? `Pruned — cumulative cost would exceed budget of ${this.costBudget}.`
          : `Max depth ${this.maxDepth} reached.`,
        createdAt:      Date.now(),
        completedAt:    null,
      };
      tree.nodes.set(id, node);
      if (node.status === "DEFERRED") tree.deferredCount++;
      else tree.leafCount++;
      if (depth > tree.maxDepthReached) tree.maxDepthReached = depth;
      return node;
    }

    // Call decompose function
    const subTasks = await this.decomposeFn(objective, depth, context);

    // If single leaf returned, store it directly
    if (subTasks.length === 1 && subTasks[0].isLeaf) {
      const sub = subTasks[0];
      const node: TaskNode = {
        nodeId:         id,
        label:          sub.label.slice(0, 50),
        objective:      sub.objective,
        depth,
        parentId,
        childIds:       [],
        isLeaf:         true,
        status:         "PENDING",
        estimatedCost:  sub.estimatedCost,
        cumulativeCost: sub.estimatedCost,
        capabilityTags: sub.capabilityTags,
        suggestedTools: sub.suggestedTools,
        pillarId:       sub.pillarId,
        rationale:      sub.rationale,
        createdAt:      Date.now(),
        completedAt:    null,
      };
      tree.nodes.set(id, node);
      tree.leafCount++;
      if (depth > tree.maxDepthReached) tree.maxDepthReached = depth;
      return node;
    }

    // Recurse into children
    const children: TaskNode[] = [];
    let cumCost = baseCost;
    for (const sub of subTasks) {
      const child = await this._expand(
        tree,
        id,
        sub.label,
        sub.objective,
        depth + 1,
        sub.objective,
        runningCost + cumCost
      );
      children.push(child);
      cumCost += child.cumulativeCost;
    }

    const node: TaskNode = {
      nodeId:         id,
      label:          label.slice(0, 50),
      objective,
      depth,
      parentId,
      childIds:       children.map((c) => c.nodeId),
      isLeaf:         false,
      status:         "PENDING",
      estimatedCost:  baseCost,
      cumulativeCost: cumCost,
      capabilityTags: [...new Set(children.flatMap((c) => c.capabilityTags))],
      suggestedTools: [...new Set(children.flatMap((c) => c.suggestedTools))],
      pillarId:       this.config.defaultPillar ?? "core",
      rationale:      `Decomposed into ${children.length} sub-tasks at depth ${depth}.`,
      createdAt:      Date.now(),
      completedAt:    null,
    };
    tree.nodes.set(id, node);
    if (depth > tree.maxDepthReached) tree.maxDepthReached = depth;
    return node;
  }

  // ── Status updates ────────────────────────────────────────────────

  updateNodeStatus(tree: TaskTree, nodeId: string, status: TaskStatus): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    node.status = status;
    if (status === "COMPLETE" || status === "FAILED") node.completedAt = Date.now();
    tree.nodes.set(nodeId, node);
  }

  /** Return leaf nodes in BFS order — the execution queue. */
  getExecutionQueue(tree: TaskTree): TaskNode[] {
    const queue: TaskNode[] = [];
    const visit = (nodeId: string) => {
      const node = tree.nodes.get(nodeId);
      if (!node) return;
      if (node.isLeaf && node.status === "PENDING") queue.push(node);
      for (const childId of node.childIds) visit(childId);
    };
    visit(tree.rootNodeId);
    return queue;
  }

  /** Return a flat ordered list of all nodes (BFS). */
  flattenTree(tree: TaskTree): TaskNode[] {
    const result: TaskNode[] = [];
    const visit = (id: string) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      result.push(node);
      for (const childId of node.childIds) visit(childId);
    };
    visit(tree.rootNodeId);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════

export function formatTaskTree(tree: TaskTree): string {
  const lines: string[] = [
    `TaskTree [${tree.treeId}]  "${tree.objectiveLabel}"`,
    `  nodes=${tree.nodes.size}  leaves=${tree.leafCount}  deferred=${tree.deferredCount}  maxDepth=${tree.maxDepthReached}  totalCost=${tree.totalCost}`,
    "",
  ];
  const render = (nodeId: string, indent = 0) => {
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    const pad  = "  ".repeat(indent);
    const leaf = node.isLeaf ? " [LEAF]" : "";
    const def  = node.status === "DEFERRED" ? " [DEFERRED]" : "";
    lines.push(`${pad}${node.status === "DEFERRED" ? "✗" : "○"} ${node.label}${leaf}${def}  cost=${node.estimatedCost}  tags=[${node.capabilityTags.join(",")}]`);
    for (const childId of node.childIds) render(childId, indent + 1);
  };
  render(tree.rootNodeId);
  return lines.join("\n");
}

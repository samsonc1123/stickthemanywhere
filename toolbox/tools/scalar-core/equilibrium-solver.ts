/**
 * toolbox/tools/scalar-core/equilibrium-solver.ts
 * version: 1.0.0
 *
 * Pillar 17: Scalar Data Correlation — Equilibrium Solver
 * Domain: COMPUTATIONAL-OPTIMIZATION
 *
 * Responsibilities:
 *   Balance a shared resource (Resource X) across a set of competing
 *   nodes (Node Y) to achieve a Nash Equilibrium — a stable state where
 *   no single node can improve its own payoff by unilaterally reallocating.
 *
 * Game-theory algorithm: Iterative Best-Response (IBR)
 *
 *   Each node is modeled as a rational agent whose payoff is a concave
 *   function of its allocation.  In each iteration every node computes
 *   its best response — the allocation that maximises its marginal payoff
 *   given the allocations of all other nodes.  Iterations continue until
 *   the maximum inter-round allocation change falls below `tolerance`
 *   (convergence to Nash Equilibrium) or `maxIterations` is reached.
 *
 * Payoff functions (user-selectable per node):
 *   logarithmic  — log(1 + x)  High-diminishing returns; classic Cobb-Douglas
 *   sqrt         — √x          Moderate diminishing returns
 *   linear       — x           No diminishing returns (degenerate: winner-takes-all)
 *   concave      — 1 - e^(-x)  Exponential saturation
 *
 * Fairness measures:
 *   Jain index    — 1 if perfectly fair, 0 if monopoly
 *   Gini index    — 0 if perfectly equal, 1 if total inequality
 *   Entropy       — Shannon entropy of the allocation distribution
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type PayoffFunction = "logarithmic" | "sqrt" | "linear" | "concave";

export interface Node {
  /** Unique identifier */
  id:             string;
  /** Human-readable label */
  label:          string;
  /** Minimum guaranteed allocation (0 ≤ minAlloc ≤ maxAlloc) */
  minAlloc:       number;
  /** Maximum permissible allocation (≤ totalResource) */
  maxAlloc:       number;
  /** Relative weight / priority (higher = stronger pull for resources) */
  weight:         number;
  /** Which payoff curve this node uses */
  payoffFn:       PayoffFunction;
  /** Optional: starting allocation override (default = totalResource / numNodes) */
  initialAlloc?:  number;
}

export interface SolverOptions {
  /**
   * Convergence tolerance — stop when max change per round < tolerance.
   * Default: 1e-6
   */
  tolerance?: number;
  /** Maximum number of IBR iterations. Default: 1000 */
  maxIterations?: number;
  /**
   * Step size (learning rate) for best-response updates.
   * Lower = more stable but slower; range (0, 1].  Default: 0.5
   */
  stepSize?: number;
  /**
   * If true, print iteration details to console (debug).
   * Default: false
   */
  verbose?: boolean;
}

export interface AllocationResult {
  nodeId:        string;
  label:         string;
  allocation:    number;
  /** Payoff value at final allocation */
  payoff:        number;
  /** Fraction of totalResource this node received */
  fraction:      number;
  /** Whether this node is at its minAlloc or maxAlloc constraint */
  atConstraint:  "min" | "max" | "none";
}

export interface EquilibriumSolution {
  /** Final per-node allocations */
  allocations:      AllocationResult[];
  /** Total resource distributed (should equal totalResource within tolerance) */
  totalDistributed: number;
  /** Number of IBR iterations to converge */
  iterations:       number;
  /** true if converged to equilibrium; false if maxIterations reached */
  converged:        boolean;
  /** Max allocation change in the final iteration */
  finalDelta:       number;
  /** Jain fairness index [0, 1] — 1 = perfect equality */
  jainIndex:        number;
  /** Gini inequality index [0, 1] — 0 = perfect equality */
  giniIndex:        number;
  /** Shannon entropy of the allocation distribution */
  entropy:          number;
  /** Total system payoff */
  totalPayoff:      number;
  /** Stability label based on finalDelta and converged flag */
  stability:        "STABLE" | "QUASI-STABLE" | "UNSTABLE";
}

// ═══════════════════════════════════════════════════════════════════
// PAYOFF FUNCTIONS AND MARGINAL PAYOFFS
// ═══════════════════════════════════════════════════════════════════

function payoff(fn: PayoffFunction, x: number): number {
  const safe = Math.max(x, 0);
  switch (fn) {
    case "logarithmic": return Math.log(1 + safe);
    case "sqrt":        return Math.sqrt(safe);
    case "linear":      return safe;
    case "concave":     return 1 - Math.exp(-safe);
  }
}

/**
 * Marginal payoff (first derivative), used for best-response calculation.
 */
function marginalPayoff(fn: PayoffFunction, x: number): number {
  const safe = Math.max(x, 1e-12);
  switch (fn) {
    case "logarithmic": return 1 / (1 + safe);
    case "sqrt":        return 1 / (2 * Math.sqrt(safe));
    case "linear":      return 1;
    case "concave":     return Math.exp(-safe);
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEASIBILITY CHECK
// ═══════════════════════════════════════════════════════════════════

function validateInputs(nodes: Node[], totalResource: number): void {
  if (nodes.length === 0)           throw new Error("equilibrium-solver: nodes array is empty.");
  if (totalResource <= 0)           throw new Error("equilibrium-solver: totalResource must be > 0.");
  for (const n of nodes) {
    if (n.minAlloc < 0)             throw new Error(`Node '${n.id}': minAlloc must be ≥ 0.`);
    if (n.maxAlloc < n.minAlloc)    throw new Error(`Node '${n.id}': maxAlloc must be ≥ minAlloc.`);
    if (n.weight <= 0)              throw new Error(`Node '${n.id}': weight must be > 0.`);
  }
  const minSum = nodes.reduce((s, n) => s + n.minAlloc, 0);
  const maxSum = nodes.reduce((s, n) => s + n.maxAlloc, 0);
  if (minSum > totalResource + 1e-9) {
    throw new Error(`equilibrium-solver: sum of minAlloc (${minSum}) exceeds totalResource (${totalResource}).`);
  }
  if (maxSum < totalResource - 1e-9) {
    throw new Error(`equilibrium-solver: sum of maxAlloc (${maxSum}) is less than totalResource (${totalResource}).`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// BEST-RESPONSE COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute each node's best-response allocation given current allocations.
 *
 * Proportional marginal-payoff rule (weighted):
 *   Each node is entitled to a share of the total resource proportional
 *   to weight × marginalPayoff(currentAlloc).  The result is then
 *   clipped to [minAlloc, maxAlloc].  Residuals from clipping are
 *   redistributed iteratively across unconstrained nodes.
 */
function bestResponse(
  nodes:         Node[],
  currentAlloc:  number[],
  totalResource: number
): number[] {
  const n        = nodes.length;
  const proposed = new Array<number>(n);
  const fixed    = new Array<boolean>(n).fill(false);
  let   remaining = totalResource;
  let   changed   = true;

  // Initialise proposals from marginal-payoff weighted share
  const scores = nodes.map((node, i) => node.weight * marginalPayoff(node.payoffFn, currentAlloc[i]));
  const total  = scores.reduce((s, v) => s + v, 0) || 1;
  for (let i = 0; i < n; i++) proposed[i] = (scores[i] / total) * totalResource;

  // Iterative clipping + redistribution
  while (changed) {
    changed = false;
    let freeTotal = 0;
    for (let i = 0; i < n; i++) {
      if (!fixed[i]) freeTotal += scores[i];
    }
    if (freeTotal < 1e-14) break;

    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      const share = (scores[i] / freeTotal) * remaining;
      if (share < nodes[i].minAlloc) {
        proposed[i] = nodes[i].minAlloc;
        remaining  -= nodes[i].minAlloc;
        fixed[i]    = true;
        changed     = true;
      } else if (share > nodes[i].maxAlloc) {
        proposed[i] = nodes[i].maxAlloc;
        remaining  -= nodes[i].maxAlloc;
        fixed[i]    = true;
        changed     = true;
      }
    }
  }

  // Assign remaining to free nodes proportionally
  let freeTotal = nodes.reduce((s, _, i) => (!fixed[i] ? s + scores[i] : s), 0);
  if (freeTotal < 1e-14) freeTotal = 1;
  for (let i = 0; i < n; i++) {
    if (!fixed[i]) proposed[i] = (scores[i] / freeTotal) * remaining;
  }

  return proposed;
}

// ═══════════════════════════════════════════════════════════════════
// FAIRNESS METRICS
// ═══════════════════════════════════════════════════════════════════

/** Jain's fairness index — 1 = perfectly fair, 0 = monopoly */
function jainIndex(allocs: number[]): number {
  const n   = allocs.length;
  const sum = allocs.reduce((s, v) => s + v, 0);
  const sq  = allocs.reduce((s, v) => s + v * v, 0);
  return sq < 1e-14 ? 0 : (sum * sum) / (n * sq);
}

/** Gini inequality index — 0 = perfect equality, 1 = total inequality */
function giniIndex(allocs: number[]): number {
  const n      = allocs.length;
  const sorted = [...allocs].sort((a, b) => a - b);
  const sum    = sorted.reduce((s, v) => s + v, 0);
  if (sum < 1e-14 || n === 0) return 0;
  let num = 0;
  for (let i = 0; i < n; i++) num += (2 * (i + 1) - n - 1) * sorted[i];
  return num / (n * sum);
}

/** Shannon entropy of the allocation distribution (nats) */
function shannonEntropy(allocs: number[]): number {
  const sum = allocs.reduce((s, v) => s + v, 0);
  if (sum < 1e-14) return 0;
  return -allocs.reduce((s, v) => {
    const p = v / sum;
    return p > 0 ? s + p * Math.log(p) : s;
  }, 0);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: EQUILIBRIUM SOLVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Solve for the Nash Equilibrium allocation of `totalResource` across `nodes`
 * using Iterative Best-Response.
 *
 * @param nodes          Competing nodes (Resource Y consumers)
 * @param totalResource  Total quantity of Resource X to distribute
 * @param opts           Solver tuning parameters (all optional)
 *
 * @returns EquilibriumSolution with per-node allocations and fairness metrics
 */
export function solveEquilibrium(
  nodes:         Node[],
  totalResource: number,
  opts:          SolverOptions = {}
): EquilibriumSolution {
  validateInputs(nodes, totalResource);

  const tolerance    = opts.tolerance     ?? 1e-6;
  const maxIter      = opts.maxIterations ?? 1000;
  const stepSize     = Math.min(1, Math.max(1e-3, opts.stepSize ?? 0.5));
  const verbose      = opts.verbose       ?? false;
  const n            = nodes.length;

  // Initialise allocations
  const baseAlloc  = totalResource / n;
  let   allocs     = nodes.map((node) =>
    Math.min(node.maxAlloc, Math.max(node.minAlloc, node.initialAlloc ?? baseAlloc))
  );

  // Renormalise so that sum equals totalResource
  const initSum = allocs.reduce((s, v) => s + v, 0);
  if (Math.abs(initSum - totalResource) > 1e-9) {
    allocs = allocs.map((v) => (v / initSum) * totalResource);
  }

  let iterations  = 0;
  let finalDelta  = Infinity;
  let converged   = false;

  // ── IBR Loop ───────────────────────────────────────────────────
  for (let iter = 0; iter < maxIter; iter++) {
    const next = bestResponse(nodes, allocs, totalResource);

    // Blended update: alloc = alloc + stepSize × (best - alloc)
    let maxDelta = 0;
    const updated = allocs.map((v, i) => {
      const delta = next[i] - v;
      maxDelta = Math.max(maxDelta, Math.abs(delta));
      return v + stepSize * delta;
    });

    // Renormalise to preserve exact sum
    const updatedSum = updated.reduce((s, v) => s + v, 0);
    allocs     = updated.map((v) => (v / updatedSum) * totalResource);
    finalDelta = maxDelta;
    iterations = iter + 1;

    if (verbose) {
      console.log(`[IBR ${iter}] delta=${maxDelta.toExponential(3)}  allocs=[${allocs.map((v) => v.toFixed(4)).join(", ")}]`);
    }

    if (maxDelta < tolerance) {
      converged = true;
      break;
    }
  }

  // ── Build result ───────────────────────────────────────────────
  const totalDistributed = allocs.reduce((s, v) => s + v, 0);
  let   totalPayoff      = 0;

  const allocations: AllocationResult[] = nodes.map((node, i) => {
    const a   = allocs[i];
    const p   = payoff(node.payoffFn, a) * node.weight;
    totalPayoff += p;
    const atConstraint: AllocationResult["atConstraint"] =
      Math.abs(a - node.minAlloc) < 1e-9 ? "min" :
      Math.abs(a - node.maxAlloc) < 1e-9 ? "max" :
      "none";

    return {
      nodeId:    node.id,
      label:     node.label,
      allocation: a,
      payoff:    p,
      fraction:  a / totalResource,
      atConstraint,
    };
  });

  const stability: EquilibriumSolution["stability"] =
    converged && finalDelta < tolerance   ? "STABLE" :
    converged && finalDelta < tolerance * 100 ? "QUASI-STABLE" :
    "UNSTABLE";

  return {
    allocations,
    totalDistributed,
    iterations,
    converged,
    finalDelta,
    jainIndex:  jainIndex(allocs),
    giniIndex:  giniIndex(allocs),
    entropy:    shannonEntropy(allocs),
    totalPayoff,
    stability,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format the equilibrium solution as a compact ASCII table.
 */
export function formatEquilibriumTable(sol: EquilibriumSolution): string {
  const header = [
    `Stability: ${sol.stability}  |  Iterations: ${sol.iterations}  |  Converged: ${sol.converged}`,
    `Jain: ${sol.jainIndex.toFixed(4)}  |  Gini: ${sol.giniIndex.toFixed(4)}  |  Entropy: ${sol.entropy.toFixed(4)} nats`,
    `Total payoff: ${sol.totalPayoff.toFixed(4)}  |  Total distributed: ${sol.totalDistributed.toFixed(6)}`,
    "",
    "  Node                  Alloc    Fraction  Payoff   Constraint",
    "  " + "─".repeat(62),
  ];

  const rows = sol.allocations.map((a) =>
    `  ${a.label.padEnd(22)} ${a.allocation.toFixed(6).padStart(8)}  ${(a.fraction * 100).toFixed(2).padStart(7)}%  ${a.payoff.toFixed(4).padStart(7)}  [${a.atConstraint}]`
  );

  return [...header, ...rows].join("\n");
}

/**
 * Check if the solution is at Nash Equilibrium — no node has incentive to deviate.
 *
 * A node has incentive to deviate if its marginal payoff would increase by
 * reallocating even a tiny epsilon from another node.
 *
 * @param sol     Equilibrium solution
 * @param nodes   Original node definitions
 * @param epsilon Small deviation to test (default: 1e-4)
 */
export function isNashEquilibrium(
  sol:     EquilibriumSolution,
  nodes:   Node[],
  epsilon: number = 1e-4
): { isNash: boolean; deviatingNodes: string[] } {
  const allocs        = sol.allocations.map((a) => a.allocation);
  const deviatingNodes: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    if (sol.allocations[i].atConstraint !== "none") continue; // constrained nodes cannot deviate freely

    const basePayoff  = payoff(nodes[i].payoffFn, allocs[i]) * nodes[i].weight;
    const upPayoff    = payoff(nodes[i].payoffFn, allocs[i] + epsilon) * nodes[i].weight;

    if (upPayoff > basePayoff + 1e-9) {
      deviatingNodes.push(nodes[i].id);
    }
  }

  return { isNash: deviatingNodes.length === 0, deviatingNodes };
}

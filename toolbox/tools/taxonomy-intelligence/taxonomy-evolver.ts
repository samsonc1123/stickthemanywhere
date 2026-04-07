/**
 * toolbox/tools/taxonomy-intelligence/taxonomy-evolver.ts
 * version: 1.0.0
 *
 * Pillar 20: Semantic Tagging Layer
 * Domains: MARKETPLACE-INFRASTRUCTURE | Recursive-Intelligence
 *
 * Compares a set of new asset WeightedTagClouds against the current
 * taxonomy directory structure and:
 *   1. Identifies clusters of semantically similar assets that do not
 *      map cleanly to any existing category ("orphaned clusters")
 *   2. Proposes a new Category name, canonical prefix code, and
 *      manifest entry for each orphaned cluster
 *   3. Returns a full TaxonomyEvolutionReport ready for human review
 *      or automated manifest injection
 *
 * Clustering algorithm: Agglomerative single-linkage using cosine
 * similarity on tag weight vectors (no external ML library required).
 *
 * Manifest proposal format mirrors the existing toolbox-manifest.json
 * taxonomy node shape so proposals can be appended directly.
 */

import type { WeightedTagCloud, WeightedTag, TagCategory } from "./visual-analyzer.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — EXISTING TAXONOMY
// ═══════════════════════════════════════════════════════════════════

export interface ExistingCategory {
  /** Canonical code, e.g. "NEON-STICKERS" */
  code:        string;
  /** Display name */
  name:        string;
  /** Tags that define this category (used for matching) */
  anchorTags:  string[];
  /** Currently assigned asset IDs */
  assetIds?:   string[];
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — CLUSTERING
// ═══════════════════════════════════════════════════════════════════

export interface AssetCluster {
  /** Auto-generated cluster ID */
  clusterId:     string;
  /** Asset IDs in this cluster */
  assetIds:      string[];
  /** Union of top tags across all cluster members */
  sharedTags:    WeightedTag[];
  /** Centroid tag weights (average across members) */
  centroid:      Record<string, number>;
  /**
   * Intra-cluster cohesion [0, 1] — average pairwise cosine similarity.
   * Higher = more semantically tight.
   */
  cohesion:      number;
  /** Nearest existing category (if any); null = orphaned */
  nearestCategory: string | null;
  /** Cosine similarity to the nearest existing category [0, 1] */
  nearestSimilarity: number;
  /** true if cluster has no close match to any existing category */
  isOrphaned:    boolean;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — PROPOSALS
// ═══════════════════════════════════════════════════════════════════

export interface CategoryProposal {
  /** Source cluster */
  clusterId:      string;
  /** Proposed display name */
  proposedName:   string;
  /** Proposed canonical code prefix (UPPER-HYPHENATED) */
  proposedCode:   string;
  /** Proposed slug */
  proposedSlug:   string;
  /** Asset IDs that would fall under this category */
  assetIds:       string[];
  /** Tags that define the proposed category */
  anchorTags:     string[];
  /** Reasoning behind the name/code choice */
  rationale:      string;
  /** Cohesion score of the originating cluster */
  cohesion:       number;
  /**
   * Ready-to-paste manifest taxonomy node (matches toolbox-manifest.json shape)
   */
  manifestNode:   ManifestTaxonomyNode;
}

export interface ManifestTaxonomyNode {
  name:          string;
  code:          string;
  slug:          string;
  type:          "category" | "subcategory";
  dangerLevel:   "safe";
  sortOrder:     number;
  anchorTags:    string[];
  linkedAssets:  string[];
  autoProposed:  true;
  proposedAt:    string;
  description:   string;
}

export interface TaxonomyEvolutionReport {
  generatedAt:        string;
  totalAssetsAnalysed: number;
  totalClusters:      number;
  orphanedClusters:   number;
  mappedClusters:     number;
  clusters:           AssetCluster[];
  proposals:          CategoryProposal[];
  /** Assets that couldn't be clustered (too dissimilar to everything) */
  singletonAssets:    string[];
  /** Summary of how well existing categories cover the new assets */
  coverageScore:      number;   // 0 = no coverage, 1 = full coverage
}

// ═══════════════════════════════════════════════════════════════════
// VECTOR HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a flat tag-weight vector from a WeightedTagCloud.
 * The vector space is defined by the union of all tags across the corpus.
 */
function buildVector(cloud: WeightedTagCloud, vocab: string[]): number[] {
  const map = new Map(cloud.tags.map((t) => [t.tag, t.weight]));
  return vocab.map((v) => map.get(v) ?? 0);
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA < 1e-12 || magB < 1e-12) return 0;
  return dotProduct(a, b) / (magA * magB);
}

function centroidVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const len = vectors[0].length;
  const sum = new Array<number>(len).fill(0);
  for (const v of vectors) for (let i = 0; i < len; i++) sum[i] += v[i];
  return sum.map((s) => s / vectors.length);
}

/** Build a tag-weight vector for an ExistingCategory from its anchorTags */
function categoryVector(cat: ExistingCategory, vocab: string[]): number[] {
  const map = new Map(cat.anchorTags.map((t) => [t, 1.0]));
  return vocab.map((v) => map.get(v) ?? 0);
}

// ═══════════════════════════════════════════════════════════════════
// AGGLOMERATIVE CLUSTERING (single-linkage)
// ═══════════════════════════════════════════════════════════════════

/**
 * Cluster assets using agglomerative single-linkage.
 * Merges the two most similar groups at each step until
 * all inter-cluster similarities fall below `threshold`.
 *
 * Returns groups of asset indices.
 */
function agglomerativeCluster(
  vectors:   number[][],
  threshold: number
): number[][] {
  // Each asset starts in its own cluster
  let clusters: number[][] = vectors.map((_, i) => [i]);

  while (clusters.length > 1) {
    let bestSim  = -Infinity;
    let bestI    = 0;
    let bestJ    = 1;

    // Find the pair with highest single-linkage similarity
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Single-linkage: max similarity between any two members
        let maxSim = -Infinity;
        for (const ai of clusters[i]) {
          for (const aj of clusters[j]) {
            const sim = cosineSimilarity(vectors[ai], vectors[aj]);
            if (sim > maxSim) maxSim = sim;
          }
        }
        if (maxSim > bestSim) {
          bestSim = maxSim;
          bestI   = i;
          bestJ   = j;
        }
      }
    }

    if (bestSim < threshold) break;   // No more merges above threshold

    // Merge bestJ into bestI
    clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
    clusters.splice(bestJ, 1);
  }

  return clusters;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED TAG EXTRACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract shared tags for a cluster — tags present in >50% of members
 * with their average weight, sorted by weight desc.
 */
function extractSharedTags(
  memberClouds: WeightedTagCloud[],
  topN:         number = 15
): WeightedTag[] {
  const tagAccum: Map<string, { totalWeight: number; count: number; category: TagCategory }> = new Map();

  for (const cloud of memberClouds) {
    for (const t of cloud.tags) {
      const acc = tagAccum.get(t.tag);
      if (acc) {
        acc.totalWeight += t.weight;
        acc.count++;
      } else {
        tagAccum.set(t.tag, { totalWeight: t.weight, count: 1, category: t.category });
      }
    }
  }

  const threshold = memberClouds.length * 0.5;
  return [...tagAccum.entries()]
    .filter(([, acc]) => acc.count >= threshold)
    .map(([tag, acc]) => ({
      tag,
      weight:   acc.totalWeight / acc.count,
      category: acc.category,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

// ═══════════════════════════════════════════════════════════════════
// COHESION CALCULATION
// ═══════════════════════════════════════════════════════════════════

function clusterCohesion(memberVectors: number[][]): number {
  if (memberVectors.length < 2) return 1.0;
  let total = 0, count = 0;
  for (let i = 0; i < memberVectors.length; i++) {
    for (let j = i + 1; j < memberVectors.length; j++) {
      total += cosineSimilarity(memberVectors[i], memberVectors[j]);
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

// ═══════════════════════════════════════════════════════════════════
// NAME / CODE GENERATION
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_SEED_MAP: Record<string, { name: string; prefix: string }> = {
  "neon":              { name: "Neon & Glow",            prefix: "NEON-GLOW" },
  "retro":             { name: "Retro & Vintage",         prefix: "RETRO-VINTAGE" },
  "minimalist":        { name: "Minimal & Clean",         prefix: "MINIMAL-CLEAN" },
  "pixel-art":         { name: "Pixel & 8-Bit",           prefix: "PIXEL-8BIT" },
  "dark-mode":         { name: "Dark & Moody",            prefix: "DARK-MOODY" },
  "abstract":          { name: "Abstract & Generative",   prefix: "ABSTRACT-GEN" },
  "nature":            { name: "Nature & Organic",        prefix: "NATURE-ORGANIC" },
  "urban":             { name: "Urban & Street",          prefix: "URBAN-STREET" },
  "sticker":           { name: "Sticker & Die-Cut",       prefix: "STICKER-DIECUT" },
  "character":         { name: "Characters & Mascots",    prefix: "CHARACTER-MASCOT" },
  "typography":        { name: "Type & Lettering",        prefix: "TYPE-LETTERING" },
  "geometric":         { name: "Geometric & Pattern",     prefix: "GEO-PATTERN" },
  "holographic":       { name: "Holographic & Foil",      prefix: "HOLO-FOIL" },
  "brand":             { name: "Brand & Identity",        prefix: "BRAND-IDENTITY" },
  "space":             { name: "Space & Cosmic",          prefix: "SPACE-COSMIC" },
  "cyberpunk":         { name: "Cyberpunk & Tech",        prefix: "CYBER-TECH" },
  "botanical":         { name: "Botanical & Floral",      prefix: "BOTANICAL-FLORAL" },
  "occult":            { name: "Occult & Esoteric",       prefix: "OCCULT-ESOTERIC" },
  "animal":            { name: "Animals & Creatures",     prefix: "ANIMAL-CREATURE" },
  "food":              { name: "Food & Beverage",         prefix: "FOOD-BEVERAGE" },
};

function proposeName(sharedTags: WeightedTag[]): { name: string; prefix: string; rationale: string } {
  for (const tag of sharedTags) {
    for (const [kw, val] of Object.entries(CATEGORY_SEED_MAP)) {
      if (tag.tag.includes(kw)) {
        return {
          name:      val.name,
          prefix:    val.prefix,
          rationale: `Highest-weight shared tag '${tag.tag}' (weight ${tag.weight.toFixed(2)}) matched seed keyword '${kw}'.`,
        };
      }
    }
  }
  // Fallback: use top-2 shared tags
  const top = sharedTags.slice(0, 2).map((t) => t.tag.toUpperCase().replace(/-/g, " "));
  const name   = top.join(" & ") || "Uncategorised";
  const prefix = top.join("-").replace(/\s+/g, "").slice(0, 20) || "UNCATEGORISED";
  return {
    name,
    prefix,
    rationale: `No seed match found — derived from top shared tags: ${sharedTags.slice(0, 2).map((t) => t.tag).join(", ")}.`,
  };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: TAXONOMY EVOLVER
// ═══════════════════════════════════════════════════════════════════

export interface TaxonomyEvolverOptions {
  /**
   * Cosine similarity threshold for merging clusters.
   * Higher = tighter clusters (fewer, more specific).
   * Default: 0.45
   */
  clusterThreshold?: number;
  /**
   * Cosine similarity below which a cluster is considered "orphaned"
   * (no existing category is close enough).
   * Default: 0.35
   */
  orphanThreshold?: number;
  /**
   * Minimum cluster size to generate a proposal.
   * Singletons below this are listed in singletonAssets.
   * Default: 2
   */
  minClusterSize?: number;
  /**
   * Starting sort order for manifest proposals.
   * Default: 100
   */
  proposalSortOrderStart?: number;
}

/**
 * Evolve the taxonomy by clustering new asset tag clouds and proposing
 * new categories for orphaned clusters.
 *
 * @param newClouds          WeightedTagClouds from visual-analyzer.ts
 * @param existingCategories Current taxonomy directory structure
 * @param opts               Clustering + orphan thresholds
 */
export function evolveTaxonomy(
  newClouds:          WeightedTagCloud[],
  existingCategories: ExistingCategory[],
  opts:               TaxonomyEvolverOptions = {}
): TaxonomyEvolutionReport {
  const clusterThreshold  = opts.clusterThreshold       ?? 0.45;
  const orphanThreshold   = opts.orphanThreshold         ?? 0.35;
  const minClusterSize    = opts.minClusterSize          ?? 2;
  const sortOrderStart    = opts.proposalSortOrderStart  ?? 100;

  if (newClouds.length === 0) {
    return {
      generatedAt:         new Date().toISOString(),
      totalAssetsAnalysed: 0,
      totalClusters:       0,
      orphanedClusters:    0,
      mappedClusters:      0,
      clusters:            [],
      proposals:           [],
      singletonAssets:     [],
      coverageScore:       1,
    };
  }

  // ── 1. Build vocabulary (union of all tags across all clouds) ────
  const vocabSet = new Set<string>();
  for (const cloud of newClouds) for (const t of cloud.tags) vocabSet.add(t.tag);
  // Also include existing category anchor tags
  for (const cat of existingCategories) for (const t of cat.anchorTags) vocabSet.add(t);
  const vocab = [...vocabSet];

  // ── 2. Vectorise all new clouds ──────────────────────────────────
  const vectors = newClouds.map((c) => buildVector(c, vocab));

  // ── 3. Vectorise existing categories ────────────────────────────
  const catVectors = existingCategories.map((c) => categoryVector(c, vocab));

  // ── 4. Agglomerative clustering ──────────────────────────────────
  const rawGroups = agglomerativeCluster(vectors, clusterThreshold);

  // ── 5. Build AssetCluster objects ────────────────────────────────
  const clusters:        AssetCluster[]     = [];
  const singletonAssets: string[]           = [];
  let   clusterCounter  = 0;

  for (const group of rawGroups) {
    const membersSmall = group.length < minClusterSize;
    const memberClouds = group.map((i) => newClouds[i]);
    const memberVecs   = group.map((i) => vectors[i]);

    if (membersSmall) {
      singletonAssets.push(...memberClouds.map((c) => c.assetId));
      continue;
    }

    // Nearest existing category
    const centroid       = centroidVector(memberVecs);
    let nearestCat: string | null = null;
    let nearestSim       = 0;
    for (let ci = 0; ci < existingCategories.length; ci++) {
      const sim = cosineSimilarity(centroid, catVectors[ci]);
      if (sim > nearestSim) {
        nearestSim = sim;
        nearestCat = existingCategories[ci].code;
      }
    }

    const isOrphaned = nearestSim < orphanThreshold;
    const centroidMap: Record<string, number> = {};
    vocab.forEach((v, vi) => { if (centroid[vi] > 0.01) centroidMap[v] = centroid[vi]; });

    clusters.push({
      clusterId:         `cluster-${String(++clusterCounter).padStart(3, "0")}`,
      assetIds:          memberClouds.map((c) => c.assetId),
      sharedTags:        extractSharedTags(memberClouds),
      centroid:          centroidMap,
      cohesion:          clusterCohesion(memberVecs),
      nearestCategory:   nearestCat,
      nearestSimilarity: nearestSim,
      isOrphaned,
    });
  }

  // ── 6. Generate proposals for orphaned clusters ───────────────────
  const proposals: CategoryProposal[] = [];
  let sortOrder = sortOrderStart;

  for (const cluster of clusters.filter((c) => c.isOrphaned)) {
    const { name, prefix, rationale } = proposeName(cluster.sharedTags);
    const slug = slugify(name);
    const anchorTags = cluster.sharedTags.slice(0, 8).map((t) => t.tag);

    const manifestNode: ManifestTaxonomyNode = {
      name,
      code:          prefix,
      slug,
      type:          "category",
      dangerLevel:   "safe",
      sortOrder:     sortOrder++,
      anchorTags,
      linkedAssets:  cluster.assetIds,
      autoProposed:  true,
      proposedAt:    new Date().toISOString(),
      description:   `Auto-proposed category for ${cluster.assetIds.length} orphaned assets. ` +
                     `Cluster cohesion: ${cluster.cohesion.toFixed(3)}. ` +
                     `Top tags: ${anchorTags.slice(0, 4).join(", ")}.`,
    };

    proposals.push({
      clusterId:    cluster.clusterId,
      proposedName: name,
      proposedCode: prefix,
      proposedSlug: slug,
      assetIds:     cluster.assetIds,
      anchorTags,
      rationale,
      cohesion:     cluster.cohesion,
      manifestNode,
    });
  }

  // ── 7. Coverage score ─────────────────────────────────────────────
  const mappedAssets = clusters
    .filter((c) => !c.isOrphaned)
    .reduce((s, c) => s + c.assetIds.length, 0);
  const coverageScore = newClouds.length > 0 ? mappedAssets / newClouds.length : 1;

  const orphanedCount = clusters.filter((c) => c.isOrphaned).length;

  return {
    generatedAt:         new Date().toISOString(),
    totalAssetsAnalysed: newClouds.length,
    totalClusters:       clusters.length,
    orphanedClusters:    orphanedCount,
    mappedClusters:      clusters.length - orphanedCount,
    clusters,
    proposals,
    singletonAssets,
    coverageScore,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format the evolution report as a human-readable review summary.
 */
export function formatEvolutionReport(report: TaxonomyEvolutionReport): string {
  const lines: string[] = [
    `Taxonomy Evolution Report — ${report.generatedAt}`,
    `Assets: ${report.totalAssetsAnalysed}  |  Clusters: ${report.totalClusters}  |  Orphaned: ${report.orphanedClusters}  |  Coverage: ${(report.coverageScore * 100).toFixed(1)}%`,
    "",
  ];

  if (report.clusters.length === 0) {
    lines.push("No clusters formed.");
  } else {
    lines.push("── Clusters ──────────────────────────────────────────────────");
    for (const c of report.clusters) {
      const top3 = c.sharedTags.slice(0, 3).map((t) => `${t.tag}(${t.weight.toFixed(2)})`).join("  ");
      lines.push(
        `  ${c.clusterId}  assets:${c.assetIds.length}  cohesion:${c.cohesion.toFixed(3)}  ` +
        `nearest:${c.nearestCategory ?? "none"}(${c.nearestSimilarity.toFixed(2)})  ` +
        `orphaned:${c.isOrphaned}  tags: ${top3}`
      );
    }
  }

  if (report.proposals.length > 0) {
    lines.push("", "── Proposed New Categories ───────────────────────────────────");
    for (const p of report.proposals) {
      lines.push(
        `  [${p.proposedCode}]  "${p.proposedName}"  assets:${p.assetIds.length}  cohesion:${p.cohesion.toFixed(3)}`,
        `    Rationale: ${p.rationale}`,
        `    Anchor tags: ${p.anchorTags.join(", ")}`
      );
    }
  }

  if (report.singletonAssets.length > 0) {
    lines.push("", `── Singletons (not clustered): ${report.singletonAssets.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Extract just the manifest nodes from the proposals, ready for direct
 * injection into toolbox-manifest.json taxonomy arrays.
 */
export function extractManifestNodes(report: TaxonomyEvolutionReport): ManifestTaxonomyNode[] {
  return report.proposals.map((p) => p.manifestNode);
}

/**
 * Export the full evolution report as a JSON string for storage or audit.
 */
export function exportEvolutionReport(report: TaxonomyEvolutionReport): string {
  return JSON.stringify(report, null, 2);
}

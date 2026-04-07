/**
 * toolbox-core/tools/taxonomy.tool.ts
 * version: 1.0.0
 *
 * StickerEngine — Taxonomy Logic Layer.
 * Pure TypeScript. Zero framework imports.
 * Runs in Node, Bun, Deno, browser, or Docker alpine.
 *
 * Mirrors the Convex taxonomy table structure but operates on plain
 * in-memory TaxonomyNode objects — no DB IDs, no Convex context.
 * Use this layer for:
 *   - Static seed data generation
 *   - Client-side tree rendering
 *   - Pipeline pre-validation before a Convex upsert
 *   - Synology NAS / Mainframe standalone mode
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type TaxonomyType =
  | "domain"
  | "category"
  | "subcategory"
  | "group"
  | "attribute";

export type DangerLevel = "safe" | "caution" | "danger";

export interface TaxonomyNode {
  /** Unique within the tree (use a UUID or slug path as a stable key) */
  id:             string;
  name:           string;
  slug:           string;
  type:           TaxonomyType;
  parentId:       string | null;
  isActive:       boolean;
  sortOrder?:     number;
  dangerLevel?:   DangerLevel;
  /** Arbitrary metadata bag — mirrors Convex `metadata: v.optional(v.any())` */
  metadata?:      Record<string, unknown>;
}

export interface TaxonomyTree extends TaxonomyNode {
  children: TaxonomyTree[];
}

export interface AncestorPath {
  /** Root → ... → parent → node */
  path:  TaxonomyNode[];
  depth: number;
}

// ═══════════════════════════════════════════════════════════════════
// SLUG HELPERS  (mirrors convex/taxonomy.ts toSlug)
// ═══════════════════════════════════════════════════════════════════

/** Produce a URL-safe, lowercase, hyphen-delimited slug. */
export function toSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Derive a slug from a name if not explicitly provided. */
export function resolveSlug(name: string, explicitSlug?: string): string {
  return toSlug(explicitSlug ?? name);
}

// ═══════════════════════════════════════════════════════════════════
// TREE OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a nested TaxonomyTree from a flat array of nodes.
 * Nodes without a parentId become root nodes.
 * Preserves sortOrder within each sibling group.
 */
export function buildTree(nodes: TaxonomyNode[]): TaxonomyTree[] {
  const map = new Map<string, TaxonomyTree>();
  const roots: TaxonomyTree[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  const sort = (arr: TaxonomyTree[]): TaxonomyTree[] =>
    arr
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((n) => ({ ...n, children: sort(n.children) }));

  return sort(roots);
}

/**
 * Walk the flat node list upward from a given id and return the
 * full ancestor path: [root, ..., parent, node].
 * Returns null if the starting id is not found.
 */
export function getAncestorPath(
  nodes: TaxonomyNode[],
  id: string
): AncestorPath | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = byId.get(id);
  if (!start) return null;

  const path: TaxonomyNode[] = [];
  let current: TaxonomyNode | undefined = start;

  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return { path, depth: path.length - 1 };
}

/**
 * Return all descendants of a node (recursive, flat list).
 */
export function getDescendants(
  nodes: TaxonomyNode[],
  id: string
): TaxonomyNode[] {
  const result: TaxonomyNode[] = [];

  const collect = (parentId: string) => {
    for (const n of nodes) {
      if (n.parentId === parentId) {
        result.push(n);
        collect(n.id);
      }
    }
  };

  collect(id);
  return result;
}

/**
 * Return all direct children of a node, optionally filtered by type.
 */
export function getChildren(
  nodes: TaxonomyNode[],
  parentId: string | null,
  type?: TaxonomyType
): TaxonomyNode[] {
  return nodes
    .filter(
      (n) =>
        n.parentId === parentId &&
        n.isActive &&
        (type ? n.type === type : true)
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

// ═══════════════════════════════════════════════════════════════════
// UPSERT / DEDUP  (in-memory equivalent of Convex upsertNode)
// ═══════════════════════════════════════════════════════════════════

export interface UpsertResult {
  node:    TaxonomyNode;
  created: boolean;
}

/**
 * Upsert a node into a mutable flat array.
 * Deduplicates on (parentId, slug) — same logic as the Convex mutation.
 * Mutates the array in-place and returns { node, created }.
 */
export function upsertNode(
  nodes: TaxonomyNode[],
  input: Omit<TaxonomyNode, "id"> & { id?: string }
): UpsertResult {
  const slug = resolveSlug(input.name, input.slug);

  const existing = nodes.find(
    (n) => n.parentId === input.parentId && n.slug === slug
  );

  if (existing) {
    return { node: existing, created: false };
  }

  const node: TaxonomyNode = {
    id:         input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name:       input.name,
    slug,
    type:       input.type,
    parentId:   input.parentId,
    isActive:   input.isActive ?? true,
    sortOrder:  input.sortOrder,
    dangerLevel: input.dangerLevel,
    metadata:   input.metadata,
  };

  nodes.push(node);
  return { node, created: true };
}

// ═══════════════════════════════════════════════════════════════════
// DANGER LEVEL HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Map danger level to its color code (matches Flora Fana protocol). */
export const DANGER_COLOR: Record<DangerLevel, string> = {
  safe:    "GREEN",
  caution: "YELLOW",
  danger:  "RED",
};

/**
 * Filter nodes by danger level.
 */
export function filterByDanger(
  nodes: TaxonomyNode[],
  level: DangerLevel
): TaxonomyNode[] {
  return nodes.filter((n) => n.dangerLevel === level && n.isActive);
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════

export interface TaxonomyValidationError {
  nodeId: string;
  field:  string;
  message: string;
}

/**
 * Validate a flat node list for structural integrity.
 * Checks:
 *   - No node references a non-existent parentId
 *   - No circular ancestry (parentId chains must terminate at null)
 *   - No duplicate (parentId, slug) pairs
 *   - All slugs conform to slug format
 */
export function validateTree(nodes: TaxonomyNode[]): TaxonomyValidationError[] {
  const errors: TaxonomyValidationError[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const slugKey = (parentId: string | null, slug: string) =>
    `${parentId ?? "ROOT"}::${slug}`;
  const seenSlugs = new Map<string, string>();

  for (const node of nodes) {
    // Parent exists
    if (node.parentId !== null && !byId.has(node.parentId)) {
      errors.push({
        nodeId:  node.id,
        field:   "parentId",
        message: `Parent id "${node.parentId}" not found in node set.`,
      });
    }

    // No circular reference (max depth guard: 20)
    let cur: TaxonomyNode | undefined = node;
    let depth = 0;
    while (cur && cur.parentId !== null) {
      cur = byId.get(cur.parentId);
      if (++depth > 20) {
        errors.push({
          nodeId:  node.id,
          field:   "parentId",
          message: "Possible circular ancestry detected (depth > 20).",
        });
        break;
      }
    }

    // Slug format
    if (node.slug !== toSlug(node.slug)) {
      errors.push({
        nodeId:  node.id,
        field:   "slug",
        message: `Slug "${node.slug}" does not match canonical form "${toSlug(node.slug)}".`,
      });
    }

    // Duplicate (parentId, slug)
    const key = slugKey(node.parentId, node.slug);
    if (seenSlugs.has(key)) {
      errors.push({
        nodeId:  node.id,
        field:   "slug",
        message: `Duplicate slug "${node.slug}" under parent "${node.parentId ?? "ROOT"}". First seen on node "${seenSlugs.get(key)}".`,
      });
    } else {
      seenSlugs.set(key, node.id);
    }
  }

  return errors;
}

/**
 * toolbox/tools/healing-vision/vision-to-geometry.tool.ts
 * version: 1.0.0
 *
 * Pillar 18: Vision-to-3D Logic
 * Domains: NEURAL-INFRASTRUCTURE | Sovereign-Correction
 *
 * Converts 2D image analysis data (bounding boxes + semantic labels)
 * into 3D primitive scene graphs ready for Redesign-AI consumption.
 *
 * Supported primitives:
 *   Cube    — rectangular / block-like structures (buildings, cars, boxes)
 *   Sphere  — rounded / radial structures (trees, lights, domes)
 *   Plane   — flat / ground-level structures (roads, sidewalks, water)
 *   Cylinder — tall / tubular structures (poles, columns, trunks)
 *   Cone    — tapered structures (rooftops, pylons, spires)
 *
 * Semantic tag → primitive mapping is fully configurable via
 * `SemanticMappingConfig`.  A built-in default mapping covers 30+
 * common COCO / ADE20K / cityscapes categories.
 *
 * Depth estimation:
 *   Without a depth sensor, Z-position and scale are inferred from
 *   bounding box area relative to image size (larger BB = closer).
 *   If a depth map (array of per-pixel depth values, row-major) is
 *   provided, the median depth within the bounding box is used instead.
 *
 * Output is a `SceneGraph` — a flat list of `Primitive3D` nodes
 * with world-space transforms, semantic metadata, and Redesign-AI tags.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — INPUT
// ═══════════════════════════════════════════════════════════════════

/** Axis-aligned bounding box in pixel space */
export interface BoundingBox {
  x:      number;   // left edge
  y:      number;   // top edge
  width:  number;
  height: number;
}

/** A detected region from a 2D vision model (object detector / segmenter) */
export interface DetectedRegion {
  /** Primary semantic label, e.g. "building", "road", "tree" */
  label:      string;
  /** Secondary labels / synonyms, e.g. ["skyscraper", "facade"] */
  tags?:      string[];
  /** Detection confidence from the upstream model, range [0, 1] */
  confidence: number;
  /** Bounding box in pixel space */
  bbox:       BoundingBox;
  /**
   * Optional: instance ID for multi-object scenes (for grouping co-planar regions)
   */
  instanceId?: string;
}

/** 2D image analysis input to the converter */
export interface VisionInput {
  /** Pixel width of the source image */
  imageWidth:   number;
  /** Pixel height of the source image */
  imageHeight:  number;
  /** Detected regions (output of object detector / semantic segmenter) */
  regions:      DetectedRegion[];
  /**
   * Optional: row-major depth map (length = imageWidth × imageHeight).
   * Values in arbitrary units (higher = farther).
   */
  depthMap?:    number[];
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — 3D PRIMITIVES
// ═══════════════════════════════════════════════════════════════════

export type PrimitiveType = "Cube" | "Sphere" | "Plane" | "Cylinder" | "Cone";

/** 3D vector */
export interface Vec3 { x: number; y: number; z: number; }

/** Euler angles (degrees) */
export interface Euler3 { rx: number; ry: number; rz: number; }

/** A 3D primitive node in the scene graph */
export interface Primitive3D {
  /** Unique node ID within the scene */
  id:           string;
  type:         PrimitiveType;
  /** World-space position (Y-up coordinate system) */
  position:     Vec3;
  /** Non-uniform scale */
  scale:        Vec3;
  /** Euler rotation in degrees */
  rotation:     Euler3;
  /** Original semantic label from the vision model */
  semanticLabel: string;
  /** Resolved Redesign-AI semantic tags */
  redesignTags:  string[];
  /** Source bounding box (pixel space, for back-projection) */
  sourceBbox:   BoundingBox;
  /** Detection confidence passed through from the input */
  confidence:   number;
  /** Estimated depth (farther = higher Z) */
  depthZ:       number;
  /** Material hints for the renderer */
  material:     MaterialHint;
  /** Instance ID (from DetectedRegion.instanceId if provided) */
  instanceId?:  string;
}

/** Renderer material hints derived from semantic category */
export interface MaterialHint {
  baseColor:   string;   // CSS hex
  roughness:   number;   // 0 (mirror) – 1 (matte)
  metallic:    number;   // 0 – 1
  transparent: boolean;
  emissive:    boolean;
}

/** The complete 3D scene produced from a VisionInput */
export interface SceneGraph {
  nodes:           Primitive3D[];
  /** Source image dimensions (preserved for reference) */
  imageDimensions: { width: number; height: number };
  /**
   * Scene bounding box in world space (for camera framing)
   */
  sceneBounds:     { min: Vec3; max: Vec3 };
  /** Labels that were present in input but had no mapping and were skipped */
  unmappedLabels:  string[];
  /** Total number of regions processed */
  regionsProcessed: number;
}

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC MAPPING CONFIG
// ═══════════════════════════════════════════════════════════════════

export interface SemanticRule {
  /** Primitive to use for this semantic class */
  primitive:    PrimitiveType;
  /** Scale multipliers applied to the bbox-derived base scale */
  scaleFactors: { x: number; y: number; z: number };
  /** Elevation offset applied to the Y position */
  yOffset:      number;
  /** Redesign-AI tags to attach */
  redesignTags: string[];
  /** Material hint preset */
  material:     MaterialHint;
}

export type SemanticMappingConfig = Record<string, SemanticRule>;

// ─── Default mapping (30+ categories) ─────────────────────────────

const DEFAULT_MATERIAL: MaterialHint = {
  baseColor: "#888888", roughness: 0.8, metallic: 0, transparent: false, emissive: false,
};

export const DEFAULT_SEMANTIC_MAP: SemanticMappingConfig = {
  // ── Buildings / structures ───────────────────────────────────────
  building:       { primitive: "Cube",     scaleFactors: { x: 1.0, y: 2.0, z: 1.0 }, yOffset: 0,    redesignTags: ["architecture", "structure", "urban"],          material: { baseColor: "#8B8FA8", roughness: 0.85, metallic: 0.1,  transparent: false, emissive: false } },
  skyscraper:     { primitive: "Cube",     scaleFactors: { x: 0.8, y: 4.0, z: 0.8 }, yOffset: 0,    redesignTags: ["architecture", "high-rise", "urban"],           material: { baseColor: "#6B7A99", roughness: 0.7,  metallic: 0.2,  transparent: false, emissive: false } },
  house:          { primitive: "Cube",     scaleFactors: { x: 1.2, y: 1.0, z: 1.2 }, yOffset: 0,    redesignTags: ["architecture", "residential"],                  material: { baseColor: "#C49A6C", roughness: 0.9,  metallic: 0,    transparent: false, emissive: false } },
  bridge:         { primitive: "Plane",    scaleFactors: { x: 3.0, y: 0.1, z: 1.0 }, yOffset: 0.5,  redesignTags: ["infrastructure", "bridge"],                     material: { baseColor: "#B0B0B0", roughness: 0.6,  metallic: 0.3,  transparent: false, emissive: false } },
  wall:           { primitive: "Cube",     scaleFactors: { x: 2.0, y: 1.0, z: 0.1 }, yOffset: 0,    redesignTags: ["structure", "boundary"],                        material: { baseColor: "#A89880", roughness: 0.95, metallic: 0,    transparent: false, emissive: false } },
  tower:          { primitive: "Cylinder", scaleFactors: { x: 0.5, y: 3.0, z: 0.5 }, yOffset: 0,    redesignTags: ["architecture", "tower", "urban"],               material: { baseColor: "#9090A8", roughness: 0.75, metallic: 0.15, transparent: false, emissive: false } },
  roof:           { primitive: "Cone",     scaleFactors: { x: 1.2, y: 0.5, z: 1.2 }, yOffset: 1.0,  redesignTags: ["architecture", "rooftop"],                      material: { baseColor: "#8B5E3C", roughness: 0.9,  metallic: 0,    transparent: false, emissive: false } },
  fence:          { primitive: "Plane",    scaleFactors: { x: 2.0, y: 0.5, z: 0.05 }, yOffset: 0,   redesignTags: ["boundary", "infrastructure"],                   material: { baseColor: "#C0A070", roughness: 0.95, metallic: 0,    transparent: false, emissive: false } },

  // ── Ground / surfaces ─────────────────────────────────────────────
  road:           { primitive: "Plane",    scaleFactors: { x: 2.0, y: 0.02, z: 1.0 }, yOffset: 0,   redesignTags: ["infrastructure", "road", "navigation"],         material: { baseColor: "#555555", roughness: 0.95, metallic: 0,    transparent: false, emissive: false } },
  sidewalk:       { primitive: "Plane",    scaleFactors: { x: 0.8, y: 0.02, z: 1.0 }, yOffset: 0,   redesignTags: ["infrastructure", "pedestrian"],                 material: { baseColor: "#888880", roughness: 0.95, metallic: 0,    transparent: false, emissive: false } },
  floor:          { primitive: "Plane",    scaleFactors: { x: 1.0, y: 0.02, z: 1.0 }, yOffset: 0,   redesignTags: ["surface", "interior"],                          material: { baseColor: "#C8B89A", roughness: 0.85, metallic: 0,    transparent: false, emissive: false } },
  ground:         { primitive: "Plane",    scaleFactors: { x: 1.5, y: 0.02, z: 1.5 }, yOffset: 0,   redesignTags: ["terrain", "surface"],                           material: { baseColor: "#7A8C5A", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },
  water:          { primitive: "Plane",    scaleFactors: { x: 1.5, y: 0.02, z: 1.5 }, yOffset: 0,   redesignTags: ["fluid", "reflective", "terrain"],               material: { baseColor: "#3A6B9A", roughness: 0.05, metallic: 0,    transparent: true,  emissive: false } },
  sand:           { primitive: "Plane",    scaleFactors: { x: 1.5, y: 0.02, z: 1.5 }, yOffset: 0,   redesignTags: ["terrain", "desert", "surface"],                 material: { baseColor: "#D4B87A", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },

  // ── Vegetation ────────────────────────────────────────────────────
  tree:           { primitive: "Sphere",   scaleFactors: { x: 1.0, y: 1.2, z: 1.0 }, yOffset: 0.6,  redesignTags: ["vegetation", "organic", "nature"],              material: { baseColor: "#3A7A3A", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },
  bush:           { primitive: "Sphere",   scaleFactors: { x: 0.7, y: 0.5, z: 0.7 }, yOffset: 0.2,  redesignTags: ["vegetation", "organic"],                        material: { baseColor: "#4A8A3A", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },
  grass:          { primitive: "Plane",    scaleFactors: { x: 1.2, y: 0.05, z: 1.2 }, yOffset: 0,   redesignTags: ["vegetation", "terrain", "surface"],             material: { baseColor: "#5A8A3A", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },
  plant:          { primitive: "Sphere",   scaleFactors: { x: 0.4, y: 0.4, z: 0.4 }, yOffset: 0.2,  redesignTags: ["vegetation", "organic"],                        material: { baseColor: "#4A7A30", roughness: 1.0,  metallic: 0,    transparent: false, emissive: false } },
  flower:         { primitive: "Sphere",   scaleFactors: { x: 0.3, y: 0.3, z: 0.3 }, yOffset: 0.3,  redesignTags: ["vegetation", "organic", "decorative"],          material: { baseColor: "#E860A0", roughness: 0.9,  metallic: 0,    transparent: false, emissive: false } },

  // ── Vehicles ──────────────────────────────────────────────────────
  car:            { primitive: "Cube",     scaleFactors: { x: 1.2, y: 0.5, z: 0.6 }, yOffset: 0.3,  redesignTags: ["vehicle", "transport", "urban"],               material: { baseColor: "#6A8AA0", roughness: 0.4,  metallic: 0.6,  transparent: false, emissive: false } },
  truck:          { primitive: "Cube",     scaleFactors: { x: 1.8, y: 0.7, z: 0.6 }, yOffset: 0.4,  redesignTags: ["vehicle", "transport", "cargo"],               material: { baseColor: "#5A6A7A", roughness: 0.5,  metallic: 0.5,  transparent: false, emissive: false } },
  bus:            { primitive: "Cube",     scaleFactors: { x: 2.0, y: 0.8, z: 0.6 }, yOffset: 0.4,  redesignTags: ["vehicle", "transport", "public"],              material: { baseColor: "#D4A020", roughness: 0.5,  metallic: 0.3,  transparent: false, emissive: false } },
  bicycle:        { primitive: "Cylinder", scaleFactors: { x: 0.3, y: 0.4, z: 0.05 }, yOffset: 0.3, redesignTags: ["vehicle", "transport", "human-scale"],         material: { baseColor: "#4A4A4A", roughness: 0.5,  metallic: 0.7,  transparent: false, emissive: false } },

  // ── Street furniture ──────────────────────────────────────────────
  "street light":  { primitive: "Cylinder", scaleFactors: { x: 0.08, y: 2.5, z: 0.08 }, yOffset: 0, redesignTags: ["infrastructure", "lighting", "urban"],         material: { baseColor: "#D0D0D0", roughness: 0.3,  metallic: 0.9,  transparent: false, emissive: true  } },
  pole:            { primitive: "Cylinder", scaleFactors: { x: 0.1,  y: 2.0, z: 0.1  }, yOffset: 0, redesignTags: ["infrastructure", "vertical-element"],           material: { baseColor: "#909090", roughness: 0.4,  metallic: 0.8,  transparent: false, emissive: false } },
  sign:            { primitive: "Plane",    scaleFactors: { x: 0.6,  y: 0.4, z: 0.02 }, yOffset: 1.2, redesignTags: ["signage", "information", "urban"],            material: { baseColor: "#FFFFFF", roughness: 0.5,  metallic: 0.2,  transparent: false, emissive: false } },

  // ── Sky / atmosphere ──────────────────────────────────────────────
  sky:            { primitive: "Sphere",   scaleFactors: { x: 10,  y: 5.0, z: 10   }, yOffset: 4.0,  redesignTags: ["atmosphere", "environment", "backdrop"],       material: { baseColor: "#87CEEB", roughness: 1.0,  metallic: 0,    transparent: true,  emissive: true  } },
  cloud:          { primitive: "Sphere",   scaleFactors: { x: 2.0, y: 0.8, z: 2.0  }, yOffset: 3.0,  redesignTags: ["atmosphere", "weather"],                       material: { baseColor: "#F0F0F0", roughness: 1.0,  metallic: 0,    transparent: true,  emissive: false } },

  // ── People ────────────────────────────────────────────────────────
  person:         { primitive: "Cylinder", scaleFactors: { x: 0.25, y: 1.0, z: 0.25 }, yOffset: 0,   redesignTags: ["human", "character", "urban"],                 material: { baseColor: "#E0B890", roughness: 0.9,  metallic: 0,    transparent: false, emissive: false } },
};

// ═══════════════════════════════════════════════════════════════════
// CONVERSION OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface VisionToGeometryOptions {
  /**
   * Custom semantic mapping — merged over (and overrides) DEFAULT_SEMANTIC_MAP.
   * Pass a partial map to extend without replacing defaults.
   */
  semanticMap?: SemanticMappingConfig;
  /**
   * Minimum detection confidence to include a region.
   * Default: 0.3
   */
  minConfidence?: number;
  /**
   * World-space units per pixel (affects position and scale).
   * Default: 0.01
   */
  unitsPerPixel?: number;
  /**
   * Max depth Z assigned to the farthest object (closest to horizon).
   * Default: 50
   */
  maxDepthZ?: number;
  /**
   * If true, skip regions that have no semantic mapping.
   * If false, they are mapped to a default Cube and included in unmappedLabels.
   * Default: true
   */
  skipUnmapped?: boolean;
  /**
   * Redesign-AI system tags appended to every node (global scene tags).
   * Default: ["redesign-ai", "scene-graph"]
   */
  globalRedesignTags?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// DEPTH HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate depth Z from bounding box area relative to image.
 * Larger bbox → closer → lower Z. Returns a value in [0, maxDepthZ].
 */
function estimateDepthFromBbox(
  bbox:        BoundingBox,
  imageWidth:  number,
  imageHeight: number,
  maxDepthZ:   number
): number {
  const imageArea = imageWidth * imageHeight;
  const bboxArea  = bbox.width * bbox.height;
  const ratio     = Math.max(0, Math.min(1, bboxArea / imageArea));
  // Inverse relationship: small bbox = far away
  return (1 - Math.sqrt(ratio)) * maxDepthZ;
}

/**
 * Sample the median depth value from a depth map within a bounding box.
 */
function sampleDepthFromMap(
  depthMap:    number[],
  bbox:        BoundingBox,
  imageWidth:  number,
  maxDepthZ:   number
): number {
  const samples: number[] = [];
  const x0 = Math.round(bbox.x);
  const y0 = Math.round(bbox.y);
  const x1 = Math.round(bbox.x + bbox.width);
  const y1 = Math.round(bbox.y + bbox.height);

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const idx = y * imageWidth + x;
      if (idx >= 0 && idx < depthMap.length) {
        samples.push(depthMap[idx]);
      }
    }
  }
  if (samples.length === 0) return maxDepthZ / 2;
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  // Normalise to [0, maxDepthZ] assuming depth map is in [0, 1]
  return Math.min(maxDepthZ, Math.max(0, median * maxDepthZ));
}

// ═══════════════════════════════════════════════════════════════════
// SCENE BOUNDS
// ═══════════════════════════════════════════════════════════════════

function computeSceneBounds(nodes: Primitive3D[]): { min: Vec3; max: Vec3 } {
  if (nodes.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  const min: Vec3 = { x: Infinity,  y: Infinity,  z: Infinity  };
  const max: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const n of nodes) {
    min.x = Math.min(min.x, n.position.x - n.scale.x / 2);
    min.y = Math.min(min.y, n.position.y);
    min.z = Math.min(min.z, n.position.z);
    max.x = Math.max(max.x, n.position.x + n.scale.x / 2);
    max.y = Math.max(max.y, n.position.y + n.scale.y);
    max.z = Math.max(max.z, n.position.z + n.scale.z / 2);
  }
  return { min, max };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: VISION-TO-GEOMETRY CONVERTER
// ═══════════════════════════════════════════════════════════════════

let _nodeIdCounter = 0;
function nextNodeId(): string {
  return `node_${(++_nodeIdCounter).toString().padStart(5, "0")}`;
}

/**
 * Convert a 2D VisionInput into a 3D SceneGraph of Primitive3D nodes.
 *
 * @param input   2D vision analysis (regions + image dimensions + optional depth map)
 * @param opts    Conversion configuration
 */
export function visionToGeometry(
  input: VisionInput,
  opts:  VisionToGeometryOptions = {}
): SceneGraph {
  const {
    imageWidth,
    imageHeight,
    regions,
    depthMap,
  } = input;

  const minConfidence   = opts.minConfidence      ?? 0.3;
  const upp             = opts.unitsPerPixel       ?? 0.01;
  const maxDepthZ       = opts.maxDepthZ           ?? 50;
  const skipUnmapped    = opts.skipUnmapped        ?? true;
  const globalTags      = opts.globalRedesignTags  ?? ["redesign-ai", "scene-graph"];

  // Merge semantic maps
  const semanticMap: SemanticMappingConfig = {
    ...DEFAULT_SEMANTIC_MAP,
    ...(opts.semanticMap ?? {}),
  };

  const nodes:          Primitive3D[] = [];
  const unmappedLabels: string[]      = [];

  // Image centre (used as scene origin)
  const imgCx = imageWidth  / 2;
  const imgCy = imageHeight / 2;

  for (const region of regions) {
    if (region.confidence < minConfidence) continue;

    // Resolve semantic label (try primary, then each tag)
    const labelKey = region.label.toLowerCase().trim();
    let   rule: SemanticRule | undefined = semanticMap[labelKey];

    if (!rule && region.tags) {
      for (const tag of region.tags) {
        rule = semanticMap[tag.toLowerCase().trim()];
        if (rule) break;
      }
    }

    if (!rule) {
      unmappedLabels.push(region.label);
      if (skipUnmapped) continue;
      // Fallback — plain Cube
      rule = {
        primitive:    "Cube",
        scaleFactors: { x: 1, y: 1, z: 1 },
        yOffset:      0,
        redesignTags: ["unknown"],
        material:     DEFAULT_MATERIAL,
      };
    }

    const { bbox } = region;

    // ── World-space position ─────────────────────────────────
    // Centre of bbox projected to world X/Z; Y derived from rule.yOffset
    const worldX = (bbox.x + bbox.width  / 2 - imgCx) * upp;
    const worldZ = -(bbox.y + bbox.height / 2 - imgCy) * upp;   // Z grows toward viewer

    // ── Depth ────────────────────────────────────────────────
    const depthZ = depthMap
      ? sampleDepthFromMap(depthMap, bbox, imageWidth, maxDepthZ)
      : estimateDepthFromBbox(bbox, imageWidth, imageHeight, maxDepthZ);

    // ── Scale ────────────────────────────────────────────────
    const baseW = bbox.width  * upp;
    const baseH = bbox.height * upp;
    const scale: Vec3 = {
      x: baseW * rule.scaleFactors.x,
      y: baseH * rule.scaleFactors.y,
      z: baseW * rule.scaleFactors.z,   // assume depth ~ width for orthographic
    };

    // ── Redesign-AI tags ─────────────────────────────────────
    const redesignTags = [
      ...globalTags,
      ...rule.redesignTags,
      `label:${region.label}`,
      `primitive:${rule.primitive}`,
    ];
    if (region.tags) redesignTags.push(...region.tags.map((t) => `tag:${t}`));

    nodes.push({
      id:            nextNodeId(),
      type:          rule.primitive,
      position:      { x: worldX, y: rule.yOffset, z: depthZ },
      scale,
      rotation:      { rx: 0, ry: 0, rz: 0 },
      semanticLabel: region.label,
      redesignTags,
      sourceBbox:    bbox,
      confidence:    region.confidence,
      depthZ,
      material:      rule.material,
      instanceId:    region.instanceId,
    });
  }

  return {
    nodes,
    imageDimensions:  { width: imageWidth, height: imageHeight },
    sceneBounds:      computeSceneBounds(nodes),
    unmappedLabels:   [...new Set(unmappedLabels)],
    regionsProcessed: regions.length,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING / QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Filter scene graph nodes by primitive type.
 */
export function filterByPrimitive(graph: SceneGraph, type: PrimitiveType): Primitive3D[] {
  return graph.nodes.filter((n) => n.type === type);
}

/**
 * Filter scene graph nodes that include a given Redesign-AI tag.
 */
export function filterByRedesignTag(graph: SceneGraph, tag: string): Primitive3D[] {
  return graph.nodes.filter((n) => n.redesignTags.includes(tag));
}

/**
 * Format a compact scene summary for logging / audit.
 */
export function formatSceneSummary(graph: SceneGraph): string {
  const counts: Partial<Record<PrimitiveType, number>> = {};
  for (const n of graph.nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  const countStr = (Object.entries(counts) as [PrimitiveType, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}×${c}`)
    .join("  ");
  const b = graph.sceneBounds;
  const dim = `W=${(b.max.x - b.min.x).toFixed(2)} H=${(b.max.y - b.min.y).toFixed(2)} D=${(b.max.z - b.min.z).toFixed(2)}`;
  return [
    `SceneGraph — ${graph.nodes.length} nodes from ${graph.regionsProcessed} regions`,
    `Primitives: ${countStr || "none"}`,
    `SceneBounds: ${dim}`,
    graph.unmappedLabels.length
      ? `Unmapped labels (skipped): ${graph.unmappedLabels.join(", ")}`
      : "All labels mapped.",
  ].join("\n");
}

/**
 * Export the scene graph as a minimal JSON-serialisable object suitable
 * for passing to a WebGL renderer or Redesign-AI pipeline.
 */
export function exportSceneJSON(graph: SceneGraph): string {
  return JSON.stringify(
    {
      version:   "1.0.0",
      source:    "vision-to-geometry.tool.ts",
      nodes:     graph.nodes,
      bounds:    graph.sceneBounds,
      imageDims: graph.imageDimensions,
    },
    null,
    2
  );
}

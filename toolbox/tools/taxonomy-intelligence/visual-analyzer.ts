/**
 * toolbox/tools/taxonomy-intelligence/visual-analyzer.ts
 * version: 1.0.0
 *
 * Pillar 20: Semantic Tagging Layer
 * Domains: MARKETPLACE-INFRASTRUCTURE | Recursive-Intelligence
 *
 * Uses a Vision-Language Model (VLM) to analyse image assets and extract:
 *   1. Core Intent   — the primary communicative purpose of the image
 *   2. Art Style     — visual / aesthetic classification
 *   3. Symbolic Meaning — cultural, thematic, and archetypal signals
 *
 * Returns a Weighted Tag Cloud: every extracted tag is assigned a
 * confidence weight [0, 1] and a semantic category.
 *
 * VLM adapter:
 *   The analyser ships a built-in OpenAI (GPT-4o vision) adapter.
 *   Any VLM can be plugged in via the `VlmAdapter` interface.
 *   If no VLM is available, the `heuristicAdapter` runs a pure-code
 *   fallback using image metadata + filename signals.
 *
 * Asset input modes:
 *   url        — public image URL
 *   base64     — data URI or raw base64 string
 *   filepath   — local file path (Bun: read with Bun.file; Node: fs.readFile)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — INPUT
// ═══════════════════════════════════════════════════════════════════

export type AssetInputMode = "url" | "base64" | "filepath";

export interface AssetInput {
  mode:      AssetInputMode;
  /** URL, base64 string, or file path depending on mode */
  source:    string;
  /** Optional human hint (filename, alt-text, surrounding context) */
  hint?:     string;
  /** Unique ID for this asset (used in TagCloud.assetId) */
  assetId?:  string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — TAG CLOUD
// ═══════════════════════════════════════════════════════════════════

export type TagCategory =
  | "core-intent"
  | "art-style"
  | "symbolic-meaning"
  | "color-palette"
  | "composition"
  | "emotion"
  | "subject"
  | "texture"
  | "context";

export interface WeightedTag {
  /** The tag string, lowercase hyphenated, e.g. "retro-futurism" */
  tag:       string;
  /** Confidence weight [0, 1] — higher = stronger signal */
  weight:    number;
  /** Which analysis dimension produced this tag */
  category:  TagCategory;
  /** Optional: supporting evidence or rationale from the VLM */
  rationale?: string;
}

export interface WeightedTagCloud {
  assetId:        string;
  /** Source identifier (URL, filename, or "base64-asset") */
  sourceRef:      string;
  tags:           WeightedTag[];
  /** The single highest-weight tag per category */
  dominantTags:   Partial<Record<TagCategory, WeightedTag>>;
  /** Top-level extraction results */
  coreIntent:     string;
  artStyle:       string;
  symbolicMeaning: string;
  /** Model that produced this analysis */
  model:          string;
  analysedAt:     string;   // ISO
  /** Overall confidence in the analysis [0, 1] */
  overallConfidence: number;
}

// ═══════════════════════════════════════════════════════════════════
// VLM ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface VlmResponse {
  coreIntent:      string;
  artStyle:        string;
  symbolicMeaning: string;
  tags:            Array<{ tag: string; weight: number; category: TagCategory; rationale?: string }>;
  model:           string;
  confidence:      number;
}

export interface VlmAdapter {
  name:    string;
  analyse: (imageUrl: string, hint?: string) => Promise<VlmResponse>;
}

// ═══════════════════════════════════════════════════════════════════
// OPENAI GPT-4o VISION ADAPTER
// ═══════════════════════════════════════════════════════════════════

const ANALYSIS_PROMPT = `Analyse this image and return a JSON object with EXACTLY this structure:
{
  "coreIntent": "<one sentence: the primary communicative purpose>",
  "artStyle": "<one phrase: visual/aesthetic classification>",
  "symbolicMeaning": "<one sentence: cultural/thematic/archetypal signals>",
  "tags": [
    { "tag": "<lowercase-hyphenated-tag>", "weight": <0.0-1.0>, "category": "<category>", "rationale": "<one phrase>" }
  ],
  "confidence": <0.0-1.0>
}

Tag categories must be one of: core-intent, art-style, symbolic-meaning, color-palette, composition, emotion, subject, texture, context.
Generate 12-20 tags covering all relevant categories.
Weights reflect signal strength: 1.0 = unmistakable, 0.5 = moderate, 0.2 = subtle.
Return ONLY the JSON object, no markdown, no explanation.`;

/**
 * Build an OpenAI GPT-4o vision adapter.
 * Requires OPENAI_API_KEY in the environment.
 */
export function createOpenAiVlmAdapter(apiKey?: string): VlmAdapter {
  const key = apiKey ?? process.env.OPENAI_API_KEY ?? "";
  return {
    name: "gpt-4o-vision",
    async analyse(imageUrl: string, hint?: string): Promise<VlmResponse> {
      if (!key) throw new Error("createOpenAiVlmAdapter: OPENAI_API_KEY is not set.");

      const userContent: unknown[] = [
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        { type: "text",      text: hint ? `${ANALYSIS_PROMPT}\n\nHint: ${hint}` : ANALYSIS_PROMPT },
      ];

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model:      "gpt-4o",
          messages:   [{ role: "user", content: userContent }],
          max_tokens: 1200,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenAI VLM error ${resp.status}: ${err.slice(0, 200)}`);
      }

      const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
      const raw  = data.choices[0]?.message?.content ?? "{}";

      // Strip any accidental markdown fences
      const json = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

      let parsed: Omit<VlmResponse, "model">;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error(`OpenAI VLM returned unparseable JSON: ${json.slice(0, 300)}`);
      }

      return {
        coreIntent:      parsed.coreIntent      ?? "unknown",
        artStyle:        parsed.artStyle         ?? "unknown",
        symbolicMeaning: parsed.symbolicMeaning  ?? "unknown",
        tags:            parsed.tags             ?? [],
        model:           "gpt-4o",
        confidence:      parsed.confidence       ?? 0.7,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// HEURISTIC FALLBACK ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Pure-code heuristic adapter — no VLM required.
 * Analyses filename, URL path segments, and any provided hint.
 * Useful for testing, CI, or offline environments.
 */
export function createHeuristicAdapter(): VlmAdapter {
  const STYLE_KEYWORDS: Record<string, string> = {
    neon: "neon-digital", retro: "retro-aesthetic", minimal: "minimalist",
    vector: "flat-vector", photo: "photographic-realism", sketch: "hand-drawn-sketch",
    abstract: "abstract-expressionism", pixel: "pixel-art", dark: "dark-mode-aesthetic",
    bright: "high-key-vibrant", mono: "monochromatic", vintage: "vintage-analog",
  };
  const INTENT_KEYWORDS: Record<string, string> = {
    product: "product-showcase",    logo: "brand-identity",
    banner: "promotional-banner",   icon: "ui-icon",
    sticker: "sticker-design",      background: "environmental-backdrop",
    portrait: "character-portrait", landscape: "environmental-scene",
    chart: "data-visualisation",    diagram: "instructional-diagram",
  };

  return {
    name: "heuristic-fallback",
    async analyse(imageUrl: string, hint?: string): Promise<VlmResponse> {
      const combined = `${imageUrl} ${hint ?? ""}`.toLowerCase();
      const tags: VlmResponse["tags"] = [];

      // Art style
      let artStyle = "undefined-style";
      for (const [kw, style] of Object.entries(STYLE_KEYWORDS)) {
        if (combined.includes(kw)) {
          artStyle = style;
          tags.push({ tag: style, weight: 0.75, category: "art-style" });
          break;
        }
      }

      // Core intent
      let coreIntent = "general-visual-asset";
      for (const [kw, intent] of Object.entries(INTENT_KEYWORDS)) {
        if (combined.includes(kw)) {
          coreIntent = intent;
          tags.push({ tag: intent, weight: 0.8, category: "core-intent" });
          break;
        }
      }

      // Filename-derived subject tags
      const words = combined.match(/\b[a-z]{3,}\b/g) ?? [];
      const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "http", "https", "www", "com"]);
      for (const w of [...new Set(words)].filter((w) => !stopWords.has(w)).slice(0, 6)) {
        tags.push({ tag: w, weight: 0.4, category: "subject" });
      }

      // Colour hints
      const colorMap: Record<string, string> = { red: "#FF4444", blue: "#4444FF", green: "#44AA44", neon: "#00FFCC", dark: "#111111", white: "#FFFFFF" };
      for (const [c] of Object.entries(colorMap)) {
        if (combined.includes(c)) tags.push({ tag: `${c}-dominant`, weight: 0.6, category: "color-palette" });
      }

      return {
        coreIntent,
        artStyle,
        symbolicMeaning: "heuristic-analysis — no symbolic inference available without VLM",
        tags,
        model:      "heuristic-fallback",
        confidence: 0.35,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// ASSET → IMAGE URL RESOLVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Resolve an AssetInput to a public image URL suitable for VLM ingestion.
 * For filepath/base64 inputs, encodes as a data URI.
 */
async function resolveToImageUrl(asset: AssetInput): Promise<string> {
  switch (asset.mode) {
    case "url":
      return asset.source;

    case "base64": {
      // Accept raw base64 or existing data URI
      if (asset.source.startsWith("data:")) return asset.source;
      return `data:image/png;base64,${asset.source}`;
    }

    case "filepath": {
      // Bun-native file reading; falls back to Node fs
      try {
        const file    = Bun.file(asset.source);
        const buffer  = await file.arrayBuffer();
        const b64     = Buffer.from(buffer).toString("base64");
        const mime    = asset.source.endsWith(".jpg") || asset.source.endsWith(".jpeg")
          ? "image/jpeg"
          : asset.source.endsWith(".webp") ? "image/webp" : "image/png";
        return `data:${mime};base64,${b64}`;
      } catch {
        // Node fallback
        const { readFile } = await import("fs/promises");
        const buf = await readFile(asset.source);
        const b64 = buf.toString("base64");
        return `data:image/png;base64,${b64}`;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAG CLOUD ASSEMBLY
// ═══════════════════════════════════════════════════════════════════

function assembleDominantTags(tags: WeightedTag[]): Partial<Record<TagCategory, WeightedTag>> {
  const best: Partial<Record<TagCategory, WeightedTag>> = {};
  for (const tag of tags) {
    const current = best[tag.category];
    if (!current || tag.weight > current.weight) best[tag.category] = tag;
  }
  return best;
}

function normaliseTag(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: VISUAL ANALYSER
// ═══════════════════════════════════════════════════════════════════

export interface VisualAnalyserOptions {
  /** VLM adapter to use. Default: heuristic fallback (no API key needed). */
  adapter?:        VlmAdapter;
  /**
   * Minimum weight threshold — tags below this are excluded from the cloud.
   * Default: 0.15
   */
  minWeight?:      number;
  /**
   * Maximum tags to include in the cloud (sorted by weight desc).
   * Default: 30
   */
  maxTags?:        number;
}

/**
 * Analyse a single image asset and return a WeightedTagCloud.
 */
export async function analyseAsset(
  asset:  AssetInput,
  opts:   VisualAnalyserOptions = {}
): Promise<WeightedTagCloud> {
  const adapter  = opts.adapter  ?? createHeuristicAdapter();
  const minW     = opts.minWeight ?? 0.15;
  const maxTags  = opts.maxTags  ?? 30;

  const imageUrl  = await resolveToImageUrl(asset);
  const vlmResult = await adapter.analyse(imageUrl, asset.hint);

  // Normalise and filter tags
  const rawTags: WeightedTag[] = vlmResult.tags.map((t) => ({
    tag:       normaliseTag(t.tag),
    weight:    Math.min(1, Math.max(0, t.weight)),
    category:  t.category,
    rationale: t.rationale,
  }));

  // Deduplicate by tag string (keep highest weight)
  const deduped = new Map<string, WeightedTag>();
  for (const t of rawTags) {
    const existing = deduped.get(t.tag);
    if (!existing || t.weight > existing.weight) deduped.set(t.tag, t);
  }

  const filtered = [...deduped.values()]
    .filter((t) => t.weight >= minW)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxTags);

  // Ensure the three core outputs appear as tags
  const coreEntries: Array<[string, TagCategory]> = [
    [vlmResult.coreIntent,      "core-intent"],
    [vlmResult.artStyle,        "art-style"],
    [vlmResult.symbolicMeaning, "symbolic-meaning"],
  ];
  for (const [raw, cat] of coreEntries) {
    const tag = normaliseTag(raw.split(" ").slice(0, 4).join("-"));
    if (tag && !deduped.has(tag)) {
      filtered.unshift({ tag, weight: 0.9, category: cat });
    }
  }

  const assetId   = asset.assetId ?? `asset-${Date.now()}`;
  const sourceRef = asset.mode === "url"
    ? asset.source
    : asset.mode === "filepath"
    ? asset.source
    : "base64-asset";

  return {
    assetId,
    sourceRef,
    tags:              filtered,
    dominantTags:      assembleDominantTags(filtered),
    coreIntent:        vlmResult.coreIntent,
    artStyle:          vlmResult.artStyle,
    symbolicMeaning:   vlmResult.symbolicMeaning,
    model:             vlmResult.model,
    analysedAt:        new Date().toISOString(),
    overallConfidence: vlmResult.confidence,
  };
}

/**
 * Analyse a batch of assets concurrently.
 * Respects concurrency limit to avoid rate-limiting the VLM.
 */
export async function analyseAssetBatch(
  assets:      AssetInput[],
  opts:        VisualAnalyserOptions = {},
  concurrency: number = 3
): Promise<WeightedTagCloud[]> {
  const results: WeightedTagCloud[] = [];
  for (let i = 0; i < assets.length; i += concurrency) {
    const batch = assets.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((a) => analyseAsset(a, opts)));
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        console.error("[visual-analyser] batch item failed:", result.reason);
      }
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a WeightedTagCloud as a compact one-block summary.
 */
export function formatTagCloud(cloud: WeightedTagCloud): string {
  const topTags = cloud.tags.slice(0, 10).map((t) => `${t.tag}(${t.weight.toFixed(2)})`).join("  ");
  return [
    `Asset: ${cloud.assetId}  |  Model: ${cloud.model}  |  Confidence: ${cloud.overallConfidence.toFixed(2)}`,
    `Core Intent:      ${cloud.coreIntent}`,
    `Art Style:        ${cloud.artStyle}`,
    `Symbolic Meaning: ${cloud.symbolicMeaning}`,
    `Top Tags: ${topTags}`,
  ].join("\n");
}

/**
 * Export a WeightedTagCloud as a JSON string for storage / transmission.
 */
export function exportTagCloud(cloud: WeightedTagCloud): string {
  return JSON.stringify(cloud, null, 2);
}

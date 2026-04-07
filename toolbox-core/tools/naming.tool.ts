/**
 * toolbox-core/tools/naming.tool.ts
 * version: 1.0.0
 *
 * StickerEngine — Naming & Canonical Code Layer.
 * Pure TypeScript. Zero framework imports.
 * Runs in Node, Bun, Deno, browser, or Docker alpine.
 *
 * Responsibilities:
 *   - Normalize any raw string into a canonical sticker/product code
 *   - Generate display names from codes
 *   - Validate code format
 *   - Produce SEO-safe slugs
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CanonicalCode {
  /** Uppercase, hyphen-delimited. e.g. "FLORA-FANA-ROSES" */
  code: string;
  /** URL-safe slug. e.g. "flora-fana-roses" */
  slug: string;
  /** Human-readable display name. e.g. "Flora Fana Roses" */
  displayName: string;
  /** Individual segments split on hyphen. e.g. ["FLORA", "FANA", "ROSES"] */
  segments: string[];
}

export interface ValidationResult {
  valid: boolean;
  code: string;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════
// CORE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert any raw input to a canonical code string.
 *
 * Rules:
 *   - Strip leading/trailing whitespace
 *   - Replace any run of non-alphanumeric characters with a single hyphen
 *   - Uppercase everything
 *   - Strip leading/trailing hyphens
 *
 * Examples:
 *   "flora fana / roses" → "FLORA-FANA-ROSES"
 *   "  neon   stickers " → "NEON-STICKERS"
 *   "peace & healing"    → "PEACE-HEALING"
 */
export function toCanonicalCode(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

/**
 * Convert any raw input to a URL-safe slug (lowercase version of canonical).
 *
 * Examples:
 *   "Flora Fana Roses" → "flora-fana-roses"
 */
export function toSlug(raw: string): string {
  return toCanonicalCode(raw).toLowerCase();
}

/**
 * Convert a canonical code or slug to a human-readable display name.
 * Title-cases each hyphen-separated segment.
 *
 * Examples:
 *   "FLORA-FANA-ROSES" → "Flora Fana Roses"
 *   "peace-healing"    → "Peace Healing"
 */
export function toDisplayName(code: string): string {
  return code
    .toLowerCase()
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * Full canonical breakdown of a raw name string.
 * Returns code, slug, displayName, and segments together.
 */
export function parseCanonical(raw: string): CanonicalCode {
  const code = toCanonicalCode(raw);
  return {
    code,
    slug:        code.toLowerCase(),
    displayName: toDisplayName(code),
    segments:    code.split("-"),
  };
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a code that's already been stored or supplied externally.
 *
 * A valid canonical code:
 *   - Is non-empty
 *   - Contains only A–Z, 0–9, and hyphens
 *   - Does not start or end with a hyphen
 *   - Has no consecutive hyphens
 *   - Has no segment shorter than 1 character
 */
export function validateCode(code: string): ValidationResult {
  const errors: string[] = [];

  if (!code || code.trim() === "") {
    errors.push("Code is empty.");
    return { valid: false, code, errors };
  }

  if (!/^[A-Z0-9-]+$/.test(code)) {
    errors.push("Code contains invalid characters (only A–Z, 0–9, and hyphens allowed).");
  }
  if (/^-|-$/.test(code)) {
    errors.push("Code must not start or end with a hyphen.");
  }
  if (/--/.test(code)) {
    errors.push("Code must not contain consecutive hyphens.");
  }

  return { valid: errors.length === 0, code, errors };
}

// ═══════════════════════════════════════════════════════════════════
// STICKER-SPECIFIC HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a fully-qualified sticker code from a category + subcategory + name
 * triple. Each segment is individually normalized before joining.
 *
 * Example:
 *   buildStickerCode("Flora Fana", "Roses", "Red Rose")
 *   → "FLORA-FANA-ROSES-RED-ROSE"
 */
export function buildStickerCode(
  category: string,
  subcategory: string,
  name: string,
): string {
  const segments = [category, subcategory, name].map(toCanonicalCode);
  return segments.join("-");
}

/**
 * Derive the category code from a fully-qualified sticker code.
 * Assumes the first segment is the category.
 *
 * Example:
 *   extractCategory("FLORA-FANA-ROSES-RED-ROSE") → "FLORA-FANA"
 *   (returns only the first two segments for 3-tier taxonomy)
 */
export function extractCategory(code: string, depth = 2): string {
  return code.split("-").slice(0, depth).join("-");
}

/**
 * Normalise a raw filename (e.g. from Synology NAS upload) into a
 * canonical sticker code. Strips extensions, replaces spaces/underscores.
 *
 * Example:
 *   normalizeFilename("red_rose_sticker.png") → "RED-ROSE-STICKER"
 */
export function normalizeFilename(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "");
  return toCanonicalCode(noExt.replace(/_/g, "-"));
}

/**
 * Batch-normalize an array of raw names.
 * Returns a deduplicated array of CanonicalCode objects, sorted alphabetically.
 */
export function batchNormalize(raws: string[]): CanonicalCode[] {
  const seen = new Set<string>();
  const results: CanonicalCode[] = [];

  for (const raw of raws) {
    const parsed = parseCanonical(raw);
    if (!seen.has(parsed.code)) {
      seen.add(parsed.code);
      results.push(parsed);
    }
  }

  return results.sort((a, b) => a.code.localeCompare(b.code));
}

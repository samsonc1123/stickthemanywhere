/**
 * core-logic/engines.ts
 *
 * Portable, pure TypeScript intelligence engines.
 * Zero Convex imports — runs in Node, Bun, Deno, browser, or Docker.
 * Safe to import into any layer of the Sovereign Mainframe stack.
 */

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — GEMATRIA ENGINE (Standard / Mispar Hechrachi)
// ═══════════════════════════════════════════════════════════════════

/** Standard 22-letter table + sofit forms at base values */
const STANDARD: Record<string, number> = {
  "\u05D0": 1,   // א  Aleph
  "\u05D1": 2,   // ב  Bet
  "\u05D2": 3,   // ג  Gimel
  "\u05D3": 4,   // ד  Dalet
  "\u05D4": 5,   // ה  He
  "\u05D5": 6,   // ו  Vav
  "\u05D6": 7,   // ז  Zayin
  "\u05D7": 8,   // ח  Het
  "\u05D8": 9,   // ט  Tet
  "\u05D9": 10,  // י  Yod
  "\u05DB": 20,  // כ  Kaf
  "\u05DC": 30,  // ל  Lamed
  "\u05DE": 40,  // מ  Mem
  "\u05E0": 50,  // נ  Nun
  "\u05E1": 60,  // ס  Samekh
  "\u05E2": 70,  // ע  Ayin
  "\u05E4": 80,  // פ  Pe
  "\u05E6": 90,  // צ  Tzadi
  "\u05E7": 100, // ק  Qof
  "\u05E8": 200, // ר  Resh
  "\u05E9": 300, // ש  Shin
  "\u05EA": 400, // ת  Tav
  "\u05DA": 20,  // ך  Final Kaf  (base)
  "\u05DD": 40,  // ם  Final Mem  (base)
  "\u05DF": 50,  // ן  Final Nun  (base)
  "\u05E3": 80,  // ף  Final Pe   (base)
  "\u05E5": 90,  // ץ  Final Tzadi (base)
};

/** Extended sofit values (500–900) used when useFinalValues = true */
const FINAL_EXTENDED: Record<string, number> = {
  "\u05DA": 500, // ך  Final Kaf
  "\u05DD": 600, // ם  Final Mem
  "\u05DF": 700, // ן  Final Nun
  "\u05E3": 800, // ף  Final Pe
  "\u05E5": 900, // ץ  Final Tzadi
};

export interface GematriaOptions {
  useFinalValues?: boolean;
}

export interface GematriaResult {
  input: string;
  standard: number;
  reduced: number;
  perLetter: Array<{ char: string; value: number }>;
}

/**
 * Calculate the Standard Gematria (Mispar Hechrachi) value of a Hebrew string.
 * Non-Hebrew characters score 0 and are included in perLetter for transparency.
 */
export function calculateGematria(
  text: string,
  opts: GematriaOptions = {}
): GematriaResult {
  const table = opts.useFinalValues
    ? { ...STANDARD, ...FINAL_EXTENDED }
    : STANDARD;

  let standard = 0;
  const perLetter: Array<{ char: string; value: number }> = [];

  for (const char of text) {
    const value = table[char] ?? 0;
    standard += value;
    perLetter.push({ char, value });
  }

  return {
    input: text,
    standard,
    reduced: reduceToDigit(standard),
    perLetter,
  };
}

/**
 * Theosophical reduction — sum the digits repeatedly until single digit.
 * e.g. 432 → 4+3+2 = 9
 */
export function reduceToDigit(n: number): number {
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — REDESIGN ANALYZER ENGINE
// ═══════════════════════════════════════════════════════════════════

export type TrustSignal =
  | "reviews"
  | "social-proof"
  | "security-seals"
  | "testimonials"
  | "awards"
  | "press-mentions"
  | "money-back-guarantee"
  | "certifications";

export type RedesignVerdict = "PRIMARY_TARGET" | "MONITOR" | "PASS";

export interface RedesignLead {
  businessName: string;
  url: string;
  visualScore: number;
  hasMobileResponsiveness: boolean;
  ctaCount: number;
  loadTimeSpeed: number;
  trustSignals: TrustSignal[];
  notes?: string;
}

export interface RedesignAnalysis {
  verdict: RedesignVerdict;
  score: number;
  reasons: string[];
  recommendations: string[];
}

/**
 * Pure redesign analyzer. No DB — pass any lead object in and get
 * a structured verdict back.
 *
 * Scoring:
 *   visualScore < 4                  → PRIMARY_TARGET
 *   visualScore 4–6 + any other flag → MONITOR
 *   else                             → PASS
 */
export function redesignAnalyzer(
  lead: RedesignLead,
  opts: { visualScoreThreshold?: number } = {}
): RedesignAnalysis {
  const threshold = opts.visualScoreThreshold ?? 4;
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // ── Visual score ──────────────────────────────────────────────
  if (lead.visualScore < threshold) {
    reasons.push(`Visual score ${lead.visualScore} is below threshold (${threshold}).`);
    recommendations.push("Full redesign required — visual identity is weak.");
  }

  // ── Mobile responsiveness ─────────────────────────────────────
  if (!lead.hasMobileResponsiveness) {
    reasons.push("Site fails mobile responsiveness check.");
    recommendations.push("Implement responsive layout with viewport meta tag.");
  }

  // ── CTA density ───────────────────────────────────────────────
  if (lead.ctaCount === 0) {
    reasons.push("No call-to-action elements detected on homepage.");
    recommendations.push("Add at least one primary CTA above the fold.");
  } else if (lead.ctaCount > 7) {
    reasons.push(`CTA overload: ${lead.ctaCount} CTAs detected (cognitive friction risk).`);
    recommendations.push("Reduce CTAs to 1–3 primary actions.");
  }

  // ── Load speed ────────────────────────────────────────────────
  if (lead.loadTimeSpeed > 3000) {
    reasons.push(`Load time ${lead.loadTimeSpeed}ms exceeds 3s threshold.`);
    recommendations.push("Compress images, enable caching, and consider a CDN.");
  }

  // ── Trust signals ─────────────────────────────────────────────
  if (lead.trustSignals.length === 0) {
    reasons.push("No trust signals detected.");
    recommendations.push("Add reviews, security seals, or testimonials.");
  }

  // ── Verdict ───────────────────────────────────────────────────
  let verdict: RedesignVerdict;
  if (lead.visualScore < threshold) {
    verdict = "PRIMARY_TARGET";
  } else if (reasons.length > 0) {
    verdict = "MONITOR";
  } else {
    verdict = "PASS";
  }

  return {
    verdict,
    score: lead.visualScore,
    reasons,
    recommendations,
  };
}

/**
 * Batch-analyze an array of leads.
 * Returns only PRIMARY_TARGET and MONITOR results, sorted by score ascending.
 */
export function batchAnalyze(
  leads: RedesignLead[],
  opts: { visualScoreThreshold?: number } = {}
): Array<RedesignLead & { analysis: RedesignAnalysis }> {
  return leads
    .map((lead) => ({ ...lead, analysis: redesignAnalyzer(lead, opts) }))
    .filter((r) => r.analysis.verdict !== "PASS")
    .sort((a, b) => a.visualScore - b.visualScore);
}

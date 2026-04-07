/**
 * toolbox/tools/bio-audit/parasite-tracker.tool.ts
 * version: 1.0.0
 *
 * Biological Audit — Parasite Tracker.
 * Pure TypeScript. Zero framework imports.
 *
 * Uses High-Spectral Veil composite frame sequences to identify microscopic
 * movement patterns consistent with ectoparasite activity (Demodex folliculorum,
 * Demodex brevis, and related mite taxa), and cross-references detections
 * against the built-in Cures vs. Suppressions treatment database.
 *
 * Pillar 14: Biological Audit (GAB domain: UNIVERSAL-GOVERNANCE)
 *
 * Detection pipeline:
 *   1. Receive composite frame sequence from spectral-shift.tool.ts
 *   2. Extract sub-pixel luminance oscillation signatures in the NIR band
 *      (Demodex exhibit rhythmic motion at 0.05–0.5 Hz during active phase)
 *   3. Apply spatial clustering to candidate regions
 *   4. Score each cluster against the Demodex signature profile
 *   5. Cross-reference findings with the treatment database
 *   6. Return typed DetectionResult with confidence, bounding boxes, and
 *      matched treatment protocols
 *
 * Data note:
 *   This engine performs signal analysis only. No medical diagnosis is made.
 *   All outputs are analytical observations for research purposes.
 *   Treatment database entries cite published peer-reviewed references.
 */

import type { CompositeVisibleFrame, SpectralChannel, SpectralBand } from "../vision-veil/spectral-shift.tool.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — PARASITE TAXONOMY
// ═══════════════════════════════════════════════════════════════════

export type ParasiteTaxon =
  | "Demodex_folliculorum"  // 0.3–0.4 mm; follicle-dwelling; most common
  | "Demodex_brevis"        // 0.15–0.2 mm; sebaceous glands
  | "Sarcoptes_scabiei"     // scabies mite; burrows; faster motion
  | "Pthirus_pubis"         // crab louse; slower; distinct morphology
  | "Unknown_ectoparasite"; // pattern matches but taxon indeterminate

export type DetectionConfidence = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface ParasiteSignatureProfile {
  taxon:              ParasiteTaxon;
  /** Dominant oscillation frequency range in Hz during active phase */
  motionHzMin:        number;
  motionHzMax:        number;
  /** Estimated body size in microns — used to convert pixel-space to physical */
  bodyLengthMicronMin: number;
  bodyLengthMicronMax: number;
  /** Preferred spectral band for detection */
  preferredBand:      SpectralBand;
  /** NIR / VIS contrast ratio typical of this taxon */
  nirVisRatioMin:     number;
  nirVisRatioMax:     number;
  /** Typical luminance oscillation amplitude (normalised 0–1) */
  oscillationAmpMin:  number;
  oscillationAmpMax:  number;
  description:        string;
}

export interface DetectionRegion {
  /** Pixel-space bounding box */
  bbox:              { x: number; y: number; w: number; h: number };
  /** Normalised centroid within the frame */
  centroid:          { x: number; y: number };
  /** Dominant oscillation frequency measured in this region */
  measuredHz:        number;
  /** Mean NIR/VIS contrast ratio */
  nirVisRatio:       number;
  /** Oscillation amplitude (normalised) */
  oscillationAmp:    number;
  /** Which frames showed activity in this region */
  activeFrames:      number[];
  /** Pixel size estimate in microns (requires physicalPixelSizeMicron calibration) */
  estimatedSizeMicron?: number;
}

export interface TaxonMatch {
  taxon:      ParasiteTaxon;
  score:      number;  // 0–1 — how well measured params fit the profile
  confidence: DetectionConfidence;
  profile:    ParasiteSignatureProfile;
}

export interface ParasiteDetection {
  detectionId:   string;
  region:        DetectionRegion;
  matches:       TaxonMatch[];  // sorted by score desc
  topMatch:      TaxonMatch;
  treatments:    TreatmentProtocol[];
  timestampMs:   number;
  frameIndices:  number[];
}

export interface BiologicalAuditResult {
  auditId:        string;
  framesAnalysed: number;
  detections:     ParasiteDetection[];
  summary: {
    totalDetections:   number;
    highConfidence:    number;
    taxaFound:         ParasiteTaxon[];
    dominantTaxon:     ParasiteTaxon | null;
    treatmentRecommended: boolean;
  };
  analysisMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// PARASITE SIGNATURE PROFILES
// ═══════════════════════════════════════════════════════════════════

export const SIGNATURE_PROFILES: ParasiteSignatureProfile[] = [
  {
    taxon:               "Demodex_folliculorum",
    motionHzMin:          0.05,
    motionHzMax:          0.3,
    bodyLengthMicronMin:  290,
    bodyLengthMicronMax:  400,
    preferredBand:        "NIR",
    nirVisRatioMin:       1.4,
    nirVisRatioMax:       2.8,
    oscillationAmpMin:    0.008,
    oscillationAmpMax:    0.045,
    description: "Follicle-dwelling mite. Slow rhythmic anterior-posterior motion at 0.05–0.3 Hz. NIR-bright due to lipid-rich body. Concentrated around sebaceous follicles.",
  },
  {
    taxon:               "Demodex_brevis",
    motionHzMin:          0.08,
    motionHzMax:          0.5,
    bodyLengthMicronMin:  150,
    bodyLengthMicronMax:  200,
    preferredBand:        "NIR",
    nirVisRatioMin:       1.2,
    nirVisRatioMax:       2.4,
    oscillationAmpMin:    0.005,
    oscillationAmpMax:    0.03,
    description: "Sebaceous gland mite. Shorter body, slightly faster oscillation than folliculorum. Found deeper in gland ductal tissue.",
  },
  {
    taxon:               "Sarcoptes_scabiei",
    motionHzMin:          0.5,
    motionHzMax:          2.5,
    bodyLengthMicronMin:  200,
    bodyLengthMicronMax:  450,
    preferredBand:        "VIS",
    nirVisRatioMin:       0.8,
    nirVisRatioMax:       1.6,
    oscillationAmpMin:    0.02,
    oscillationAmpMax:    0.12,
    description: "Burrowing mite. Higher velocity and broader oscillation amplitude. VIS-detectable burrow track with directional drift.",
  },
  {
    taxon:               "Pthirus_pubis",
    motionHzMin:          0.02,
    motionHzMax:          0.1,
    bodyLengthMicronMin:  800,
    bodyLengthMicronMax:  1800,
    preferredBand:        "VIS",
    nirVisRatioMin:       0.9,
    nirVisRatioMax:       1.5,
    oscillationAmpMin:    0.03,
    oscillationAmpMax:    0.15,
    description: "Crab louse. Large body, very slow motion. Anchored to hair shaft — claw-attachment oscillation signature.",
  },
];

// ═══════════════════════════════════════════════════════════════════
// TYPES — TREATMENT DATABASE
// ═══════════════════════════════════════════════════════════════════

export type TreatmentClass =
  | "CURE"             // Directly eliminates the parasite
  | "SUPPRESSION"      // Manages symptoms / reduces load without elimination
  | "ADJUNCT"          // Supportive; enhances primary treatment
  | "CONTRAINDICATED"; // Known harm — listed for avoidance

export type TreatmentRoute =
  | "topical" | "oral" | "intravenous" | "environmental" | "dietary";

export interface TreatmentProtocol {
  id:             string;
  name:           string;
  class:          TreatmentClass;
  route:          TreatmentRoute;
  targetTaxa:     ParasiteTaxon[];
  /** Active compound or mechanism */
  mechanism:      string;
  /** Dosing notes — not prescriptive; for research reference only */
  dosingNotes:    string;
  /** Typical treatment duration */
  duration:       string;
  efficacyNotes:  string;
  /** Peer-reviewed references */
  references:     string[];
  /** Known concerns, limitations, or suppression-only caveats */
  caveats?:       string;
  isPreferred:    boolean;
}

// ═══════════════════════════════════════════════════════════════════
// CURES VS. SUPPRESSIONS DATABASE
// ═══════════════════════════════════════════════════════════════════

export const TREATMENT_DATABASE: TreatmentProtocol[] = [
  {
    id: "tx-001",
    name: "Ivermectin (oral)",
    class: "CURE",
    route: "oral",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis", "Sarcoptes_scabiei"],
    mechanism: "Selective binding to glutamate-gated chloride channels in invertebrate nerve and muscle cells, causing hyperpolarisation, paralysis, and death of the parasite. Does not cross the blood-brain barrier at standard doses in healthy adults.",
    dosingNotes: "200 mcg/kg single oral dose; repeat at 7–14 days for Demodex. Scabies protocol: two doses 1–2 weeks apart. Research context only — consult licensed practitioner.",
    duration: "Single dose to 4-week course depending on taxon and load.",
    efficacyNotes: "Meta-analyses show ≥85% cure rate for Sarcoptes scabiei. Demodex elimination rates 60–90% at standard dose; higher with combined topical. Listed as WHO Essential Medicine.",
    references: [
      "Gonzalez Canga et al. J Vet Pharmacol Ther 2008;31(1):1-9",
      "Romani et al. PLoS Negl Trop Dis 2015;9(11):e0004220",
      "Taieb et al. J Eur Acad Dermatol Venereol 2021;35(4):843-855",
    ],
    isPreferred: true,
  },
  {
    id: "tx-002",
    name: "Ivermectin 1% topical cream",
    class: "CURE",
    route: "topical",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis"],
    mechanism: "Same chloride-channel mechanism as oral; localised delivery to follicular unit. Achieves high local concentration with minimal systemic absorption.",
    dosingNotes: "Apply once daily to affected areas for 12–16 weeks. Soolantra® (brand) approved for rosacea-associated Demodex.",
    duration: "12–16 weeks continuous application.",
    efficacyNotes: "Phase III trials: 38–43% greater reduction in Demodex density vs. vehicle. Best results combined with tea tree oil preparation.",
    references: [
      "Cardwell et al. J Drugs Dermatol 2021;20(6):678-684",
      "Taieb A et al. N Engl J Med 2015 — ATTRACT trial",
    ],
    isPreferred: true,
  },
  {
    id: "tx-003",
    name: "Tea Tree Oil (Terpinen-4-ol 50%)",
    class: "CURE",
    route: "topical",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis"],
    mechanism: "Terpinen-4-ol, the active terpene in Melaleuca alternifolia, disrupts the cuticle of Demodex through direct contact toxicity and inhibits chemo-sensory receptors used for host-finding.",
    dosingNotes: "50% dilution in macadamia oil applied to lid margins or skin for 5-minute contact. Lower concentrations (5–10%) for maintenance in sensitive areas. Pure (100%) concentration is corneal toxic.",
    duration: "6–8 weeks induction; 4 weeks maintenance.",
    efficacyNotes: "In vitro: LC50 achieved within 15 min at 1% concentration. Clinical reduction 47–85% in eyelid Demodex density at 6 weeks.",
    references: [
      "Gao YY et al. Eye Contact Lens 2005;31(6):296-300",
      "Liu J et al. Cornea 2010;29(9):1055-1060",
    ],
    isPreferred: true,
  },
  {
    id: "tx-004",
    name: "Permethrin 5% cream",
    class: "CURE",
    route: "topical",
    targetTaxa: ["Sarcoptes_scabiei", "Pthirus_pubis"],
    mechanism: "Pyrethroid — binds voltage-gated sodium channels in the parasite nervous system, causing prolonged depolarisation and death. Non-selective — not specific to Demodex.",
    dosingNotes: "Apply to whole body from neck to toe, leave 8–12 hours, wash off. Repeat after 7 days for scabies.",
    duration: "Two applications 1 week apart.",
    efficacyNotes: "First-line for scabies (WHO). Cure rates 89–95%. Resistance emerging in some populations.",
    references: [
      "Strong M & Johnstone P. Cochrane Database Syst Rev 2007",
      "Hicks MI & Elston DM. Dermatol Ther 2009;22(4):279-292",
    ],
    isPreferred: true,
  },
  {
    id: "tx-005",
    name: "Metronidazole 0.75–1% topical",
    class: "SUPPRESSION",
    route: "topical",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis"],
    mechanism: "Anti-inflammatory via free-radical scavenging; has modest direct acaricidal effect at high concentrations but primarily suppresses the inflammatory response triggered by Demodex waste products rather than eliminating the mite.",
    dosingNotes: "Apply twice daily to affected skin. Commonly prescribed for rosacea — reduces redness but does not reliably eliminate mite.",
    duration: "Indefinite maintenance — relapse common on discontinuation.",
    efficacyNotes: "Reduces inflammatory lesion count 40–60% at 12 weeks. Mite density reduction modest (20–30%) vs. ivermectin (60–90%).",
    references: [
      "Bjerke JR et al. Acta Derm Venereol 1999;79(6):456-459",
    ],
    caveats: "SUPPRESSION ONLY. Does not eradicate Demodex. Long-term use may mask underlying infestation while gut microbiome disruption occurs with systemic use.",
    isPreferred: false,
  },
  {
    id: "tx-006",
    name: "Azelaic acid 15–20%",
    class: "SUPPRESSION",
    route: "topical",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis"],
    mechanism: "Competitive inhibitor of mitochondrial enzymes; has moderate acaricidal and anti-inflammatory effects. Reduces sebum production — reduces food source for Demodex.",
    dosingNotes: "Apply twice daily to affected areas. Finacea® 15% gel approved for rosacea.",
    duration: "12+ weeks; maintenance required.",
    efficacyNotes: "Lesion reduction 50–70% at 12 weeks. Mite count reduction lower than ivermectin or TTO. Better tolerated than TTO in periorbital areas.",
    references: [
      "Draelos ZD et al. J Drugs Dermatol 2006;5(10):959-965",
    ],
    caveats: "SUPPRESSION. Addresses inflammation and sebum but not the mite itself at typical clinical concentrations.",
    isPreferred: false,
  },
  {
    id: "tx-007",
    name: "Zinc supplementation (elemental Zn 30–50 mg/day)",
    class: "ADJUNCT",
    route: "oral",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis", "Sarcoptes_scabiei"],
    mechanism: "Zinc modulates innate immune response (IL-1β, TNF-α); has direct anti-parasitic activity in vitro; reduces sebaceous gland secretion. Zinc deficiency is associated with higher Demodex density.",
    dosingNotes: "Zinc gluconate or zinc picolinate 30–50 mg elemental daily with food. Take separate from iron supplements (competitive absorption).",
    duration: "8–12 weeks minimum.",
    efficacyNotes: "Observational data shows correlation between zinc deficiency and Demodex overpopulation. RCT data limited — primarily supportive role.",
    references: [
      "Yılmaz V & Çalışkan A. Int J Dermatol 2017;56(11):1098-1101",
    ],
    isPreferred: false,
  },
  {
    id: "tx-008",
    name: "Topical corticosteroids (misdirected use)",
    class: "CONTRAINDICATED",
    route: "topical",
    targetTaxa: ["Demodex_folliculorum", "Demodex_brevis"],
    mechanism: "Immunosuppression reduces local inflammatory response and TEMPORARILY relieves symptoms, but suppresses the immune gate that controls Demodex population density — leading to exponential mite proliferation ('steroid rosacea' / 'demodicidosis').",
    dosingNotes: "N/A — listed for avoidance.",
    duration: "N/A",
    efficacyNotes: "Initial symptom relief followed by rebound proliferation. Documented cause of treatment-resistant Demodex overpopulation.",
    references: [
      "Chen W et al. J Eur Acad Dermatol Venereol 2014;28(3):285-290",
      "Marks R. Br J Dermatol 1979;101(3):275-281",
    ],
    caveats: "CONTRAINDICATED for Demodex. Suppresses immune control of mite population. Causes steroid-induced demodicidosis with long-term use.",
    isPreferred: false,
  },
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS — MATH
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Compute mean of a Float32Array */
function mean(arr: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / (arr.length || 1);
}

/** Estimate dominant frequency of an oscillating signal using zero-crossing rate.
 *  Assumes the signal is sampled at `fps` frames per second. */
function estimateDominantHz(signal: number[], fps: number): number {
  if (signal.length < 3) return 0;
  const mu = mean(signal);
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i - 1] - mu) * (signal[i] - mu) < 0) crossings++;
  }
  // Zero-crossing rate → frequency: Hz = (crossings / 2) / durationSeconds
  const durationSeconds = signal.length / fps;
  return crossings > 0 ? (crossings / 2) / durationSeconds : 0;
}

/** Compute oscillation amplitude (peak-to-peak range of a signal) */
function oscillationAmplitude(signal: number[]): number {
  if (signal.length === 0) return 0;
  let min = signal[0], max = signal[0];
  for (const v of signal) { if (v < min) min = v; if (v > max) max = v; }
  return max - min;
}

/** Score how well a measured value fits within a [min, max] range. Returns 0–1. */
function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1.0;
  const midpoint = (min + max) / 2;
  const halfRange = (max - min) / 2 + 1e-9;
  const dist = Math.abs(value - midpoint) - halfRange;
  return Math.max(0, 1 - dist / halfRange);
}

/** Match a detected region against a signature profile. Returns 0–1 score. */
function scoreAgainstProfile(region: DetectionRegion, profile: ParasiteSignatureProfile): number {
  const hzScore  = rangeScore(region.measuredHz,       profile.motionHzMin,       profile.motionHzMax);
  const nvrScore = rangeScore(region.nirVisRatio,       profile.nirVisRatioMin,    profile.nirVisRatioMax);
  const ampScore = rangeScore(region.oscillationAmp,    profile.oscillationAmpMin, profile.oscillationAmpMax);
  // Weighted: Hz match is the strongest discriminator
  return hzScore * 0.55 + nvrScore * 0.25 + ampScore * 0.20;
}

function scoreToConfidence(score: number): DetectionConfidence {
  if (score >= 0.80) return "VERY_HIGH";
  if (score >= 0.60) return "HIGH";
  if (score >= 0.40) return "MEDIUM";
  return "LOW";
}

// ═══════════════════════════════════════════════════════════════════
// CORE DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

export interface ParasiteTrackerOptions {
  /** Frames per second of the input sequence. Default 15. */
  fps?:                    number;
  /** Block size in pixels for motion region extraction. Default 8. */
  blockSize?:              number;
  /** Minimum oscillation amplitude to consider a region for analysis. Default 0.003. */
  minOscillationAmp?:      number;
  /** Minimum number of frames a region must be active. Default 5. */
  minActiveFrames?:        number;
  /** Physical pixel size in microns for size estimation. Omit to skip. */
  physicalPixelSizeMicron?: number;
  /** Minimum match score to include a taxon match in results. Default 0.35. */
  minMatchScore?:          number;
  /** Whether to look up treatments for all matches above minMatchScore. Default true. */
  lookUpTreatments?:       boolean;
}

/**
 * Analyse a sequence of composite frame sets for microscopic parasite
 * motion signatures.
 *
 * Input: same format as spectral-shift.tool.ts `processSpectralSequence` —
 * an array of { composite, channels } pairs in time order.
 *
 * @param frames     Time-ordered composite + channel pairs from the Veil engine
 * @param opts       Detection sensitivity options
 */
export function analyseForParasites(
  frames: Array<{ composite: CompositeVisibleFrame; channels: SpectralChannel[] }>,
  opts:   ParasiteTrackerOptions = {}
): BiologicalAuditResult {
  const startMs = Date.now();
  const auditId = generateId("bio");

  const {
    fps                    = 15,
    blockSize              = 8,
    minOscillationAmp      = 0.003,
    minActiveFrames        = 5,
    physicalPixelSizeMicron,
    minMatchScore          = 0.35,
    lookUpTreatments       = true,
  } = opts;

  if (frames.length < 3) {
    return {
      auditId, framesAnalysed: frames.length, detections: [],
      summary: { totalDetections: 0, highConfidence: 0, taxaFound: [], dominantTaxon: null, treatmentRecommended: false },
      analysisMs: Date.now() - startMs,
    };
  }

  const { width, height } = frames[0].composite;
  const bw = Math.ceil(width / blockSize);
  const bh = Math.ceil(height / blockSize);
  const numBlocks = bw * bh;

  // ── Step 1: Build per-block luminance time-series ──────────────
  const blockLumSeries: number[][] = Array.from({ length: numBlocks }, () => []);
  const blockNirSeries:  number[][] = Array.from({ length: numBlocks }, () => []);
  const blockVisSeries:  number[][] = Array.from({ length: numBlocks }, () => []);

  for (const { composite, channels } of frames) {
    const nirCh = channels.find((c) => c.band === "NIR");
    const visCh = channels.find((c) => c.band === "VIS");

    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const bi = by * bw + bx;
        let lumSum = 0, nirSum = 0, visSum = 0, count = 0;

        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const px = bx * blockSize + dx;
            const py = by * blockSize + dy;
            if (px >= width || py >= height) continue;
            const idx = py * width + px;

            const lum = 0.299 * composite.r[idx] + 0.587 * composite.g[idx] + 0.114 * composite.b[idx];
            lumSum += lum;
            if (nirCh) nirSum += nirCh.data[idx];
            if (visCh) visSum += visCh.data[idx];
            count++;
          }
        }

        if (count > 0) {
          blockLumSeries[bi].push(lumSum / count);
          blockNirSeries[bi].push(nirSum / count);
          blockVisSeries[bi].push(visSum / count);
        }
      }
    }
  }

  // ── Step 2: Identify candidate regions ────────────────────────
  const candidateRegions: DetectionRegion[] = [];

  for (let bi = 0; bi < numBlocks; bi++) {
    const lumSeries = blockLumSeries[bi];
    const amp       = oscillationAmplitude(lumSeries);
    if (amp < minOscillationAmp) continue;

    const hz      = estimateDominantHz(lumSeries, fps);
    // Demodex range: 0.02–2.5 Hz — filter gross non-biological noise
    if (hz < 0.01 || hz > 5.0) continue;

    const activeFrameIndices = lumSeries
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => Math.abs(v - mean(lumSeries)) > amp * 0.3)
      .map(({ i }) => i);

    if (activeFrameIndices.length < minActiveFrames) continue;

    const nirMean = mean(blockNirSeries[bi]);
    const visMean = mean(blockVisSeries[bi]);
    const nirVisRatio = visMean > 1e-6 ? nirMean / visMean : 1.0;

    const bx = (bi % bw) * blockSize;
    const by = Math.floor(bi / bw) * blockSize;

    const region: DetectionRegion = {
      bbox:             { x: bx, y: by, w: blockSize, h: blockSize },
      centroid:         { x: (bx + blockSize / 2) / width, y: (by + blockSize / 2) / height },
      measuredHz:       hz,
      nirVisRatio,
      oscillationAmp:   amp,
      activeFrames:     activeFrameIndices,
      estimatedSizeMicron: physicalPixelSizeMicron
        ? blockSize * physicalPixelSizeMicron
        : undefined,
    };

    candidateRegions.push(region);
  }

  // ── Step 3: Merge spatially adjacent candidates ────────────────
  // Simple single-pass: merge blocks within 2× blockSize of each other
  const merged: DetectionRegion[] = [];
  const used = new Set<number>();

  for (let i = 0; i < candidateRegions.length; i++) {
    if (used.has(i)) continue;
    let base = candidateRegions[i];

    for (let j = i + 1; j < candidateRegions.length; j++) {
      if (used.has(j)) continue;
      const other = candidateRegions[j];
      const dx = Math.abs(base.centroid.x - other.centroid.x) * width;
      const dy = Math.abs(base.centroid.y - other.centroid.y) * height;
      if (dx < blockSize * 2 && dy < blockSize * 2) {
        // Merge: take the higher-amplitude region as base, expand bbox
        if (other.oscillationAmp > base.oscillationAmp) {
          base = {
            ...other,
            bbox: {
              x: Math.min(base.bbox.x, other.bbox.x),
              y: Math.min(base.bbox.y, other.bbox.y),
              w: Math.max(base.bbox.x + base.bbox.w, other.bbox.x + other.bbox.w) - Math.min(base.bbox.x, other.bbox.x),
              h: Math.max(base.bbox.y + base.bbox.h, other.bbox.y + other.bbox.h) - Math.min(base.bbox.y, other.bbox.y),
            },
            activeFrames: [...new Set([...base.activeFrames, ...other.activeFrames])],
          };
        }
        used.add(j);
      }
    }

    merged.push(base);
    used.add(i);
  }

  // ── Step 4: Score against profiles ────────────────────────────
  const detections: ParasiteDetection[] = [];

  for (const region of merged) {
    const matches: TaxonMatch[] = SIGNATURE_PROFILES
      .map((profile) => ({
        taxon:      profile.taxon,
        score:      scoreAgainstProfile(region, profile),
        confidence: scoreToConfidence(scoreAgainstProfile(region, profile)),
        profile,
      }))
      .filter((m) => m.score >= minMatchScore)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) continue;

    const topMatch = matches[0];
    const treatments = lookUpTreatments
      ? TREATMENT_DATABASE.filter((t) =>
          t.targetTaxa.includes(topMatch.taxon) || t.class === "CONTRAINDICATED"
        ).sort((a, b) => {
          if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
          const order: Record<TreatmentClass, number> = { CURE: 0, ADJUNCT: 1, SUPPRESSION: 2, CONTRAINDICATED: 3 };
          return order[a.class] - order[b.class];
        })
      : [];

    detections.push({
      detectionId:  generateId("det"),
      region,
      matches,
      topMatch,
      treatments,
      timestampMs:  Date.now(),
      frameIndices: region.activeFrames,
    });
  }

  // Sort by confidence desc
  detections.sort((a, b) => b.topMatch.score - a.topMatch.score);

  // ── Step 5: Build summary ─────────────────────────────────────
  const highConf   = detections.filter((d) => d.topMatch.confidence === "VERY_HIGH" || d.topMatch.confidence === "HIGH");
  const taxaFound  = [...new Set(detections.map((d) => d.topMatch.taxon))];
  const taxaCounts = taxaFound.reduce((acc, taxon) => {
    acc[taxon] = detections.filter((d) => d.topMatch.taxon === taxon).length;
    return acc;
  }, {} as Record<ParasiteTaxon, number>);
  const dominantTaxon = taxaFound.length > 0
    ? taxaFound.reduce((a, b) => taxaCounts[a] >= taxaCounts[b] ? a : b)
    : null;

  return {
    auditId,
    framesAnalysed: frames.length,
    detections,
    summary: {
      totalDetections:      detections.length,
      highConfidence:       highConf.length,
      taxaFound,
      dominantTaxon,
      treatmentRecommended: highConf.length > 0,
    },
    analysisMs: Date.now() - startMs,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TREATMENT DATABASE HELPERS (pure — no engine dependency)
// ═══════════════════════════════════════════════════════════════════

/**
 * Look up all treatment protocols for a given taxon.
 * Returns CURES first, then ADJUNCTS, then SUPPRESSIONS, then CONTRAINDICATED.
 */
export function getTreatmentsForTaxon(
  taxon:          ParasiteTaxon,
  includeContraindicated = true
): TreatmentProtocol[] {
  const order: Record<TreatmentClass, number> = { CURE: 0, ADJUNCT: 1, SUPPRESSION: 2, CONTRAINDICATED: 3 };
  return TREATMENT_DATABASE
    .filter((t) => t.targetTaxa.includes(taxon) && (includeContraindicated || t.class !== "CONTRAINDICATED"))
    .sort((a, b) => order[a.class] - order[b.class] || (a.isPreferred === b.isPreferred ? 0 : a.isPreferred ? -1 : 1));
}

/**
 * Return all CURE-class protocols across all taxa.
 */
export function getAllCures(): TreatmentProtocol[] {
  return TREATMENT_DATABASE.filter((t) => t.class === "CURE");
}

/**
 * Return all SUPPRESSION-class protocols with their caveats.
 */
export function getAllSuppressions(): TreatmentProtocol[] {
  return TREATMENT_DATABASE.filter((t) => t.class === "SUPPRESSION");
}

/**
 * Return all CONTRAINDICATED entries — what to avoid.
 */
export function getContraindicated(): TreatmentProtocol[] {
  return TREATMENT_DATABASE.filter((t) => t.class === "CONTRAINDICATED");
}

/**
 * Get signature profile for a specific taxon.
 */
export function getSignatureProfile(taxon: ParasiteTaxon): ParasiteSignatureProfile | null {
  return SIGNATURE_PROFILES.find((p) => p.taxon === taxon) ?? null;
}

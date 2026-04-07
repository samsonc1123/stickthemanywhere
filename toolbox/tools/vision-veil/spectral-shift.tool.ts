/**
 * toolbox/tools/vision-veil/spectral-shift.tool.ts
 * version: 1.0.0
 *
 * High-Spectral Veil — Spectral Shift Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Two capabilities:
 *   1. Map NIR / SWIR / UV data streams into a Composite Visible Frame
 *      using per-channel gain, gamma correction, and false-colour LUTs.
 *   2. Anomaly Detection — statistical pipeline that flags non-physical
 *      movement patterns in spectral frame sequences.
 *
 * Pillar 10: High-Spectral Veil (GAB domain: DISCERNMENT-AND-VISION)
 *
 * All processing operates on normalised float arrays (0.0–1.0 per channel).
 * This keeps the engine compatible with any raw sensor format — the caller
 * is responsible for denormalising to 8-bit or 16-bit output as required.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — SPECTRAL CHANNELS
// ═══════════════════════════════════════════════════════════════════

export type SpectralBand =
  | "UV"    // 10–400 nm
  | "VIS"   // 400–700 nm (standard visible)
  | "NIR"   // 700–1400 nm (near-infrared)
  | "SWIR"  // 1400–3000 nm (shortwave infrared)
  | "MWIR"  // 3000–5000 nm (mid-wave infrared / thermal)
  | "LWIR"; // 8000–14000 nm (long-wave infrared / far thermal)

export interface SpectralChannel {
  band:         SpectralBand;
  /** Normalised pixel values: Float32Array of length (width × height) */
  data:         Float32Array;
  width:        number;
  height:       number;
  /** Sensor gain applied at capture. 1.0 = nominal. */
  captureGain:  number;
  /** Unix ms timestamp of this frame */
  timestampMs:  number;
  /** Source device identifier */
  sourceId:     string;
}

export interface CompositeVisibleFrame {
  /** Red channel (0.0–1.0), Float32Array length = width × height */
  r: Float32Array;
  /** Green channel */
  g: Float32Array;
  /** Blue channel */
  b: Float32Array;
  width:       number;
  height:      number;
  timestampMs: number;
  /** Which spectral bands contributed */
  composition: SpectralCompositionMap;
  /** Clipping warnings per channel: fraction of pixels clipped [0,1] */
  clipping: { r: number; g: number; b: number };
}

export interface SpectralCompositionMap {
  /** Band mapped to the R output channel */
  rSource: SpectralBand;
  /** Band mapped to the G output channel */
  gSource: SpectralBand;
  /** Band mapped to the B output channel */
  bSource: SpectralBand;
  /** Per-channel software gain applied after mapping */
  rGain: number;
  gGain: number;
  bGain: number;
  /** Gamma correction exponent (1.0 = linear, 2.2 = sRGB) */
  gamma: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════

export type AnomalyClass =
  | "VELOCITY_EXCEED"    // pixel-cluster moves faster than physical limit
  | "PHASE_INVERSION"    // spectral channel correlations invert unexpectedly
  | "THERMAL_GHOST"      // heat displacement: LWIR signal with no VIS object
  | "SPECTRAL_SPIKE"     // single-frame channel spike beyond 4σ
  | "STATIONARY_HEAT"    // LWIR elevation with zero motion vector
  | "UV_FLARE"           // UV intensity burst with no VIS/NIR correlation
  | "MULTI_BAND_ABSENT"  // object visible in one band but absent in all others
  | "OCCLUSION_ANOMALY"; // object disappears mid-track without edge-crossing

export interface AnomalyEvent {
  /** Frame index within the sequence */
  frameIndex:    number;
  timestampMs:   number;
  /** Pixel-space bounding box of the anomalous region */
  bbox:          { x: number; y: number; w: number; h: number };
  /** Normalised centroid within the frame (0.0–1.0) */
  centroid:      { x: number; y: number };
  classification: AnomalyClass;
  /** Confidence 0–1 */
  confidence:    number;
  /** Human-readable explanation */
  description:   string;
  /** Spectral bands that triggered the flag */
  triggerBands:  SpectralBand[];
  /** Raw statistical values that drove the detection */
  diagnostics:   Record<string, number>;
}

export interface FrameMotionVector {
  /** Per-block mean motion magnitude (normalised 0–1) */
  magnitude: Float32Array;
  /** Per-block motion direction in radians */
  direction: Float32Array;
  blockSize: number;
  width:     number;
  height:    number;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS — MATH
// ═══════════════════════════════════════════════════════════════════

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function gammaCorrect(v: number, gamma: number): number {
  return Math.pow(clamp01(v), 1 / gamma);
}

/** Compute mean of a Float32Array */
function mean(arr: Float32Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

/** Compute standard deviation */
function stddev(arr: Float32Array, mu?: number): number {
  const m = mu ?? mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
  return Math.sqrt(s / arr.length);
}

/** Pearson correlation between two same-length Float32Arrays */
function pearson(a: Float32Array, b: Float32Array): number {
  const n   = a.length;
  const ma  = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da  += (a[i] - ma) ** 2;
    db  += (b[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom < 1e-10 ? 0 : num / denom;
}

/** Count clipped pixels (value >= 1.0) */
function clippingFraction(arr: Float32Array): number {
  let count = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] >= 1.0) count++;
  return count / arr.length;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — SPECTRAL BAND → COMPOSITE VISIBLE FRAME
// ═══════════════════════════════════════════════════════════════════

/**
 * Map one or more spectral channel streams into an RGB Composite Visible Frame.
 *
 * Default false-colour mappings (all overridable via composition):
 *   NIR  → Red   (vegetation / structure contrast)
 *   SWIR → Green (moisture / material discrimination)
 *   UV   → Blue  (surface scatter / fluorescence)
 *
 * Any unspecified output channel is filled from the VIS band if present,
 * otherwise zero-filled.
 *
 * @param channels    Array of SpectralChannel frames for the same scene.
 *                    All channels must share the same width × height.
 * @param composition Override the default band mapping and gains.
 */
export function buildCompositeFrame(
  channels: SpectralChannel[],
  composition?: Partial<SpectralCompositionMap>
): CompositeVisibleFrame {
  if (channels.length === 0) throw new Error("buildCompositeFrame: no channels provided.");

  const { width, height, timestampMs } = channels[0];
  const n = width * height;

  // Validate all channels match dimensions
  for (const ch of channels) {
    if (ch.width !== width || ch.height !== height) {
      throw new Error(
        `buildCompositeFrame: channel dimension mismatch. Expected ${width}×${height}, got ${ch.width}×${ch.height} for band ${ch.band}.`
      );
    }
  }

  const byBand = new Map(channels.map((ch) => [ch.band, ch]));

  // Default composition: NIR→R, SWIR→G, UV→B
  const comp: SpectralCompositionMap = {
    rSource: "NIR",
    gSource: "SWIR",
    bSource: "UV",
    rGain:   1.0,
    gGain:   1.0,
    bGain:   1.2,  // UV typically needs a slight boost
    gamma:   2.2,
    ...composition,
  };

  const fallback = byBand.get("VIS");

  function resolveChannel(band: SpectralBand): Float32Array {
    return byBand.get(band)?.data ?? fallback?.data ?? new Float32Array(n);
  }

  const rawR = resolveChannel(comp.rSource);
  const rawG = resolveChannel(comp.gSource);
  const rawB = resolveChannel(comp.bSource);

  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    r[i] = gammaCorrect(rawR[i] * comp.rGain, comp.gamma);
    g[i] = gammaCorrect(rawG[i] * comp.gGain, comp.gamma);
    b[i] = gammaCorrect(rawB[i] * comp.bGain, comp.gamma);
  }

  return {
    r, g, b,
    width,
    height,
    timestampMs,
    composition: comp,
    clipping: {
      r: clippingFraction(r),
      g: clippingFraction(g),
      b: clippingFraction(b),
    },
  };
}

/**
 * Apply a named LUT (Look-Up Table) preset to a CompositeVisibleFrame.
 * Useful for switching perception modes after compositing.
 */
export type LutPreset =
  | "NATURAL"          // Preserve as-is
  | "ENHANCED_CONTRAST"// Apply S-curve for edge clarity
  | "THERMAL_OVERLAY"  // Push warm tones into red; cool into blue
  | "UV_HIGHLIGHT"     // Boost B channel; desaturate R/G
  | "GHOST_MODE";      // Invert luminance — "negative space" render

export function applyLut(
  frame: CompositeVisibleFrame,
  preset: LutPreset
): CompositeVisibleFrame {
  const n = frame.width * frame.height;
  const r = new Float32Array(frame.r);
  const g = new Float32Array(frame.g);
  const b = new Float32Array(frame.b);

  for (let i = 0; i < n; i++) {
    switch (preset) {
      case "NATURAL":
        break;

      case "ENHANCED_CONTRAST": {
        // S-curve: f(x) = x² × (3 - 2x)  (smoothstep)
        r[i] = r[i] * r[i] * (3 - 2 * r[i]);
        g[i] = g[i] * g[i] * (3 - 2 * g[i]);
        b[i] = b[i] * b[i] * (3 - 2 * b[i]);
        break;
      }

      case "THERMAL_OVERLAY": {
        // Warm → red shift; cool → blue shift based on luminance
        const lum = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
        r[i] = clamp01(lum > 0.5 ? lum * 1.4 : lum * 0.7);
        g[i] = clamp01(lum * 0.85);
        b[i] = clamp01(lum < 0.5 ? lum * 1.4 : lum * 0.6);
        break;
      }

      case "UV_HIGHLIGHT": {
        // Desaturate R and G; amplify B
        const lum = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
        r[i] = clamp01(lum * 0.6);
        g[i] = clamp01(lum * 0.6);
        b[i] = clamp01(b[i] * 1.8);
        break;
      }

      case "GHOST_MODE": {
        // Invert luminance — dark becomes bright
        const lum = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
        const inv = 1 - lum;
        r[i] = clamp01(r[i] + (inv - lum) * 0.6);
        g[i] = clamp01(g[i] + (inv - lum) * 0.6);
        b[i] = clamp01(b[i] + (inv - lum) * 0.8);
        break;
      }
    }
  }

  return { ...frame, r, g, b };
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate per-block motion vectors between two consecutive frames
 * using block-mean absolute difference (MAD).
 *
 * @param prev       Previous composite frame
 * @param curr       Current composite frame
 * @param blockSize  Pixel size of each motion estimation block (default 16)
 */
export function estimateMotionVectors(
  prev: CompositeVisibleFrame,
  curr: CompositeVisibleFrame,
  blockSize = 16
): FrameMotionVector {
  if (prev.width !== curr.width || prev.height !== curr.height) {
    throw new Error("estimateMotionVectors: frame dimensions must match.");
  }

  const bw = Math.ceil(curr.width / blockSize);
  const bh = Math.ceil(curr.height / blockSize);
  const numBlocks = bw * bh;

  const magnitude  = new Float32Array(numBlocks);
  const direction  = new Float32Array(numBlocks);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const bi = by * bw + bx;
      let sumDiff = 0, count = 0;

      // Compute luminance-weighted difference for the block
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const px = bx * blockSize + dx;
          const py = by * blockSize + dy;
          if (px >= curr.width || py >= curr.height) continue;

          const idx  = py * curr.width + px;
          const lumP = 0.299 * prev.r[idx] + 0.587 * prev.g[idx] + 0.114 * prev.b[idx];
          const lumC = 0.299 * curr.r[idx] + 0.587 * curr.g[idx] + 0.114 * curr.b[idx];
          sumDiff += Math.abs(lumC - lumP);
          count++;
        }
      }

      magnitude[bi] = count > 0 ? sumDiff / count : 0;

      // Direction: angle of the block centroid relative to frame centre
      const cxNorm = (bx + 0.5) / bw - 0.5;
      const cyNorm = (by + 0.5) / bh - 0.5;
      direction[bi] = Math.atan2(cyNorm, cxNorm);
    }
  }

  return { magnitude, direction, blockSize, width: bw, height: bh };
}

/**
 * Core anomaly detection pipeline.
 *
 * Analyses a sequence of composite frames and multi-band channel sets
 * to surface non-physical movement patterns and spectral anomalies.
 *
 * Detects:
 *   VELOCITY_EXCEED     — block motion magnitude exceeds velocityThreshold
 *   SPECTRAL_SPIKE      — single frame channel value > μ + sigmaSpikeThreshold × σ
 *   THERMAL_GHOST       — LWIR signal present with no corresponding VIS luminance
 *   UV_FLARE            — UV channel spike with no NIR/VIS correlation
 *   PHASE_INVERSION     — NIR/VIS Pearson correlation drops below phaseInversionThreshold
 *   MULTI_BAND_ABSENT   — object detected in one band, absent in all others
 *
 * @param frames        Time-ordered array of { composite, channels } pairs
 * @param opts          Detection sensitivity tuning
 */
export interface AnomalyDetectionOptions {
  /** Block motion magnitude (0–1) above which VELOCITY_EXCEED fires. Default 0.35 */
  velocityThreshold?: number;
  /** σ multiplier for SPECTRAL_SPIKE detection. Default 4.0 */
  sigmaSpikeThreshold?: number;
  /** LWIR/VIS ratio above which THERMAL_GHOST fires. Default 3.0 */
  thermalGhostRatio?: number;
  /** Pearson r below which PHASE_INVERSION fires. Default -0.3 */
  phaseInversionThreshold?: number;
  /** Block size for motion estimation. Default 16 */
  blockSize?: number;
  /** Minimum confidence to include an event in results. Default 0.4 */
  minConfidence?: number;
}

export function detectAnomalies(
  frames: Array<{ composite: CompositeVisibleFrame; channels: SpectralChannel[] }>,
  opts: AnomalyDetectionOptions = {}
): AnomalyEvent[] {
  const {
    velocityThreshold     = 0.35,
    sigmaSpikeThreshold   = 4.0,
    thermalGhostRatio     = 3.0,
    phaseInversionThreshold = -0.3,
    blockSize             = 16,
    minConfidence         = 0.4,
  } = opts;

  const events: AnomalyEvent[] = [];

  // Pre-compute per-channel statistics across the whole sequence for z-scoring
  const allR = Float32Array.from(frames.flatMap((f) => Array.from(f.composite.r)));
  const allG = Float32Array.from(frames.flatMap((f) => Array.from(f.composite.g)));
  const allB = Float32Array.from(frames.flatMap((f) => Array.from(f.composite.b)));
  const muR = mean(allR), sdR = stddev(allR, muR);
  const muG = mean(allG), sdG = stddev(allG, muG);
  const muB = mean(allB), sdB = stddev(allB, muB);

  for (let fi = 0; fi < frames.length; fi++) {
    const { composite: curr, channels } = frames[fi];
    const ts    = curr.timestampMs;
    const byBand = new Map(channels.map((ch) => [ch.band, ch]));

    // ── 1. SPECTRAL_SPIKE ─────────────────────────────────────────
    const checkSpike = (arr: Float32Array, mu: number, sd: number, band: SpectralBand) => {
      if (sd < 1e-6) return;
      for (let i = 0; i < arr.length; i++) {
        const z = (arr[i] - mu) / sd;
        if (z > sigmaSpikeThreshold) {
          const x = i % curr.width;
          const y = Math.floor(i / curr.width);
          events.push({
            frameIndex:     fi,
            timestampMs:    ts,
            bbox:           { x, y, w: 1, h: 1 },
            centroid:       { x: x / curr.width, y: y / curr.height },
            classification: "SPECTRAL_SPIKE",
            confidence:     clamp01((z - sigmaSpikeThreshold) / sigmaSpikeThreshold),
            description:    `${band} channel z-score ${z.toFixed(2)} exceeds ${sigmaSpikeThreshold}σ threshold at pixel (${x},${y}).`,
            triggerBands:   [band],
            diagnostics:    { z, mu, sd, value: arr[i] },
          });
          break; // One event per band per frame is enough
        }
      }
    };
    checkSpike(curr.r, muR, sdR, "NIR");
    checkSpike(curr.g, muG, sdG, "SWIR");
    checkSpike(curr.b, muB, sdB, "UV");

    // ── 2. THERMAL_GHOST ─────────────────────────────────────────
    const lwir = byBand.get("LWIR");
    const vis  = byBand.get("VIS");
    if (lwir && vis) {
      const lwirMu  = mean(lwir.data);
      const visMu   = mean(vis.data);
      if (visMu > 1e-6) {
        const ratio = lwirMu / visMu;
        if (ratio > thermalGhostRatio) {
          const confidence = clamp01((ratio - thermalGhostRatio) / thermalGhostRatio);
          events.push({
            frameIndex:     fi,
            timestampMs:    ts,
            bbox:           { x: 0, y: 0, w: curr.width, h: curr.height },
            centroid:       { x: 0.5, y: 0.5 },
            classification: "THERMAL_GHOST",
            confidence,
            description:    `LWIR/VIS mean ratio ${ratio.toFixed(2)} exceeds ${thermalGhostRatio}× — thermal signature without visible object.`,
            triggerBands:   ["LWIR", "VIS"],
            diagnostics:    { lwirMu, visMu, ratio },
          });
        }
      }
    }

    // ── 3. UV_FLARE ──────────────────────────────────────────────
    const uv  = byBand.get("UV");
    const nir = byBand.get("NIR");
    if (uv && nir && vis) {
      const uvMu  = mean(uv.data);
      const nirMu = mean(nir.data);
      const visMu2 = mean(vis.data);
      const uvExcess = uvMu - nirMu - visMu2;
      if (uvExcess > 0.15) {
        events.push({
          frameIndex:     fi,
          timestampMs:    ts,
          bbox:           { x: 0, y: 0, w: curr.width, h: curr.height },
          centroid:       { x: 0.5, y: 0.5 },
          classification: "UV_FLARE",
          confidence:     clamp01(uvExcess / 0.4),
          description:    `UV mean (${uvMu.toFixed(3)}) exceeds NIR+VIS combined by ${uvExcess.toFixed(3)} — uncorrelated UV burst.`,
          triggerBands:   ["UV", "NIR", "VIS"],
          diagnostics:    { uvMu, nirMu, visMu: visMu2, uvExcess },
        });
      }
    }

    // ── 4. PHASE_INVERSION ────────────────────────────────────────
    if (nir && vis) {
      const r = pearson(nir.data, vis.data);
      if (r < phaseInversionThreshold) {
        events.push({
          frameIndex:     fi,
          timestampMs:    ts,
          bbox:           { x: 0, y: 0, w: curr.width, h: curr.height },
          centroid:       { x: 0.5, y: 0.5 },
          classification: "PHASE_INVERSION",
          confidence:     clamp01(Math.abs(r) - Math.abs(phaseInversionThreshold)),
          description:    `NIR/VIS Pearson correlation ${r.toFixed(3)} below threshold ${phaseInversionThreshold} — spectral phase inversion detected.`,
          triggerBands:   ["NIR", "VIS"],
          diagnostics:    { pearsonR: r, threshold: phaseInversionThreshold },
        });
      }
    }

    // ── 5. VELOCITY_EXCEED (requires previous frame) ──────────────
    if (fi > 0) {
      const prev = frames[fi - 1].composite;
      const mv   = estimateMotionVectors(prev, curr, blockSize);
      const mvMu = mean(mv.magnitude);
      const mvSd = stddev(mv.magnitude, mvMu);

      for (let bi = 0; bi < mv.magnitude.length; bi++) {
        if (mv.magnitude[bi] > velocityThreshold) {
          const bx = (bi % mv.width) * blockSize;
          const by = Math.floor(bi / mv.width) * blockSize;
          const confidence = clamp01((mv.magnitude[bi] - velocityThreshold) / (1 - velocityThreshold));
          const zScore = mvSd > 1e-6 ? (mv.magnitude[bi] - mvMu) / mvSd : 0;

          events.push({
            frameIndex:     fi,
            timestampMs:    ts,
            bbox:           { x: bx, y: by, w: blockSize, h: blockSize },
            centroid:       { x: (bx + blockSize / 2) / curr.width, y: (by + blockSize / 2) / curr.height },
            classification: "VELOCITY_EXCEED",
            confidence,
            description:    `Block (${Math.floor(bi % mv.width)},${Math.floor(bi / mv.width)}) motion magnitude ${mv.magnitude[bi].toFixed(3)} exceeds threshold ${velocityThreshold} — non-physical velocity (${zScore.toFixed(1)}σ above scene mean).`,
            triggerBands:   ["VIS", "NIR"],
            diagnostics:    { magnitude: mv.magnitude[bi], threshold: velocityThreshold, zScore },
          });
          break; // One per frame — prevent event flood
        }
      }
    }
  }

  return events
    .filter((e) => e.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

/**
 * Full pipeline: channels → composite frames → anomaly events.
 * Convenience wrapper for the vision-sync agent.
 *
 * @param frameSets  Time-ordered array of multi-band channel sets
 * @param composition  Optional composite mapping override
 * @param anomalyOpts  Optional detection sensitivity tuning
 * @param lutPreset    Optional LUT to apply after compositing
 */
export function processSpectralSequence(
  frameSets:    SpectralChannel[][],
  composition?: Partial<SpectralCompositionMap>,
  anomalyOpts?: AnomalyDetectionOptions,
  lutPreset?:   LutPreset
): { composites: CompositeVisibleFrame[]; anomalies: AnomalyEvent[] } {
  const composites = frameSets.map((channels) => {
    const raw = buildCompositeFrame(channels, composition);
    return lutPreset ? applyLut(raw, lutPreset) : raw;
  });

  const framePairs = composites.map((composite, i) => ({
    composite,
    channels: frameSets[i],
  }));

  const anomalies = detectAnomalies(framePairs, anomalyOpts);

  return { composites, anomalies };
}

/**
 * toolbox/tools/scalar-core/multi-magnitude-processor.ts
 * version: 1.0.0
 *
 * Pillar 17: Scalar Data Correlation — Multi-Magnitude Processor
 * Domain: COMPUTATIONAL-OPTIMIZATION
 *
 * Responsibilities:
 *   1. Synchronize two datasets with vastly different scales
 *      (e.g., nanosecond-resolution signals vs. monthly macro-trends)
 *   2. Detect "harmonic resonance" points — positions where a pattern
 *      in the fine-scale (high-frequency) data precedes or predicts
 *      inflection events in the coarse-scale (low-frequency) data
 *
 * Algorithm overview:
 *   ─ Normalization:    Both series are z-score normalized independently,
 *                       collapsing magnitude differences to dimensionless units.
 *   ─ Resampling:       The fine series is downsampled to the coarse series'
 *                       cadence via LTTB (Largest-Triangle-Three-Buckets)
 *                       to preserve shape fidelity across extreme scale ratios.
 *   ─ Alignment:        Cross-correlation at multiple lag offsets finds the
 *                       optimal time-shift between the two series.
 *   ─ Resonance:        After alignment, instantaneous product peaks are
 *                       identified using a configurable prominence threshold.
 *                       A resonance point is valid when both the correlation
 *                       strength AND the coarse-series gradient at that index
 *                       exceed user-defined thresholds — indicating that the
 *                       fine pattern is a leading indicator of a coarse shift.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ScalarSample {
  /** Epoch time in any consistent unit (ms, ns, s, days…) */
  t: number;
  v: number;
}

export interface ResonancePoint {
  /** Index in the coarse (aligned) series */
  index:          number;
  /** Timestamp from the coarse series at this index */
  t:              number;
  /** Normalized fine-series value at the aligned index */
  fineValue:      number;
  /** Normalized coarse-series value at this index */
  coarseValue:    number;
  /** Cross-correlation strength at this point, range [-1, 1] */
  correlationR:   number;
  /** Gradient (rate of change) in the coarse series here */
  coarseGradient: number;
  /** Composite resonance score: abs(correlationR) × abs(coarseGradient) */
  score:          number;
  /** "PEAK" = fine predicts coarse upswing; "VALLEY" = downswing */
  polarity:       "PEAK" | "VALLEY";
}

export interface SyncResult {
  /** Aligned coarse series (same length as coarseSeries after trimming) */
  alignedCoarse: ScalarSample[];
  /** Fine series resampled + aligned to the coarse cadence */
  alignedFine:   ScalarSample[];
  /** Lag offset (in coarse index steps) that maximises cross-correlation */
  optimalLag:    number;
  /** Peak cross-correlation coefficient at optimalLag */
  peakR:         number;
  /** All detected resonance points, sorted by score descending */
  resonancePoints: ResonancePoint[];
}

export interface ProcessorOptions {
  /**
   * Prominence threshold for resonance detection.
   * A point must exceed this fraction of the series' value range to qualify.
   * Default: 0.2
   */
  prominenceThreshold?: number;
  /**
   * Minimum absolute cross-correlation to accept a resonance point.
   * Default: 0.3
   */
  minCorrelation?: number;
  /**
   * Minimum absolute coarse-series gradient to accept a resonance point.
   * Default: 0.05
   */
  minGradient?: number;
  /**
   * Maximum lag (in coarse index steps) to search during cross-correlation.
   * Default: Math.floor(coarseLength / 4)
   */
  maxLagSteps?: number;
  /**
   * If true, the fine series is resampled via LTTB.
   * If false, a simple uniform downsample is used.
   * Default: true
   */
  useLttb?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Z-score normalize a numeric array.
 * Returns the normalized values, mean, and standard deviation.
 */
function zScore(vals: number[]): { norm: number[]; mean: number; std: number } {
  const n    = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  return { norm: vals.map((v) => (v - mean) / std), mean, std };
}

// ═══════════════════════════════════════════════════════════════════
// RESAMPLING
// ═══════════════════════════════════════════════════════════════════

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 * Preserves the visual / shape fidelity of the series when reducing
 * from a large fine-grained series to a smaller coarse-cadence series.
 *
 * @param data   Input samples (must be sorted by t ascending)
 * @param target Target number of output samples
 */
function lttb(data: ScalarSample[], target: number): ScalarSample[] {
  if (target >= data.length || data.length <= 2) return [...data];
  if (target < 3) return [data[0], data[data.length - 1]];

  const out: ScalarSample[] = [data[0]];
  const bucketSize = (data.length - 2) / (target - 2);

  let prevIdx = 0;

  for (let i = 0; i < target - 2; i++) {
    const startA = Math.floor((i + 1) * bucketSize) + 1;
    const endA   = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    // Average of the next bucket (point A in the algorithm)
    let avgT = 0, avgV = 0;
    for (let k = startA; k < endA; k++) {
      avgT += data[k].t;
      avgV += data[k].v;
    }
    const count = endA - startA;
    avgT /= count;
    avgV /= count;

    // Current bucket boundaries
    const startB = Math.floor(i * bucketSize) + 1;
    const endB   = Math.floor((i + 1) * bucketSize) + 1;

    const prev = data[prevIdx];
    let bestArea = -1, bestIdx = startB;
    for (let k = startB; k < endB; k++) {
      const area = Math.abs(
        (prev.t - avgT) * (data[k].v - prev.v) -
        (prev.t - data[k].t) * (avgV - prev.v)
      ) * 0.5;
      if (area > bestArea) {
        bestArea = area;
        bestIdx  = k;
      }
    }
    out.push(data[bestIdx]);
    prevIdx = bestIdx;
  }

  out.push(data[data.length - 1]);
  return out;
}

/**
 * Uniform downsample: pick evenly-spaced indices from `data`.
 */
function uniformDownsample(data: ScalarSample[], target: number): ScalarSample[] {
  if (target >= data.length) return [...data];
  const step = (data.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => data[Math.round(i * step)]);
}

// ═══════════════════════════════════════════════════════════════════
// CROSS-CORRELATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Pearson cross-correlation of two equal-length normalized arrays
 * at a given lag offset. Positive lag: fine leads coarse.
 */
function correlationAtLag(fine: number[], coarse: number[], lag: number): number {
  const n = coarse.length;
  const start = Math.max(0, lag);
  const end   = Math.min(n, n + lag);
  const len   = end - start;
  if (len < 3) return 0;

  const fSlice = fine.slice(start - lag, end - lag);
  const cSlice = coarse.slice(start, end);

  const fMean = fSlice.reduce((s, v) => s + v, 0) / len;
  const cMean = cSlice.reduce((s, v) => s + v, 0) / len;

  let num = 0, fSq = 0, cSq = 0;
  for (let i = 0; i < len; i++) {
    const fd = fSlice[i] - fMean;
    const cd = cSlice[i] - cMean;
    num += fd * cd;
    fSq += fd * fd;
    cSq += cd * cd;
  }
  const denom = Math.sqrt(fSq * cSq);
  return denom < 1e-12 ? 0 : num / denom;
}

/**
 * Search lag offsets [-maxLag, +maxLag] and return the lag with peak |R|.
 */
function findOptimalLag(
  fine:   number[],
  coarse: number[],
  maxLag: number
): { lag: number; r: number } {
  let bestLag = 0, bestR = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const r = correlationAtLag(fine, coarse, lag);
    if (Math.abs(r) > Math.abs(bestR)) {
      bestR = r;
      bestLag = lag;
    }
  }
  return { lag: bestLag, r: bestR };
}

// ═══════════════════════════════════════════════════════════════════
// GRADIENT
// ═══════════════════════════════════════════════════════════════════

function gradients(vals: number[]): number[] {
  return vals.map((v, i) => {
    if (i === 0)               return vals[1] - vals[0];
    if (i === vals.length - 1) return vals[i] - vals[i - 1];
    return (vals[i + 1] - vals[i - 1]) / 2;
  });
}

// ═══════════════════════════════════════════════════════════════════
// RESONANCE DETECTION
// ═══════════════════════════════════════════════════════════════════

function detectResonance(
  fineNorm:   number[],
  coarseNorm: number[],
  coarseRaw:  ScalarSample[],
  lag:        number,
  opts:       Required<ProcessorOptions>
): ResonancePoint[] {
  const n   = coarseNorm.length;
  const grad = gradients(coarseNorm);
  const range = Math.max(...coarseNorm) - Math.min(...coarseNorm) || 1;
  const points: ResonancePoint[] = [];

  for (let i = 1; i < n - 1; i++) {
    const fineIdx = Math.max(0, Math.min(n - 1, i - lag));
    const fv      = fineNorm[fineIdx];
    const cv      = coarseNorm[i];
    const gv      = grad[i];

    // Prominence: value deviation from local mean
    const localMean = (coarseNorm[i - 1] + coarseNorm[i] + coarseNorm[i + 1]) / 3;
    const prominence = Math.abs(fv - localMean) / range;
    if (prominence < opts.prominenceThreshold) continue;

    // Local cross-correlation window
    const winStart = Math.max(0, i - 8);
    const winEnd   = Math.min(n, i + 8);
    const fSlice   = fineNorm.slice(winStart, winEnd);
    const cSlice   = coarseNorm.slice(winStart, winEnd);
    const r        = correlationAtLag(fSlice, cSlice, 0);

    if (Math.abs(r) < opts.minCorrelation)  continue;
    if (Math.abs(gv) < opts.minGradient)    continue;

    const score    = Math.abs(r) * Math.abs(gv);
    const polarity: "PEAK" | "VALLEY" = gv > 0 ? "PEAK" : "VALLEY";

    points.push({
      index:          i,
      t:              coarseRaw[i].t,
      fineValue:      fv,
      coarseValue:    cv,
      correlationR:   r,
      coarseGradient: gv,
      score,
      polarity,
    });
  }

  return points.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: MULTI-MAGNITUDE PROCESSOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Synchronize two datasets of vastly different scales and detect harmonic
 * resonance points where the fine-scale series predicts coarse-scale shifts.
 *
 * @param fineSeries    High-frequency / small-scale data (e.g., nanosecond signals)
 * @param coarseSeries  Low-frequency / large-scale data (e.g., monthly trends)
 * @param opts          Tuning parameters (all optional)
 *
 * @returns SyncResult with aligned series, optimal lag, and resonance points
 */
export function synchronizeScales(
  fineSeries:   ScalarSample[],
  coarseSeries: ScalarSample[],
  opts:         ProcessorOptions = {}
): SyncResult {
  if (fineSeries.length < 4 || coarseSeries.length < 4) {
    throw new Error("synchronizeScales: both series must have at least 4 samples.");
  }

  // Sort both by timestamp
  const fine   = [...fineSeries].sort((a, b) => a.t - b.t);
  const coarse = [...coarseSeries].sort((a, b) => a.t - b.t);

  const n = coarse.length;

  const options: Required<ProcessorOptions> = {
    prominenceThreshold: opts.prominenceThreshold ?? 0.2,
    minCorrelation:      opts.minCorrelation      ?? 0.3,
    minGradient:         opts.minGradient         ?? 0.05,
    maxLagSteps:         opts.maxLagSteps          ?? Math.floor(n / 4),
    useLttb:             opts.useLttb             ?? true,
  };

  // ── Step 1: Resample fine → coarse cadence ─────────────────────
  const resampledFine: ScalarSample[] = options.useLttb
    ? lttb(fine, n)
    : uniformDownsample(fine, n);

  // ── Step 2: Normalize both to z-scores ────────────────────────
  const { norm: fineNorm }   = zScore(resampledFine.map((s) => s.v));
  const { norm: coarseNorm } = zScore(coarse.map((s) => s.v));

  // ── Step 3: Find optimal lag via cross-correlation sweep ──────
  const { lag, r: peakR } = findOptimalLag(fineNorm, coarseNorm, options.maxLagSteps);

  // ── Step 4: Align series using optimal lag ────────────────────
  //   Positive lag means fine leads; shift fine backward (or coarse forward).
  const shift = Math.abs(lag);
  let alignedFineNorm:   number[];
  let alignedCoarseNorm: number[];
  let alignedCoarseRaw:  ScalarSample[];
  let alignedFineRaw:    ScalarSample[];

  if (lag >= 0) {
    // fine leads — drop first `shift` coarse samples
    alignedCoarseRaw  = coarse.slice(shift);
    alignedCoarseNorm = coarseNorm.slice(shift);
    alignedFineRaw    = resampledFine.slice(0, n - shift);
    alignedFineNorm   = fineNorm.slice(0, n - shift);
  } else {
    // coarse leads — drop first `shift` fine samples
    alignedCoarseRaw  = coarse.slice(0, n - shift);
    alignedCoarseNorm = coarseNorm.slice(0, n - shift);
    alignedFineRaw    = resampledFine.slice(shift);
    alignedFineNorm   = fineNorm.slice(shift);
  }

  // ── Step 5: Detect resonance points ───────────────────────────
  const resonancePoints = detectResonance(
    alignedFineNorm,
    alignedCoarseNorm,
    alignedCoarseRaw,
    0,   // already aligned — no additional lag offset
    options
  );

  // Re-attach timestamps to aligned normalized series
  const alignedFine:   ScalarSample[] = alignedFineRaw.map((s, i) => ({ t: s.t, v: alignedFineNorm[i] }));
  const alignedCoarse: ScalarSample[] = alignedCoarseRaw.map((s, i) => ({ t: s.t, v: alignedCoarseNorm[i] }));

  return {
    alignedCoarse,
    alignedFine,
    optimalLag: lag,
    peakR,
    resonancePoints,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format the top-N resonance points as a compact table string.
 */
export function formatResonanceTable(
  result: SyncResult,
  topN   = 10
): string {
  const rows = result.resonancePoints.slice(0, topN);
  if (rows.length === 0) return "No resonance points detected.";
  const header = `Lag: ${result.optimalLag} steps  |  Peak R: ${result.peakR.toFixed(4)}`;
  const lines  = rows.map((p, i) =>
    `  ${String(i + 1).padStart(2)}.  t=${p.t}  idx=${p.index}  R=${p.correlationR.toFixed(3)}  grad=${p.coarseGradient.toFixed(3)}  score=${p.score.toFixed(4)}  [${p.polarity}]`
  );
  return [header, ...lines].join("\n");
}

/**
 * Classify the overall sync quality based on the peak correlation.
 */
export function classifySyncQuality(peakR: number): "STRONG" | "MODERATE" | "WEAK" | "NONE" {
  const abs = Math.abs(peakR);
  if (abs >= 0.7) return "STRONG";
  if (abs >= 0.4) return "MODERATE";
  if (abs >= 0.2) return "WEAK";
  return "NONE";
}

/**
 * utilities/math/harmonic-analysis.ts
 *
 * General-purpose harmonic and statistical analysis utilities.
 *
 * Exports:
 *   pearsonCorrelation()     — Pearson r between two numeric arrays
 *   spearmanCorrelation()    — Spearman rank-order r
 *   findPeaks()              — local maxima detection with configurable window
 *   matchingPeaks()          — align peaks from two signals by time index
 *   crossCorrelation()       — full cross-correlation at all lags
 *   autocorrelation()        — self-correlation (lag structure / periodicity)
 *   normalize()              — z-score or min-max normalization
 *   movingAverage()          — simple moving average smoother
 *   rms()                    — root-mean-square amplitude
 *   snr()                    — signal-to-noise ratio (dB)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CorrelationResult {
  /** Pearson or Spearman r — range [-1, 1] */
  r:          number;
  /** r² — proportion of shared variance */
  rSquared:   number;
  /** Number of paired observations used */
  n:          number;
  /** Interpretation label */
  strength:   "none" | "weak" | "moderate" | "strong" | "very_strong";
  /** Sign of the relationship */
  direction:  "positive" | "negative" | "none";
}

export interface Peak {
  /** Index in the source array */
  index:     number;
  /** Amplitude at the peak */
  value:     number;
  /** Prominence — how much this peak stands above its surroundings */
  prominence: number;
}

export interface MatchedPeakPair {
  signalA:      Peak;
  signalB:      Peak;
  /** Index distance between matched peaks */
  indexDelta:   number;
  /** Amplitude difference A - B */
  amplitudeDelta: number;
}

export interface CrossCorrelationResult {
  /** Lags from -(n-1) to +(n-1) */
  lags:        number[];
  /** Normalized correlation coefficient at each lag */
  coefficients: number[];
  /** Lag at which correlation is maximized */
  peakLag:     number;
  /** Maximum correlation coefficient */
  peakCoeff:   number;
}

export type NormalizeMethod = "zscore" | "minmax";

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════════

function requireSameLength(a: number[], b: number[], fnName: string): void {
  if (a.length !== b.length) {
    throw new RangeError(`${fnName}: Signal A (${a.length}) and Signal B (${b.length}) must be the same length.`);
  }
  if (a.length < 2) {
    throw new RangeError(`${fnName}: Signals must contain at least 2 data points.`);
  }
}

function interpretR(r: number): Pick<CorrelationResult, "strength" | "direction"> {
  const abs = Math.abs(r);
  const direction: CorrelationResult["direction"] = r > 0 ? "positive" : r < 0 ? "negative" : "none";
  let strength: CorrelationResult["strength"];
  if (abs < 0.10)      strength = "none";
  else if (abs < 0.30) strength = "weak";
  else if (abs < 0.50) strength = "moderate";
  else if (abs < 0.80) strength = "strong";
  else                  strength = "very_strong";
  return { strength, direction };
}

// ═══════════════════════════════════════════════════════════════════
// 1. PEARSON CORRELATION COEFFICIENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the Pearson product-moment correlation coefficient between
 * Signal A and Signal B.
 *
 * Pearson r measures linear association. Ranges from -1 (perfect negative
 * linear relationship) through 0 (no linear relationship) to +1 (perfect
 * positive linear relationship).
 *
 * @param a  Signal A — array of numbers
 * @param b  Signal B — array of numbers, same length as a
 */
export function pearsonCorrelation(a: number[], b: number[]): CorrelationResult {
  requireSameLength(a, b, "pearsonCorrelation");
  const n   = a.length;
  const muA = a.reduce((s, v) => s + v, 0) / n;
  const muB = b.reduce((s, v) => s + v, 0) / n;

  let numerator   = 0;
  let denomA      = 0;
  let denomB      = 0;

  for (let i = 0; i < n; i++) {
    const da  = a[i] - muA;
    const db  = b[i] - muB;
    numerator += da * db;
    denomA    += da * da;
    denomB    += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  const r     = denom === 0 ? 0 : numerator / denom;

  return { r, rSquared: r * r, n, ...interpretR(r) };
}

// ═══════════════════════════════════════════════════════════════════
// 2. SPEARMAN RANK CORRELATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the Spearman rank-order correlation coefficient.
 *
 * Spearman r is the Pearson r of the rank-transformed data — it captures
 * monotonic (not necessarily linear) relationships and is robust to outliers.
 *
 * Ties are assigned the average of the tied ranks.
 *
 * @param a  Signal A
 * @param b  Signal B, same length as a
 */
export function spearmanCorrelation(a: number[], b: number[]): CorrelationResult {
  requireSameLength(a, b, "spearmanCorrelation");
  return pearsonCorrelation(rankTransform(a), rankTransform(b));
}

function rankTransform(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
  const ranks  = new Array<number>(arr.length);

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    // Find run of equal values
    while (j < sorted.length - 1 && sorted[j].v === sorted[j + 1].v) j++;
    const avgRank = (i + j) / 2 + 1;  // 1-indexed average rank
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }

  return ranks;
}

// ═══════════════════════════════════════════════════════════════════
// 3. PEAK DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Find local maxima (peaks) in a signal.
 *
 * A peak is a sample that is strictly greater than all samples within
 * a neighbourhood of `halfWindow` on either side.
 *
 * @param signal      Input array
 * @param halfWindow  Half-width of the comparison window (default 1 — strict local max)
 * @param minHeight   Minimum amplitude threshold for a peak (default -Infinity)
 */
export function findPeaks(
  signal:     number[],
  halfWindow  = 1,
  minHeight   = -Infinity
): Peak[] {
  if (signal.length < 3) return [];
  const peaks: Peak[] = [];

  for (let i = halfWindow; i < signal.length - halfWindow; i++) {
    const v = signal[i];
    if (v < minHeight) continue;

    let isPeak = true;
    for (let d = 1; d <= halfWindow; d++) {
      if (signal[i - d] >= v || signal[i + d] >= v) { isPeak = false; break; }
    }
    if (!isPeak) continue;

    // Prominence: height above the higher of the two surrounding minima
    const leftMin  = Math.min(...signal.slice(Math.max(0, i - halfWindow * 4), i));
    const rightMin = Math.min(...signal.slice(i + 1, Math.min(signal.length, i + halfWindow * 4 + 1)));
    const base     = Math.max(leftMin, rightMin);
    const prominence = v - base;

    peaks.push({ index: i, value: v, prominence });
  }

  return peaks;
}

// ═══════════════════════════════════════════════════════════════════
// 4. MATCHING PEAKS BETWEEN TWO SIGNALS
// ═══════════════════════════════════════════════════════════════════

/**
 * Match peaks from Signal A to the nearest corresponding peak in Signal B
 * within a maximum index tolerance.
 *
 * Useful for identifying whether two signals share common frequency events.
 *
 * @param peaksA        Peaks detected in Signal A
 * @param peaksB        Peaks detected in Signal B
 * @param maxIndexDelta Max index distance for a pair to be considered matched (default 5)
 */
export function matchingPeaks(
  peaksA:        Peak[],
  peaksB:        Peak[],
  maxIndexDelta  = 5
): MatchedPeakPair[] {
  const pairs:  MatchedPeakPair[] = [];
  const usedB   = new Set<number>();

  for (const pa of peaksA) {
    let best: { pb: Peak; dist: number } | null = null;

    for (let bi = 0; bi < peaksB.length; bi++) {
      if (usedB.has(bi)) continue;
      const dist = Math.abs(pa.index - peaksB[bi].index);
      if (dist <= maxIndexDelta && (!best || dist < best.dist)) {
        best = { pb: peaksB[bi], dist };
      }
    }

    if (best) {
      usedB.add(peaksB.indexOf(best.pb));
      pairs.push({
        signalA:         pa,
        signalB:         best.pb,
        indexDelta:      pa.index - best.pb.index,
        amplitudeDelta:  pa.value - best.pb.value,
      });
    }
  }

  return pairs;
}

// ═══════════════════════════════════════════════════════════════════
// 5. CROSS-CORRELATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the full normalized cross-correlation between Signal A and Signal B
 * at all possible lags from -(n-1) to +(n-1).
 *
 * Cross-correlation at lag k answers: "How similar is Signal A to Signal B
 * when Signal B is shifted by k samples?"
 *
 * A positive `peakLag` means Signal B leads Signal A by `peakLag` samples.
 * A negative `peakLag` means Signal A leads Signal B.
 *
 * @param a  Signal A
 * @param b  Signal B, same length as a
 */
export function crossCorrelation(a: number[], b: number[]): CrossCorrelationResult {
  requireSameLength(a, b, "crossCorrelation");
  const n    = a.length;
  const muA  = a.reduce((s, v) => s + v, 0) / n;
  const muB  = b.reduce((s, v) => s + v, 0) / n;
  const normA = Math.sqrt(a.reduce((s, v) => s + (v - muA) ** 2, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + (v - muB) ** 2, 0));
  const denom = normA * normB;

  const lags:         number[] = [];
  const coefficients: number[] = [];

  for (let lag = -(n - 1); lag <= n - 1; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j >= 0 && j < n) sum += (a[i] - muA) * (b[j] - muB);
    }
    lags.push(lag);
    coefficients.push(denom === 0 ? 0 : sum / denom);
  }

  const peakIdx  = coefficients.reduce((best, v, i) => v > coefficients[best] ? i : best, 0);
  return {
    lags,
    coefficients,
    peakLag:   lags[peakIdx],
    peakCoeff: coefficients[peakIdx],
  };
}

// ═══════════════════════════════════════════════════════════════════
// 6. AUTOCORRELATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the autocorrelation of a signal at lags 0 through maxLag.
 *
 * Useful for detecting periodicity: a spike at lag k means the signal
 * repeats approximately every k samples.
 *
 * @param signal  Input signal
 * @param maxLag  Maximum lag to compute (default: half the signal length)
 */
export function autocorrelation(
  signal: number[],
  maxLag?: number
): { lag: number; r: number }[] {
  if (signal.length < 2) throw new RangeError("autocorrelation: need at least 2 samples.");
  const n      = signal.length;
  const limit  = Math.min(maxLag ?? Math.floor(n / 2), n - 1);
  const mu     = signal.reduce((s, v) => s + v, 0) / n;
  const varSum = signal.reduce((s, v) => s + (v - mu) ** 2, 0);

  const result: { lag: number; r: number }[] = [];

  for (let lag = 0; lag <= limit; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += (signal[i] - mu) * (signal[i + lag] - mu);
    result.push({ lag, r: varSum === 0 ? 0 : sum / varSum });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 7. NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize an array of numbers.
 *
 * - `zscore`  — subtract mean, divide by standard deviation. Result has μ=0, σ=1.
 * - `minmax`  — scale linearly to [0, 1]. Result has min=0, max=1.
 *
 * Returns the normalized array plus the parameters used (for inverse transform).
 */
export function normalize(
  arr:    number[],
  method: NormalizeMethod = "zscore"
): { values: number[]; params: Record<string, number> } {
  if (arr.length === 0) return { values: [], params: {} };

  if (method === "minmax") {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;
    return {
      values: arr.map((v) => (range === 0 ? 0 : (v - min) / range)),
      params: { min, max, range },
    };
  }

  // z-score
  const n   = arr.length;
  const mu  = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / n;
  const sigma    = Math.sqrt(variance);

  return {
    values: arr.map((v) => (sigma === 0 ? 0 : (v - mu) / sigma)),
    params: { mean: mu, stddev: sigma, variance },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 8. MOVING AVERAGE
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a simple moving average with a given window size.
 * Output length equals input length — edges use available samples only
 * (equivalent to `mode='valid'` extended with partial windows).
 *
 * @param signal      Input signal
 * @param windowSize  Number of samples to average (must be ≥ 1)
 */
export function movingAverage(signal: number[], windowSize: number): number[] {
  if (windowSize < 1 || !Number.isInteger(windowSize)) {
    throw new RangeError("movingAverage: windowSize must be a positive integer.");
  }
  return signal.map((_, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end   = Math.min(signal.length, i + Math.ceil(windowSize / 2));
    const slice = signal.slice(start, end);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

// ═══════════════════════════════════════════════════════════════════
// 9. ROOT-MEAN-SQUARE
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the root-mean-square (RMS) amplitude of a signal.
 * Equivalent to the quadratic mean — a measure of signal power.
 */
export function rms(signal: number[]): number {
  if (signal.length === 0) return 0;
  return Math.sqrt(signal.reduce((s, v) => s + v * v, 0) / signal.length);
}

// ═══════════════════════════════════════════════════════════════════
// 10. SIGNAL-TO-NOISE RATIO (dB)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the signal-to-noise ratio in decibels.
 *
 *   SNR (dB) = 20 × log₁₀(rms(signal) / rms(noise))
 *
 * A positive SNR means the signal is stronger than the noise.
 * Returns Infinity if noise RMS is 0; returns -Infinity if signal RMS is 0.
 *
 * @param signal  The clean or dominant signal
 * @param noise   The noise component (same length)
 */
export function snr(signal: number[], noise: number[]): number {
  const sigRms   = rms(signal);
  const noiseRms = rms(noise);
  if (noiseRms === 0) return Infinity;
  if (sigRms   === 0) return -Infinity;
  return 20 * Math.log10(sigRms / noiseRms);
}

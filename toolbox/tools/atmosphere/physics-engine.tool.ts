/**
 * toolbox/tools/atmosphere/physics-engine.tool.ts
 * version: 1.0.0
 *
 * Pre-noetic Atmospheric Conditions Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Models the relationship between the Biblical Canopy (a hypothesized
 * pre-Flood water-vapor firmament) and resulting surface atmospheric
 * conditions — barometric pressure, O2 partial pressure, and radiation
 * shielding — based on established physics applied to the canopy hypothesis.
 *
 * References:
 *   - International Standard Atmosphere (ISA) model
 *   - Dalton's Law of Partial Pressures
 *   - Canopy hypothesis: Dillow (1981), Vardiman (1994)
 */

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Standard modern sea-level pressure in Pa */
export const MODERN_SEA_LEVEL_PRESSURE_PA = 101_325;

/** Standard modern O2 mole fraction in dry air */
export const MODERN_O2_FRACTION = 0.2095;

/** Modern ambient UV / cosmic radiation index (normalized to 1.0) */
export const MODERN_RADIATION_INDEX = 1.0;

/** Water vapor density (kg/m³) at ~20 °C — used to convert canopy mass to pressure */
const WATER_VAPOR_DENSITY_KG_M3 = 0.0173;

/** Surface gravitational acceleration (m/s²) */
const G = 9.80665;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CanopyConditions {
  /** Thickness of the hypothesized vapor canopy in metres */
  canopyThicknessM: number;
  /** Water-equivalent weight of the canopy in kg/m² */
  canopyWeightKgM2: number;
  /** Additional pressure contribution from the canopy in Pa */
  canopyPressurePa: number;
  /** Total sea-level barometric pressure (modern + canopy) in Pa */
  totalPressurePa: number;
  /** Total pressure in atmospheres (atm) for readability */
  totalPressureAtm: number;
  /** Total pressure in bar */
  totalPressureBar: number;
  /** Total pressure in mmHg (useful for physiological comparisons) */
  totalPressureMmHg: number;
}

export interface O2Conditions {
  /** Total atmospheric pressure used as input (Pa) */
  totalPressurePa: number;
  /** O2 mole fraction used */
  o2Fraction: number;
  /** O2 partial pressure (Pa) */
  o2PartialPressurePa: number;
  /** O2 partial pressure (mmHg) — clinical / physiological standard */
  o2PartialPressureMmHg: number;
  /** O2 partial pressure (atm) */
  o2PartialPressureAtm: number;
  /** Ratio vs modern O2 partial pressure (>1 = hyperoxic, <1 = hypoxic) */
  vsModernRatio: number;
  /** Human-readable oxygen environment classification */
  classification: "hypoxic" | "normoxic" | "mildly-hyperoxic" | "hyperoxic" | "extreme-hyperoxic";
}

export interface RadiationShielding {
  /** Total pressure used as input (Pa) */
  totalPressurePa: number;
  /**
   * Estimated surface UV/cosmic radiation index relative to modern (1.0).
   * Higher pressure → greater shielding → lower index.
   * Model: inverse linear approximation. Real shielding is non-linear
   * but this gives a useful first-order estimate.
   */
  radiationIndex: number;
  /** Percentage reduction vs modern radiation level */
  reductionPct: number;
  /** Qualitative shielding tier */
  shieldingTier: "none" | "moderate" | "strong" | "extreme";
}

export interface AtmosphericSnapshot {
  canopy:    CanopyConditions;
  oxygen:    O2Conditions;
  radiation: RadiationShielding;
  /** ISO timestamp of calculation */
  calculatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 1 — BAROMETRIC PRESSURE AT SEA LEVEL
// Given a Canopy Weight variable
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate sea-level barometric pressure contributions from a hypothesized
 * pre-Flood vapor canopy.
 *
 * Physics:
 *   The canopy is modelled as a column of water vapor sitting above the
 *   atmosphere. Its weight per unit area exerts additional hydrostatic
 *   pressure at the surface:
 *
 *     P_canopy = ρ_vapor × g × h
 *
 *   where h is the equivalent thickness in metres.
 *
 *   Total surface pressure = P_modern + P_canopy.
 *
 * @param canopyWeightKgM2  Water-equivalent mass per square metre (kg/m²).
 *                          Dillow (1981) estimated ~1,600 kg/m² for a global
 *                          canopy producing ~2 atm additional pressure.
 *                          Pass 0 to model modern (no canopy) conditions.
 *
 * @param baselinePressurePa  Modern sea-level pressure to build on.
 *                            Defaults to ISA standard (101,325 Pa).
 */
export function calculateCanopyPressure(
  canopyWeightKgM2: number,
  baselinePressurePa = MODERN_SEA_LEVEL_PRESSURE_PA
): CanopyConditions {
  if (canopyWeightKgM2 < 0) {
    throw new RangeError("canopyWeightKgM2 must be ≥ 0");
  }

  // Canopy thickness: h = mass / density
  const canopyThicknessM = canopyWeightKgM2 / WATER_VAPOR_DENSITY_KG_M3;

  // Pressure contribution: P = ρgh  (Pa)
  const canopyPressurePa = canopyWeightKgM2 * G;

  const totalPressurePa  = baselinePressurePa + canopyPressurePa;

  return {
    canopyThicknessM,
    canopyWeightKgM2,
    canopyPressurePa,
    totalPressurePa,
    totalPressureAtm: totalPressurePa / 101_325,
    totalPressureBar: totalPressurePa / 100_000,
    totalPressureMmHg: totalPressurePa / 133.322,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 2 — O2 PARTIAL PRESSURE
// Based on total atmospheric pressure
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate O2 partial pressure from total atmospheric pressure.
 *
 * Physics — Dalton's Law:
 *   P_O2 = X_O2 × P_total
 *
 *   where X_O2 is the mole fraction of oxygen in dry air.
 *
 * @param totalPressurePa  Total atmospheric pressure in Pa.
 *
 * @param o2Fraction  O2 mole fraction (0–1). Defaults to modern 20.95%.
 *                    May be varied to model changing atmospheric composition
 *                    (e.g., pre-Flood paleo-atmosphere estimates of ~25–30%).
 */
export function calculateO2PartialPressure(
  totalPressurePa: number,
  o2Fraction = MODERN_O2_FRACTION
): O2Conditions {
  if (totalPressurePa <= 0) {
    throw new RangeError("totalPressurePa must be > 0");
  }
  if (o2Fraction <= 0 || o2Fraction > 1) {
    throw new RangeError("o2Fraction must be between 0 (exclusive) and 1 (inclusive)");
  }

  const o2PartialPressurePa   = o2Fraction * totalPressurePa;
  const modernO2Pa             = MODERN_O2_FRACTION * MODERN_SEA_LEVEL_PRESSURE_PA;
  const vsModernRatio          = o2PartialPressurePa / modernO2Pa;

  const classification = classifyO2Environment(vsModernRatio);

  return {
    totalPressurePa,
    o2Fraction,
    o2PartialPressurePa,
    o2PartialPressureMmHg: o2PartialPressurePa / 133.322,
    o2PartialPressureAtm:  o2PartialPressurePa / 101_325,
    vsModernRatio,
    classification,
  };
}

function classifyO2Environment(ratio: number): O2Conditions["classification"] {
  if (ratio < 0.8)  return "hypoxic";
  if (ratio < 1.1)  return "normoxic";
  if (ratio < 1.5)  return "mildly-hyperoxic";
  if (ratio < 2.5)  return "hyperoxic";
  return "extreme-hyperoxic";
}

// ═══════════════════════════════════════════════════════════════════
// FUNCTION 3 — RADIATION SHIELDING INDEX
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate surface radiation exposure relative to modern levels.
 *
 * A denser atmosphere scatters and absorbs UV / cosmic rays more
 * effectively. This model uses a first-order inverse-linear approximation:
 *
 *   index = P_modern / P_total
 *
 * (At twice modern pressure, radiation index ≈ 0.5, i.e. 50% reduction.)
 *
 * @param totalPressurePa  Total atmospheric pressure in Pa.
 */
export function calculateRadiationShielding(
  totalPressurePa: number
): RadiationShielding {
  if (totalPressurePa <= 0) {
    throw new RangeError("totalPressurePa must be > 0");
  }

  const radiationIndex = MODERN_SEA_LEVEL_PRESSURE_PA / totalPressurePa;
  const reductionPct   = Math.max(0, (1 - radiationIndex) * 100);

  let shieldingTier: RadiationShielding["shieldingTier"];
  if (reductionPct < 10)       shieldingTier = "none";
  else if (reductionPct < 40)  shieldingTier = "moderate";
  else if (reductionPct < 70)  shieldingTier = "strong";
  else                         shieldingTier = "extreme";

  return {
    totalPressurePa,
    radiationIndex: Math.round(radiationIndex * 10_000) / 10_000,
    reductionPct:   Math.round(reductionPct * 100) / 100,
    shieldingTier,
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE — Full atmospheric snapshot from one canopy weight
// ═══════════════════════════════════════════════════════════════════

/**
 * Single entry point: given a canopy weight (and optional O2 fraction),
 * returns the full pre-noetic atmospheric snapshot.
 *
 * Example — Dillow canopy estimate:
 *   atmosphericSnapshot(1600)
 *   → ~2 atm total pressure, O2 ~43 kPa, radiation index ~0.49
 */
export function atmosphericSnapshot(
  canopyWeightKgM2: number,
  o2Fraction = MODERN_O2_FRACTION,
  baselinePressurePa = MODERN_SEA_LEVEL_PRESSURE_PA
): AtmosphericSnapshot {
  const canopy    = calculateCanopyPressure(canopyWeightKgM2, baselinePressurePa);
  const oxygen    = calculateO2PartialPressure(canopy.totalPressurePa, o2Fraction);
  const radiation = calculateRadiationShielding(canopy.totalPressurePa);

  return {
    canopy,
    oxygen,
    radiation,
    calculatedAt: new Date().toISOString(),
  };
}

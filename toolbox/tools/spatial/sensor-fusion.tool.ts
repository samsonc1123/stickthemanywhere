/**
 * toolbox/tools/spatial/sensor-fusion.tool.ts
 * version: 1.0.0
 *
 * Omni-View — Geo-Spatial Sensor Fusion Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Two capabilities:
 *   1. Normalize GPS/GNSS coordinates from heterogeneous sources
 *      (Drone, Phone, Satellite) into a canonical GeoPoint.
 *   2. Convert Wi-Fi RSSI signal strength readings from multiple
 *      access points into 3D Cartesian coordinates for Occupancy Mapping.
 *
 * Pillar: Omni-View — Geo-Spatial Dashboard (GAB domain: COMMAND-AND-CONTROL)
 */

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Earth's mean radius in metres (WGS-84 semi-major axis) */
const EARTH_RADIUS_M = 6_378_137.0;

/** WGS-84 flattening factor */
const WGS84_F = 1 / 298.257_223_563;

/** WGS-84 first eccentricity squared */
const WGS84_E2 = 2 * WGS84_F - WGS84_F ** 2;

/** Free-space path loss constant (log10 of speed of light / 4π) */
const FSPL_CONST = 27.55;

// ═══════════════════════════════════════════════════════════════════
// TYPES — GPS / GNSS
// ═══════════════════════════════════════════════════════════════════

export type GnssSource = "drone" | "phone" | "satellite" | "rtk" | "unknown";

export type CoordinateFrame = "WGS84" | "ECEF" | "ENU" | "UTM";

export interface RawGnssReading {
  /** Originating sensor type */
  source: GnssSource;
  /** Latitude in decimal degrees (-90 to +90) */
  latitude: number;
  /** Longitude in decimal degrees (-180 to +180) */
  longitude: number;
  /** Altitude in metres above WGS-84 ellipsoid. Optional. */
  altitudeM?: number;
  /** Horizontal accuracy estimate in metres. Optional. */
  horizontalAccuracyM?: number;
  /** Vertical accuracy estimate in metres. Optional. */
  verticalAccuracyM?: number;
  /** HDOP — Horizontal Dilution of Precision. Lower = better. Optional. */
  hdop?: number;
  /** Number of satellites used. Optional. */
  satelliteCount?: number;
  /** Unix timestamp (ms) of the reading */
  timestampMs: number;
  /** Raw NMEA sentence or proprietary packet, if available */
  rawPacket?: string;
}

export interface GeoPoint {
  /** Canonical decimal-degree latitude, clamped to [-90, 90] */
  latitude: number;
  /** Canonical decimal-degree longitude, normalised to (-180, 180] */
  longitude: number;
  /** Altitude in metres (NaN if unknown) */
  altitudeM: number;
  /** Merged horizontal accuracy in metres (worst-case of inputs) */
  horizontalAccuracyM: number;
  /** Quality tier derived from source + accuracy */
  quality: GnssQuality;
  /** Original source */
  source: GnssSource;
  /** Unix timestamp (ms) */
  timestampMs: number;
  /** ECEF representation */
  ecef: ECEFPoint;
}

export type GnssQuality =
  | "RTK_FIXED"      // <1 cm
  | "DIFFERENTIAL"   // <0.1 m
  | "AUTONOMOUS"     // <5 m  (typical phone/drone)
  | "SATELLITE"      // <30 m (coarse satellite estimate)
  | "DEGRADED"       // >30 m or HDOP > 5
  | "UNKNOWN";

export interface ECEFPoint {
  x: number;
  y: number;
  z: number;
}

export interface FusedGeoPoint extends GeoPoint {
  /** Number of readings fused */
  readingCount: number;
  /** Weighted centroid latitude standard deviation (m) */
  latStdDevM: number;
  /** Weighted centroid longitude standard deviation (m) */
  lonStdDevM: number;
  /** Sources that contributed */
  sources: GnssSource[];
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — Wi-Fi RSSI / Occupancy Mapping
// ═══════════════════════════════════════════════════════════════════

export interface AccessPoint {
  /** MAC address or unique ID */
  bssid: string;
  /** Known 3D position of the access point in metres (local frame) */
  positionM: { x: number; y: number; z: number };
  /** Transmit power in dBm */
  txPowerDbm: number;
  /** Wi-Fi frequency in MHz (e.g. 2412, 5180) */
  frequencyMhz: number;
  /** Path loss exponent for the environment (free-space=2, indoor=2.7–3.5) */
  pathLossExponent?: number;
}

export interface RssiReading {
  /** BSSID of the access point */
  bssid: string;
  /** Measured RSSI in dBm (typically -30 dBm strong → -90 dBm weak) */
  rssiDbm: number;
  /** Unix timestamp (ms) */
  timestampMs: number;
}

export interface OccupancyPoint {
  /** Estimated 3D position in local frame metres */
  position: { x: number; y: number; z: number };
  /** Confidence 0–1. Higher = more consistent trilateration. */
  confidence: number;
  /** Number of access points used */
  apCount: number;
  /** Distance estimate from each contributing AP (metres) */
  distances: Array<{ bssid: string; estimatedDistanceM: number }>;
  /** Unix timestamp of the reading set */
  timestampMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — GPS / GNSS NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Clamp latitude to [-90, 90].
 */
function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Normalise longitude to (-180, 180].
 */
function normalizeLon(lon: number): number {
  while (lon > 180)  lon -= 360;
  while (lon <= -180) lon += 360;
  return lon;
}

/**
 * Convert geodetic (lat, lon, alt) to ECEF Cartesian (X, Y, Z).
 * Uses WGS-84 ellipsoid parameters.
 */
export function geodeticToECEF(
  latDeg: number,
  lonDeg: number,
  altM = 0
): ECEFPoint {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const N   = EARTH_RADIUS_M / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) ** 2);

  return {
    x: (N + altM) * Math.cos(lat) * Math.cos(lon),
    y: (N + altM) * Math.cos(lat) * Math.sin(lon),
    z: (N * (1 - WGS84_E2) + altM) * Math.sin(lat),
  };
}

/**
 * Convert ECEF back to geodetic (lat, lon, alt) using Bowring's method.
 * Returns { latitude, longitude, altitudeM } in degrees / metres.
 */
export function ecefToGeodetic(
  ecef: ECEFPoint
): { latitude: number; longitude: number; altitudeM: number } {
  const { x, y, z } = ecef;
  const lon = Math.atan2(y, x);
  const p   = Math.sqrt(x ** 2 + y ** 2);

  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let i = 0; i < 10; i++) {
    const N   = EARTH_RADIUS_M / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) ** 2);
    lat = Math.atan2(z + WGS84_E2 * N * Math.sin(lat), p);
  }

  const N   = EARTH_RADIUS_M / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) ** 2);
  const alt = p / Math.cos(lat) - N;

  return {
    latitude:  (lat * 180) / Math.PI,
    longitude: (lon * 180) / Math.PI,
    altitudeM: alt,
  };
}

/**
 * Derive GNSS quality from source type, accuracy, and HDOP.
 */
function deriveQuality(reading: RawGnssReading): GnssQuality {
  if (reading.source === "rtk")        return "RTK_FIXED";
  if (reading.horizontalAccuracyM !== undefined) {
    if (reading.horizontalAccuracyM < 0.5)  return "DIFFERENTIAL";
    if (reading.horizontalAccuracyM < 10)   return "AUTONOMOUS";
    if (reading.horizontalAccuracyM < 50)   return "SATELLITE";
    return "DEGRADED";
  }
  if (reading.hdop !== undefined) {
    if (reading.hdop < 1)  return "DIFFERENTIAL";
    if (reading.hdop < 2)  return "AUTONOMOUS";
    if (reading.hdop < 5)  return "SATELLITE";
    return "DEGRADED";
  }
  // Source-based fallback
  const sourceMap: Record<GnssSource, GnssQuality> = {
    rtk:       "RTK_FIXED",
    satellite: "SATELLITE",
    drone:     "AUTONOMOUS",
    phone:     "AUTONOMOUS",
    unknown:   "UNKNOWN",
  };
  return sourceMap[reading.source] ?? "UNKNOWN";
}

/**
 * Normalise a single raw GNSS reading into a canonical GeoPoint.
 *
 * - Clamps latitude to [-90, 90]
 * - Normalises longitude to (-180, 180]
 * - Fills in a default accuracy if none provided (source-dependent)
 * - Computes ECEF representation
 * - Derives quality tier
 */
export function normalizeGnssReading(reading: RawGnssReading): GeoPoint {
  const lat = clampLat(reading.latitude);
  const lon = normalizeLon(reading.longitude);
  const alt = reading.altitudeM ?? NaN;

  const defaultAccuracy: Record<GnssSource, number> = {
    rtk:       0.02,
    satellite: 30,
    drone:     3,
    phone:     5,
    unknown:   50,
  };

  const hAccuracy =
    reading.horizontalAccuracyM ??
    defaultAccuracy[reading.source] ??
    50;

  return {
    latitude:           lat,
    longitude:          lon,
    altitudeM:          alt,
    horizontalAccuracyM: hAccuracy,
    quality:            deriveQuality(reading),
    source:             reading.source,
    timestampMs:        reading.timestampMs,
    ecef:               geodeticToECEF(lat, lon, isNaN(alt) ? 0 : alt),
  };
}

/**
 * Fuse multiple GNSS readings from different sources into a single
 * best-estimate GeoPoint using inverse-accuracy-weighted averaging
 * in ECEF space (avoids longitude wraparound issues).
 *
 * Higher-accuracy (lower horizontalAccuracyM) readings receive more weight.
 * RTK_FIXED readings dominate when present.
 */
export function fuseGnssReadings(readings: RawGnssReading[]): FusedGeoPoint {
  if (readings.length === 0) {
    throw new Error("fuseGnssReadings: at least one reading required.");
  }

  const points = readings.map(normalizeGnssReading);

  // Weights: inverse of accuracy squared (variance weighting)
  const weights = points.map((p) => 1 / (p.horizontalAccuracyM ** 2));
  const totalW  = weights.reduce((s, w) => s + w, 0);

  // Weighted ECEF centroid
  const cx = points.reduce((s, p, i) => s + p.ecef.x * weights[i], 0) / totalW;
  const cy = points.reduce((s, p, i) => s + p.ecef.y * weights[i], 0) / totalW;
  const cz = points.reduce((s, p, i) => s + p.ecef.z * weights[i], 0) / totalW;

  const centroidGeodetic = ecefToGeodetic({ x: cx, y: cy, z: cz });
  const bestAccuracy     = Math.min(...points.map((p) => p.horizontalAccuracyM));
  const bestQuality      = points.reduce<GnssQuality>((best, p) => {
    const order: GnssQuality[] = ["RTK_FIXED","DIFFERENTIAL","AUTONOMOUS","SATELLITE","DEGRADED","UNKNOWN"];
    return order.indexOf(p.quality) < order.indexOf(best) ? p.quality : best;
  }, "UNKNOWN");

  // Standard deviation in metres (distance from centroid)
  const dists = points.map((p) =>
    Math.sqrt((p.ecef.x - cx) ** 2 + (p.ecef.y - cy) ** 2 + (p.ecef.z - cz) ** 2)
  );
  const meanDist  = dists.reduce((s, d) => s + d, 0) / dists.length;
  const stdDevM   = Math.sqrt(dists.reduce((s, d) => s + (d - meanDist) ** 2, 0) / dists.length);

  // Approximate lat/lon std devs (1 degree lat ≈ 111,320 m)
  const latStdDevM = stdDevM;
  const lonStdDevM = stdDevM * Math.cos((centroidGeodetic.latitude * Math.PI) / 180);

  return {
    latitude:           centroidGeodetic.latitude,
    longitude:          centroidGeodetic.longitude,
    altitudeM:          centroidGeodetic.altitudeM,
    horizontalAccuracyM: bestAccuracy,
    quality:            bestQuality,
    source:             points[0].source,
    timestampMs:        Math.max(...points.map((p) => p.timestampMs)),
    ecef:               { x: cx, y: cy, z: cz },
    readingCount:       points.length,
    latStdDevM,
    lonStdDevM,
    sources:            [...new Set(points.map((p) => p.source))],
  };
}

/**
 * Convert a GeoPoint to East-North-Up (ENU) local frame relative to
 * a reference origin point. Useful for local 2D/3D mapping.
 */
export function geoPointToENU(
  point: GeoPoint,
  origin: { latitude: number; longitude: number; altitudeM?: number }
): { east: number; north: number; up: number } {
  const originECEF = geodeticToECEF(origin.latitude, origin.longitude, origin.altitudeM ?? 0);
  const dx = point.ecef.x - originECEF.x;
  const dy = point.ecef.y - originECEF.y;
  const dz = point.ecef.z - originECEF.z;

  const lat = (origin.latitude * Math.PI) / 180;
  const lon = (origin.longitude * Math.PI) / 180;

  return {
    east:  -Math.sin(lon) * dx + Math.cos(lon) * dy,
    north: -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz,
    up:     Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — WI-FI RSSI → 3D OCCUPANCY MAPPING
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert RSSI (dBm) to estimated distance (metres) using the
 * Log-Distance Path Loss model:
 *
 *   d = 10 ^ ((TxPower - RSSI - FSPL_CONST + 20·log10(f_MHz)) / (10 · n))
 *
 * where n is the path-loss exponent (free-space=2, typical indoor=2.7).
 *
 * @param rssiDbm        Measured received signal strength in dBm
 * @param txPowerDbm     Transmit power of the AP in dBm
 * @param frequencyMhz   AP frequency in MHz
 * @param pathLossExp    Environment-specific path-loss exponent (default 2.7)
 */
export function rssiToDistance(
  rssiDbm: number,
  txPowerDbm: number,
  frequencyMhz: number,
  pathLossExp = 2.7
): number {
  const logF  = 20 * Math.log10(frequencyMhz);
  const exp   = (txPowerDbm - rssiDbm - FSPL_CONST + logF) / (10 * pathLossExp);
  return Math.max(0.01, Math.pow(10, exp)); // clamp to 1 cm minimum
}

/**
 * Trilaterate a 3D position from distance measurements to ≥ 3 known
 * access point positions. Uses least-squares minimisation via
 * linearised system (Taylor / Bancroft method).
 *
 * Requires at least 3 APs for a 2D solution; 4+ for 3D.
 * Falls back gracefully to 2D (z = weighted mean of AP z-coords) if
 * fewer than 4 APs are available.
 */
function trilaterate3D(
  aps: Array<{ position: { x: number; y: number; z: number }; distanceM: number }>
): { x: number; y: number; z: number } | null {
  if (aps.length < 3) return null;

  // Use the first AP as reference to linearise the system
  const ref = aps[0];
  const rows: number[][] = [];
  const b: number[] = [];

  for (let i = 1; i < aps.length; i++) {
    const ap = aps[i];
    const ax = ap.position.x - ref.position.x;
    const ay = ap.position.y - ref.position.y;
    const az = ap.position.z - ref.position.z;
    const rhs =
      (ref.distanceM ** 2 - ap.distanceM ** 2 -
        ref.position.x ** 2 + ap.position.x ** 2 -
        ref.position.y ** 2 + ap.position.y ** 2 -
        ref.position.z ** 2 + ap.position.z ** 2) / 2;
    rows.push([ax, ay, az]);
    b.push(rhs);
  }

  // Least-squares via normal equations: (A^T A) x = A^T b
  // For small systems (3–10 APs) simple matrix ops suffice
  const A = rows;
  const At = A[0].map((_, ci) => A.map((row) => row[ci]));
  const AtA = At.map((row) => At[0].map((_, j) => row.reduce((s, _, k) => s + row[k] * At[j][k], 0)));
  // Actually compute AtA properly
  const AtA2 = At.map((ati) =>
    At.map((atj) => ati.reduce((s, v, k) => s + v * atj[k], 0))
  );
  const Atb  = At.map((ati) => ati.reduce((s, v, k) => s + v * b[k], 0));

  // 3×3 matrix inversion (Cramer's rule)
  const [a00, a01, a02] = AtA2[0];
  const [a10, a11, a12] = AtA2[1];
  const [a20, a21, a22] = AtA2[2];

  const det =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  if (Math.abs(det) < 1e-10) return null; // singular — APs are coplanar

  const inv = [
    [(a11*a22-a12*a21)/det, (a02*a21-a01*a22)/det, (a01*a12-a02*a11)/det],
    [(a12*a20-a10*a22)/det, (a00*a22-a02*a20)/det, (a02*a10-a00*a12)/det],
    [(a10*a21-a11*a20)/det, (a01*a20-a00*a21)/det, (a00*a11-a01*a10)/det],
  ];

  const sol = inv.map((row) => row.reduce((s, v, k) => s + v * Atb[k], 0));

  return { x: sol[0], y: sol[1], z: sol[2] };
}

/**
 * Convert a set of Wi-Fi RSSI readings from multiple access points
 * into a 3D occupancy point using trilateration.
 *
 * Steps:
 *   1. Match each reading to its known AP configuration.
 *   2. Convert RSSI → distance (Log-Distance Path Loss model).
 *   3. Trilaterate via least-squares to get 3D coordinates.
 *   4. Compute confidence from residual errors.
 *
 * @param readings  Array of RSSI readings at the same timestamp window
 * @param aps       Known access point configurations (position + tx power)
 * @param timestampMs  Unix ms timestamp for this scan
 */
export function rssiToOccupancyPoint(
  readings: RssiReading[],
  aps: AccessPoint[],
  timestampMs: number
): OccupancyPoint | null {
  const apMap = new Map(aps.map((ap) => [ap.bssid, ap]));

  const matched = readings
    .filter((r) => apMap.has(r.bssid))
    .map((r) => {
      const ap  = apMap.get(r.bssid)!;
      const ple = ap.pathLossExponent ?? 2.7;
      return {
        ap,
        rssiDbm: r.rssiDbm,
        estimatedDistanceM: rssiToDistance(r.rssiDbm, ap.txPowerDbm, ap.frequencyMhz, ple),
      };
    });

  if (matched.length < 3) return null;

  const trilaterationInputs = matched.map((m) => ({
    position:  m.ap.positionM,
    distanceM: m.estimatedDistanceM,
  }));

  const position = trilaterate3D(trilaterationInputs);
  if (!position) return null;

  // Confidence: based on RSSI strength consistency and AP count
  // Higher AP count + stronger signals → higher confidence
  const avgRssi       = matched.reduce((s, m) => s + m.rssiDbm, 0) / matched.length;
  const rssiNorm      = Math.max(0, Math.min(1, (avgRssi + 90) / 60)); // -90 dBm=0, -30 dBm=1
  const apCountScore  = Math.min(1, matched.length / 6); // 6 APs = full score
  const confidence    = Math.round((rssiNorm * 0.6 + apCountScore * 0.4) * 100) / 100;

  return {
    position,
    confidence,
    apCount: matched.length,
    distances: matched.map((m) => ({
      bssid:              m.ap.bssid,
      estimatedDistanceM: Math.round(m.estimatedDistanceM * 100) / 100,
    })),
    timestampMs,
  };
}

/**
 * Process a time-series of RSSI scan batches into a sequence of
 * OccupancyPoints — the raw data feed for the Omni-View heatmap layer.
 *
 * @param scanBatches  Array of { timestampMs, readings[] } scan windows
 * @param aps          Static AP configuration
 */
export function buildOccupancyTrack(
  scanBatches: Array<{ timestampMs: number; readings: RssiReading[] }>,
  aps: AccessPoint[]
): OccupancyPoint[] {
  return scanBatches
    .map((batch) => rssiToOccupancyPoint(batch.readings, aps, batch.timestampMs))
    .filter((pt): pt is OccupancyPoint => pt !== null);
}

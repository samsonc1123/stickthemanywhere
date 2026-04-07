/**
 * toolbox/tools/sovereign-workforce/ambient-stream-ingestor.ts
 * version: 1.0.0
 *
 * Pillar 22: Ambient Intelligence
 * Domains: NEURAL-INFRASTRUCTURE | Physical-Bridge
 *
 * Accepts real-time telemetry from physical-world sensors and routes
 * each signal to the appropriate downstream processor — primarily the
 * Semantic Tagging Layer (visual-analyzer.ts / taxonomy-evolver.ts).
 *
 * Supported sensor types:
 *   WIFI_CSI    — Channel State Information amplitude matrices
 *                 (motion / presence detection via RF phase shifts)
 *   CAMERA      — Raw frame payloads (JPEG / PNG / base64)
 *                 Routed to visual-analyzer for semantic tagging
 *   IOT         — Generic IoT sensor readings (temperature, humidity,
 *                 lux, CO₂, accelerometer, vibration, etc.)
 *   AUDIO       — Amplitude + frequency summary vectors
 *   CUSTOM      — Arbitrary binary / JSON payloads
 *
 * Architecture:
 *   SensorFrame → Ingestor → FrameRouter → Handler chain
 *
 *   Each registered Handler declares which sensor types it accepts.
 *   The Router fan-outs each frame to all matching handlers concurrently.
 *   Handlers return a ClassificationResult that is accumulated in the
 *   IngestorReport and can trigger downstream GoalMonitor conditions.
 *
 * Back-pressure:
 *   A configurable ring-buffer per sensor type caps memory usage.
 *   When the buffer is full, oldest frames are dropped with a warning.
 *
 * Pure TypeScript — no external sensor SDK dependencies.
 * Sensor adapters (WebSocket, HTTP POST, serial, MQTT) are injected
 * via the SensorAdapter interface.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — SENSOR FRAMES
// ═══════════════════════════════════════════════════════════════════

export type SensorType = "WIFI_CSI" | "CAMERA" | "IOT" | "AUDIO" | "CUSTOM";

export interface SensorFrame {
  /** Globally unique frame ID */
  frameId:    string;
  sensorType: SensorType;
  /** Sensor hardware ID or logical name */
  sensorId:   string;
  /** Physical or logical location label */
  location:   string;
  /** Unix ms when the frame was captured */
  capturedAt: number;
  /** Unix ms when the frame arrived at the ingestor */
  receivedAt: number;
  payload:    SensorPayload;
  /** Optional metadata from the sensor firmware */
  metadata?:  Record<string, string | number | boolean>;
}

// ─── Payload union ────────────────────────────────────────────────

export interface WifiCsiPayload {
  type:       "WIFI_CSI";
  /** Amplitude matrix: rows = subcarriers, cols = antenna pairs */
  amplitude:  number[][];
  /** Phase matrix — same dimensions as amplitude */
  phase:      number[][];
  rssi:       number;   // dBm
  frequency:  number;   // MHz
  subcarriers: number;
}

export interface CameraPayload {
  type:      "CAMERA";
  /** base64-encoded image data */
  imageData: string;
  mimeType:  "image/jpeg" | "image/png" | "image/webp";
  width:     number;
  height:    number;
  /** Optional: bounding boxes from an edge-inference model */
  detections?: Array<{ label: string; confidence: number; bbox: { x: number; y: number; w: number; h: number } }>;
}

export interface IotPayload {
  type:    "IOT";
  /** Key → value readings from the sensor */
  readings: Record<string, number>;
  /** Unit map for each reading key, e.g. { "temperature": "°C" } */
  units?:   Record<string, string>;
}

export interface AudioPayload {
  type:       "AUDIO";
  /** RMS amplitude per frequency band */
  amplitudes: number[];
  /** Centre frequency of each band in Hz */
  frequencies: number[];
  durationMs: number;
  sampleRate: number;
}

export interface CustomPayload {
  type:    "CUSTOM";
  format:  string;   // e.g. "json", "msgpack", "protobuf"
  data:    unknown;
}

export type SensorPayload =
  | WifiCsiPayload
  | CameraPayload
  | IotPayload
  | AudioPayload
  | CustomPayload;

// ═══════════════════════════════════════════════════════════════════
// TYPES — CLASSIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════

export type ClassificationLabel =
  | "PRESENCE_DETECTED"
  | "MOTION_DETECTED"
  | "NO_ACTIVITY"
  | "OBJECT_IDENTIFIED"
  | "ANOMALY_DETECTED"
  | "THRESHOLD_CROSSED"
  | "TAGGED"            // Semantic tagging layer processed this frame
  | "ROUTED"            // Passed to downstream without classification
  | "SKIPPED";          // Handler did not process this frame type

export interface ClassificationResult {
  frameId:     string;
  handlerId:   string;
  label:       ClassificationLabel;
  confidence:  number;           // [0, 1]
  tags:        string[];         // semantic tags attached
  metadata:    Record<string, unknown>;
  processedAt: number;           // Unix ms
  latencyMs:   number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — HANDLERS
// ═══════════════════════════════════════════════════════════════════

export interface FrameHandler {
  handlerId:    string;
  accepts:      SensorType[];
  /** Process a single frame and return a classification result */
  handle:       (frame: SensorFrame) => Promise<ClassificationResult>;
  /** Optional priority — higher = runs first. Default: 0 */
  priority?:    number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — SENSOR ADAPTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * A SensorAdapter pushes frames into the ingestor.
 * Implement this for WebSocket, HTTP POST, MQTT, serial, etc.
 */
export interface SensorAdapter {
  adapterId:   string;
  sensorType:  SensorType;
  /**
   * Start the adapter. Call `onFrame` for each received frame.
   * Return a cleanup function (called on shutdown).
   */
  connect:     (onFrame: (frame: SensorFrame) => void) => Promise<() => void>;
}

// ═══════════════════════════════════════════════════════════════════
// RING BUFFER
// ═══════════════════════════════════════════════════════════════════

class RingBuffer<T> {
  private buf:  T[]  = [];
  private head  = 0;
  private _size = 0;

  constructor(private capacity: number) {}

  push(item: T): boolean {
    let dropped = false;
    if (this._size === this.capacity) {
      // Overwrite oldest
      this.buf[this.head] = item;
      this.head           = (this.head + 1) % this.capacity;
      dropped             = true;
    } else {
      this.buf[(this.head + this._size) % this.capacity] = item;
      this._size++;
    }
    return !dropped;
  }

  drain(): T[] {
    const items: T[] = [];
    for (let i = 0; i < this._size; i++) {
      items.push(this.buf[(this.head + i) % this.capacity]);
    }
    this.buf   = [];
    this.head  = 0;
    this._size = 0;
    return items;
  }

  get size(): number { return this._size; }
}

// ═══════════════════════════════════════════════════════════════════
// INGESTOR REPORT
// ═══════════════════════════════════════════════════════════════════

export interface IngestorReport {
  windowStart:        number;
  windowEnd:          number;
  framesReceived:     number;
  framesProcessed:    number;
  framesDropped:      number;
  byType:             Partial<Record<SensorType, { received: number; processed: number }>>;
  classifications:    ClassificationResult[];
  anomalyCount:       number;
  presenceDetected:   boolean;
  motionDetected:     boolean;
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * WiFi CSI motion detector.
 * Computes the variance of the amplitude matrix — high variance = motion.
 */
export function createCsiMotionHandler(
  motionVarianceThreshold = 0.15
): FrameHandler {
  return {
    handlerId: "csi-motion-detector",
    accepts:   ["WIFI_CSI"],
    priority:  10,
    async handle(frame: SensorFrame): Promise<ClassificationResult> {
      const start = Date.now();
      const p     = frame.payload as WifiCsiPayload;
      const flat  = p.amplitude.flat();
      const n     = flat.length || 1;
      const mean  = flat.reduce((s, v) => s + v, 0) / n;
      const variance = flat.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const normalised = Math.min(1, variance / (motionVarianceThreshold * 10));

      const label: ClassificationLabel =
        variance > motionVarianceThreshold ? "MOTION_DETECTED" : "NO_ACTIVITY";

      return {
        frameId:     frame.frameId,
        handlerId:   "csi-motion-detector",
        label,
        confidence:  normalised,
        tags:        [label.toLowerCase().replace(/_/g, "-"), `rssi:${p.rssi}dBm`],
        metadata:    { variance: variance.toFixed(6), rssi: p.rssi, subcarriers: p.subcarriers },
        processedAt: Date.now(),
        latencyMs:   Date.now() - start,
      };
    },
  };
}

/**
 * Camera frame router — converts a CAMERA frame into an AssetInput
 * compatible with visual-analyzer.ts, then calls the provided analyse fn.
 *
 * @param analyseAsset  Import from visual-analyzer.ts and pass here
 */
export function createCameraSemanticHandler(
  analyseAsset: (asset: { mode: "base64"; source: string; hint?: string; assetId?: string }) => Promise<{ tags: Array<{ tag: string; weight: number }>; coreIntent: string; artStyle: string }>
): FrameHandler {
  return {
    handlerId: "camera-semantic-tagger",
    accepts:   ["CAMERA"],
    priority:  5,
    async handle(frame: SensorFrame): Promise<ClassificationResult> {
      const start = Date.now();
      const p     = frame.payload as CameraPayload;

      const cloud = await analyseAsset({
        mode:    "base64",
        source:  p.imageData,
        hint:    `camera frame from ${frame.location} at ${new Date(frame.capturedAt).toISOString()}`,
        assetId: frame.frameId,
      });

      const topTags = cloud.tags.slice(0, 8).map((t) => t.tag);

      return {
        frameId:     frame.frameId,
        handlerId:   "camera-semantic-tagger",
        label:       "TAGGED",
        confidence:  cloud.tags[0]?.weight ?? 0.5,
        tags:        topTags,
        metadata:    { coreIntent: cloud.coreIntent, artStyle: cloud.artStyle, tagCount: cloud.tags.length },
        processedAt: Date.now(),
        latencyMs:   Date.now() - start,
      };
    },
  };
}

/**
 * IoT threshold monitor handler.
 * Fires THRESHOLD_CROSSED when any reading exceeds a configured limit.
 */
export function createIotThresholdHandler(
  thresholds: Record<string, { min?: number; max?: number }>
): FrameHandler {
  return {
    handlerId: "iot-threshold-monitor",
    accepts:   ["IOT"],
    priority:  8,
    async handle(frame: SensorFrame): Promise<ClassificationResult> {
      const start    = Date.now();
      const p        = frame.payload as IotPayload;
      const breaches: string[] = [];

      for (const [key, val] of Object.entries(p.readings)) {
        const rule = thresholds[key];
        if (!rule) continue;
        if (rule.max !== undefined && val > rule.max) breaches.push(`${key}>${rule.max}`);
        if (rule.min !== undefined && val < rule.min) breaches.push(`${key}<${rule.min}`);
      }

      const label: ClassificationLabel = breaches.length ? "THRESHOLD_CROSSED" : "NO_ACTIVITY";

      return {
        frameId:     frame.frameId,
        handlerId:   "iot-threshold-monitor",
        label,
        confidence:  breaches.length ? 1.0 : 0.0,
        tags:        breaches.length ? ["iot-alert", ...breaches] : ["iot-normal"],
        metadata:    { readings: p.readings, breaches },
        processedAt: Date.now(),
        latencyMs:   Date.now() - start,
      };
    },
  };
}

/**
 * Generic passthrough handler — routes any frame type as ROUTED
 * for logging / archival without classification.
 */
export function createPassthroughHandler(accepts: SensorType[] = ["CUSTOM"]): FrameHandler {
  return {
    handlerId: "passthrough-router",
    accepts,
    priority:  0,
    async handle(frame: SensorFrame): Promise<ClassificationResult> {
      return {
        frameId:     frame.frameId,
        handlerId:   "passthrough-router",
        label:       "ROUTED",
        confidence:  1.0,
        tags:        [`sensor:${frame.sensorId}`, `type:${frame.sensorType}`],
        metadata:    { location: frame.location },
        processedAt: Date.now(),
        latencyMs:   0,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// AMBIENT STREAM INGESTOR
// ═══════════════════════════════════════════════════════════════════

export interface IngestorOptions {
  /** Ring-buffer capacity per sensor type. Default: 500 */
  bufferCapacity?: number;
  /** Max concurrent handler executions per frame. Default: 10 */
  maxConcurrency?: number;
  /** If true, log every frame receipt to console. Default: false */
  verbose?: boolean;
  /** Callback fired after every frame is fully processed */
  onFrameProcessed?: (results: ClassificationResult[]) => void;
  /** Callback fired when any result label is ANOMALY_DETECTED */
  onAnomaly?: (frame: SensorFrame, result: ClassificationResult) => void;
}

export class AmbientStreamIngestor {
  private handlers:    FrameHandler[]                         = [];
  private adapters:    Map<string, () => void>                = new Map();
  private buffers:     Map<SensorType, RingBuffer<SensorFrame>> = new Map();
  private report:      IngestorReport;
  private opts:        Required<IngestorOptions>;

  constructor(opts: IngestorOptions = {}) {
    this.opts = {
      bufferCapacity:    opts.bufferCapacity    ?? 500,
      maxConcurrency:    opts.maxConcurrency    ?? 10,
      verbose:           opts.verbose           ?? false,
      onFrameProcessed:  opts.onFrameProcessed  ?? (() => {}),
      onAnomaly:         opts.onAnomaly         ?? (() => {}),
    };
    this.report = this._freshReport();
  }

  // ── Handler registration ─────────────────────────────────────────

  registerHandler(handler: FrameHandler): void {
    this.handlers.push(handler);
    // Keep sorted by priority descending
    this.handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  registerHandlers(handlers: FrameHandler[]): void {
    for (const h of handlers) this.registerHandler(h);
  }

  // ── Adapter connection ───────────────────────────────────────────

  async connectAdapter(adapter: SensorAdapter): Promise<void> {
    const cleanup = await adapter.connect((frame) => this.ingest(frame));
    this.adapters.set(adapter.adapterId, cleanup);
  }

  // ── Direct frame ingestion (for testing / manual push) ───────────

  ingest(frame: SensorFrame): void {
    if (this.opts.verbose) {
      console.log(`[Ingestor] ← ${frame.sensorType}/${frame.sensorId}  id=${frame.frameId}  loc=${frame.location}`);
    }

    // Buffer
    if (!this.buffers.has(frame.sensorType)) {
      this.buffers.set(frame.sensorType, new RingBuffer(this.opts.bufferCapacity));
    }
    const buf = this.buffers.get(frame.sensorType)!;
    const accepted = buf.push(frame);
    if (!accepted) {
      this.report.framesDropped++;
      console.warn(`[Ingestor] Buffer full for ${frame.sensorType} — oldest frame dropped.`);
    }

    this.report.framesReceived++;
    const byType = this.report.byType[frame.sensorType] ?? { received: 0, processed: 0 };
    byType.received++;
    this.report.byType[frame.sensorType] = byType;

    // Route (fire-and-forget — does not block the ingestion path)
    this._routeFrame(frame).catch((err) =>
      console.error(`[Ingestor] Routing error for frame ${frame.frameId}:`, err)
    );
  }

  // ── Routing ──────────────────────────────────────────────────────

  private async _routeFrame(frame: SensorFrame): Promise<void> {
    const matching = this.handlers.filter((h) => h.accepts.includes(frame.sensorType));
    if (matching.length === 0) return;

    const results: ClassificationResult[] = await Promise.all(
      matching.map((h) =>
        h.handle(frame).catch((err): ClassificationResult => ({
          frameId:     frame.frameId,
          handlerId:   h.handlerId,
          label:       "SKIPPED",
          confidence:  0,
          tags:        ["handler-error"],
          metadata:    { error: String(err) },
          processedAt: Date.now(),
          latencyMs:   0,
        }))
      )
    );

    this.report.framesProcessed++;
    const byType = this.report.byType[frame.sensorType]!;
    byType.processed++;

    for (const r of results) {
      this.report.classifications.push(r);
      if (r.label === "MOTION_DETECTED")    this.report.motionDetected   = true;
      if (r.label === "PRESENCE_DETECTED")  this.report.presenceDetected = true;
      if (r.label === "ANOMALY_DETECTED") {
        this.report.anomalyCount++;
        this.opts.onAnomaly(frame, r);
      }
    }

    this.opts.onFrameProcessed(results);
  }

  // ── Report ────────────────────────────────────────────────────────

  /** Snapshot the current report and reset counters */
  flushReport(): IngestorReport {
    const r = { ...this.report, windowEnd: Date.now() };
    this.report = this._freshReport();
    return r;
  }

  peekReport(): Readonly<IngestorReport> {
    return { ...this.report, windowEnd: Date.now() };
  }

  // ── Shutdown ──────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    for (const cleanup of this.adapters.values()) cleanup();
    this.adapters.clear();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private _freshReport(): IngestorReport {
    return {
      windowStart:      Date.now(),
      windowEnd:        Date.now(),
      framesReceived:   0,
      framesProcessed:  0,
      framesDropped:    0,
      byType:           {},
      classifications:  [],
      anomalyCount:     0,
      presenceDetected: false,
      motionDetected:   false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SENSOR ADAPTER FACTORIES
// ═══════════════════════════════════════════════════════════════════

let _frameCounter = 0;
function nextFrameId(): string {
  return `frm_${Date.now()}_${(++_frameCounter).toString().padStart(6, "0")}`;
}

/**
 * HTTP POST adapter — listens for frames POSTed to a given path.
 * Mount on any HTTP server; call `onFrame` with the parsed body.
 *
 * Usage: call `adapter.connect(onFrame)` and the returned cleanup
 * closes any server resources.
 *
 * This factory returns a helper that parses an incoming HTTP request body
 * into a SensorFrame — plug into Bun.serve() or Node http.createServer().
 */
export function createHttpPostAdapter(
  sensorType: SensorType,
  sensorId:   string,
  location:   string
): SensorAdapter {
  return {
    adapterId:  `http-${sensorType.toLowerCase()}-${sensorId}`,
    sensorType,
    async connect(onFrame) {
      // Returns a builder the caller invokes on each HTTP request body
      // The actual HTTP server is owned by the caller — this adapter
      // is a frame-builder/forwarder.
      (globalThis as Record<string, unknown>)[`__ingest_${sensorId}`] = (payload: SensorPayload) => {
        onFrame({
          frameId:    nextFrameId(),
          sensorType,
          sensorId,
          location,
          capturedAt: Date.now(),
          receivedAt: Date.now(),
          payload,
        });
      };
      console.log(`[Adapter] HTTP POST adapter registered for ${sensorType}/${sensorId} at ${location}`);
      return () => {
        delete (globalThis as Record<string, unknown>)[`__ingest_${sensorId}`];
      };
    },
  };
}

/**
 * Simulated sensor adapter for testing — emits synthetic frames
 * at a given interval.
 */
export function createSimulatedAdapter(
  sensorType:    SensorType,
  sensorId:      string,
  location:      string,
  payloadFn:     () => SensorPayload,
  intervalMs:    number = 1000
): SensorAdapter {
  return {
    adapterId:  `sim-${sensorType.toLowerCase()}-${sensorId}`,
    sensorType,
    async connect(onFrame) {
      const timer = setInterval(() => {
        onFrame({
          frameId:    nextFrameId(),
          sensorType,
          sensorId,
          location,
          capturedAt: Date.now(),
          receivedAt: Date.now(),
          payload:    payloadFn(),
        });
      }, intervalMs);
      return () => clearInterval(timer);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format an IngestorReport as a compact one-block summary.
 */
export function formatIngestorReport(report: IngestorReport): string {
  const durationMs = report.windowEnd - report.windowStart;
  const fps = durationMs > 0 ? ((report.framesReceived / durationMs) * 1000).toFixed(2) : "—";

  const byTypeLines = (Object.entries(report.byType) as [SensorType, { received: number; processed: number }][])
    .map(([t, s]) => `    ${t.padEnd(10)} recv:${s.received}  proc:${s.processed}`)
    .join("\n");

  const topLabels = new Map<string, number>();
  for (const c of report.classifications) {
    topLabels.set(c.label, (topLabels.get(c.label) ?? 0) + 1);
  }
  const labelStr = [...topLabels.entries()].map(([l, n]) => `${l}×${n}`).join("  ");

  return [
    `Ingestor Report — window: ${new Date(report.windowStart).toISOString()} → ${new Date(report.windowEnd).toISOString()}`,
    `Frames  recv:${report.framesReceived}  proc:${report.framesProcessed}  dropped:${report.framesDropped}  fps:${fps}`,
    `Anomalies:${report.anomalyCount}  Presence:${report.presenceDetected}  Motion:${report.motionDetected}`,
    byTypeLines,
    `Labels: ${labelStr || "none"}`,
  ].join("\n");
}

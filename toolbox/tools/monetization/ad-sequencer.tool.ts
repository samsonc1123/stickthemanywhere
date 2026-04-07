/**
 * toolbox/tools/monetization/ad-sequencer.tool.ts
 * version: 1.0.0
 *
 * Monetized Interface — Ad Sequencer Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Framework-agnostic rotation engine for 3D ad assets within a WebGL context.
 * The caller (Three.js, Babylon.js, raw WebGL, or React Three Fiber) hooks
 * into the lifecycle callbacks — this engine owns scheduling, ledger tracking,
 * and impression/click accounting. It never touches the DOM directly.
 *
 * Pillar 11: Monetized Interface (GAB domain: COMMERCIAL-ENGINE)
 *
 * Key design decisions:
 *   - Rotation interval: 3.3 seconds (configurable)
 *   - Impression counted when an asset has been visible for ≥ 1 full second
 *   - Click tracked with coordinates for heat-map analysis
 *   - All ledger data flows into the Yellow Pages revenue tracker
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type AdAssetType =
  | "3d-model"     // GLTF/GLB food model or product mesh
  | "texture"      // Flat ad texture mapped onto a plane
  | "video"        // Video texture (mp4 / webm)
  | "billboard"    // Dynamic text + background render
  | "holographic"; // Transparent layered render

export interface AdAsset {
  id:           string;
  type:         AdAssetType;
  /** Path or URL to the asset on the Synology NAS or CDN */
  assetPath:    string;
  /** Display name shown in the ledger */
  label:        string;
  /** Advertiser or Yellow Pages business ID */
  advertiserId: string;
  /** Cost-per-impression in USD cents */
  cpiCents:     number;
  /** Cost-per-click in USD cents */
  cpcCents:     number;
  /** If set, asset is only shown between these Unix ms timestamps */
  scheduledStart?: number;
  scheduledEnd?:   number;
  /** Priority 1–10. Higher = shown more frequently in rotation */
  priority:     number;
  isActive:     boolean;
  /** Optional 3D transform override for this specific asset */
  transform?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?:    [number, number, number];
  };
}

export interface ImpressionRecord {
  impressionId:   string;
  assetId:        string;
  advertiserId:   string;
  startMs:        number;
  endMs:          number;
  durationMs:     number;
  /** True if the impression was ≥ 1 full second (billable) */
  billable:       boolean;
  valueCents:     number;
}

export interface ClickRecord {
  clickId:        string;
  assetId:        string;
  advertiserId:   string;
  timestampMs:    number;
  /** Normalised click position within the ad surface [0,1] */
  normalizedX:    number;
  normalizedY:    number;
  valueCents:     number;
}

export interface SequencerLedger {
  sessionId:        string;
  startMs:          number;
  impressions:      ImpressionRecord[];
  clicks:           ClickRecord[];
  totalImpressions: number;
  billableImpressions: number;
  totalClicks:      number;
  grossRevenueCents: number;
  /** Revenue broken down by advertiser */
  byAdvertiser:     Record<string, { impressions: number; clicks: number; revenueCents: number }>;
}

export interface SequencerState {
  currentAsset:    AdAsset | null;
  currentIndex:    number;
  queue:           AdAsset[];
  isPlaying:       boolean;
  elapsedMs:       number;
  intervalMs:      number;
  rotationCount:   number;
  ledger:          SequencerLedger;
}

export interface SequencerCallbacks {
  /** Called when a new asset becomes active. Mount or swap your WebGL mesh here. */
  onAssetChange?:   (asset: AdAsset, index: number) => void;
  /** Called every animation-frame tick with elapsed time. Drive rotations here. */
  onTick?:          (state: SequencerState, deltaMs: number) => void;
  /** Called when a billable impression is recorded. */
  onImpression?:    (record: ImpressionRecord) => void;
  /** Called when a click is recorded. */
  onClick?:         (record: ClickRecord) => void;
  /** Called when the full queue has rotated once. */
  onCycleComplete?: (ledger: SequencerLedger) => void;
}

export interface SequencerConfig {
  /** Rotation interval in ms. Default 3300 (3.3 s). */
  intervalMs?:    number;
  /** Minimum visible ms before an impression is counted as billable. Default 1000. */
  billableThresholdMs?: number;
  /** Whether to loop the queue. Default true. */
  loop?:          boolean;
  /** Shuffle the queue on each cycle. Default false. */
  shuffle?:       boolean;
  /** Respect asset.priority for weighted rotation. Default true. */
  priorityWeighted?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a priority-weighted rotation queue from an asset list */
function buildWeightedQueue(assets: AdAsset[], weighted: boolean): AdAsset[] {
  if (!weighted) return [...assets];
  const expanded: AdAsset[] = [];
  for (const asset of assets) {
    const slots = Math.max(1, Math.round(asset.priority));
    for (let i = 0; i < slots; i++) expanded.push(asset);
  }
  return expanded;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isScheduledActive(asset: AdAsset, nowMs: number): boolean {
  if (asset.scheduledStart && nowMs < asset.scheduledStart) return false;
  if (asset.scheduledEnd   && nowMs > asset.scheduledEnd)   return false;
  return true;
}

function emptyLedger(sessionId: string): SequencerLedger {
  return {
    sessionId,
    startMs:             Date.now(),
    impressions:         [],
    clicks:              [],
    totalImpressions:    0,
    billableImpressions: 0,
    totalClicks:         0,
    grossRevenueCents:   0,
    byAdvertiser:        {},
  };
}

function creditAdvertiser(
  ledger: SequencerLedger,
  advertiserId: string,
  revenueCents: number,
  type: "impression" | "click"
): void {
  if (!ledger.byAdvertiser[advertiserId]) {
    ledger.byAdvertiser[advertiserId] = { impressions: 0, clicks: 0, revenueCents: 0 };
  }
  const entry = ledger.byAdvertiser[advertiserId];
  entry.revenueCents += revenueCents;
  if (type === "impression") entry.impressions++;
  else                       entry.clicks++;
}

// ═══════════════════════════════════════════════════════════════════
// AD SEQUENCER CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * AdSequencer — stateful rotation engine.
 *
 * Usage (framework-agnostic):
 *
 *   const seq = new AdSequencer(assets, {
 *     callbacks: {
 *       onAssetChange: (asset) => loadGltfModel(asset.assetPath),
 *       onTick: (state, delta) => mesh.rotation.y += delta * 0.001,
 *     }
 *   });
 *
 *   // In your animation loop:
 *   seq.tick(performance.now());
 *
 *   // On user click on the ad surface:
 *   seq.recordClick(normalizedX, normalizedY);
 */
export class AdSequencer {
  private config:    Required<SequencerConfig>;
  private callbacks: SequencerCallbacks;
  private state:     SequencerState;
  private lastTickMs:      number | null = null;
  private assetStartMs:    number | null = null;
  private accumulatedMs    = 0;
  private cycleStartIndex  = 0;

  constructor(
    assets: AdAsset[],
    options: { config?: SequencerConfig; callbacks?: SequencerCallbacks } = {}
  ) {
    this.config = {
      intervalMs:          options.config?.intervalMs          ?? 3300,
      billableThresholdMs: options.config?.billableThresholdMs ?? 1000,
      loop:                options.config?.loop                ?? true,
      shuffle:             options.config?.shuffle             ?? false,
      priorityWeighted:    options.config?.priorityWeighted    ?? true,
    };
    this.callbacks = options.callbacks ?? {};

    const active = assets.filter((a) => a.isActive);
    let queue     = buildWeightedQueue(active, this.config.priorityWeighted);
    if (this.config.shuffle) queue = shuffleArray(queue);

    const sessionId = generateId("session");
    this.state = {
      currentAsset:  queue[0] ?? null,
      currentIndex:  0,
      queue,
      isPlaying:     false,
      elapsedMs:     0,
      intervalMs:    this.config.intervalMs,
      rotationCount: 0,
      ledger:        emptyLedger(sessionId),
    };
  }

  // ── Playback control ───────────────────────────────────────────

  play(): void {
    if (this.state.isPlaying) return;
    this.state.isPlaying = true;
    this.assetStartMs    = null; // reset on resume
    if (this.state.currentAsset) {
      this.callbacks.onAssetChange?.(this.state.currentAsset, this.state.currentIndex);
    }
  }

  pause(): void {
    this.state.isPlaying = false;
    this._closeCurrentImpression();
  }

  stop(): void {
    this.pause();
    this.accumulatedMs   = 0;
    this.state.elapsedMs = 0;
  }

  // ── Tick — call from your rAF / animation loop ─────────────────

  /**
   * Advance the sequencer by one frame.
   * @param nowMs  Current timestamp in ms (e.g. performance.now() or Date.now())
   */
  tick(nowMs: number): void {
    if (!this.state.isPlaying) return;

    const deltaMs = this.lastTickMs !== null ? nowMs - this.lastTickMs : 0;
    this.lastTickMs = nowMs;

    if (this.assetStartMs === null) this.assetStartMs = nowMs;

    this.accumulatedMs   += deltaMs;
    this.state.elapsedMs += deltaMs;

    this.callbacks.onTick?.(this.state, deltaMs);

    if (this.accumulatedMs >= this.config.intervalMs) {
      this._advance(nowMs);
      this.accumulatedMs = 0;
    }
  }

  // ── Click recording ────────────────────────────────────────────

  /**
   * Record a click on the currently displayed ad surface.
   * Call this from your WebGL raycaster hit callback.
   *
   * @param normalizedX  Click X position normalised to [0, 1] within ad surface
   * @param normalizedY  Click Y position normalised to [0, 1] within ad surface
   */
  recordClick(normalizedX: number, normalizedY: number): ClickRecord | null {
    const asset = this.state.currentAsset;
    if (!asset) return null;

    const record: ClickRecord = {
      clickId:      generateId("click"),
      assetId:      asset.id,
      advertiserId: asset.advertiserId,
      timestampMs:  Date.now(),
      normalizedX,
      normalizedY,
      valueCents:   asset.cpcCents,
    };

    this.state.ledger.clicks.push(record);
    this.state.ledger.totalClicks++;
    this.state.ledger.grossRevenueCents += record.valueCents;
    creditAdvertiser(this.state.ledger, asset.advertiserId, record.valueCents, "click");

    this.callbacks.onClick?.(record);
    return record;
  }

  // ── Ledger accessors ───────────────────────────────────────────

  getLedger(): SequencerLedger {
    return { ...this.state.ledger };
  }

  getState(): Readonly<SequencerState> {
    return this.state;
  }

  /** Snapshot the ledger for persistence to the Yellow Pages DB */
  exportLedgerSnapshot(): {
    sessionId: string;
    snapshotMs: number;
    totalImpressions: number;
    billableImpressions: number;
    totalClicks: number;
    grossRevenueCents: number;
    grossRevenueDollars: string;
    byAdvertiser: SequencerLedger["byAdvertiser"];
  } {
    const l = this.state.ledger;
    return {
      sessionId:           l.sessionId,
      snapshotMs:          Date.now(),
      totalImpressions:    l.totalImpressions,
      billableImpressions: l.billableImpressions,
      totalClicks:         l.totalClicks,
      grossRevenueCents:   l.grossRevenueCents,
      grossRevenueDollars: (l.grossRevenueCents / 100).toFixed(2),
      byAdvertiser:        { ...l.byAdvertiser },
    };
  }

  // ── Private ────────────────────────────────────────────────────

  private _advance(nowMs: number): void {
    // Close the current impression before rotating
    this._closeCurrentImpression();

    const queue = this.state.queue;
    if (queue.length === 0) return;

    let nextIndex = this.state.currentIndex + 1;

    // Detect full cycle completion
    if (nextIndex >= queue.length) {
      if (!this.config.loop) {
        this.pause();
        return;
      }
      this.callbacks.onCycleComplete?.(this.getLedger());
      nextIndex = 0;
      if (this.config.shuffle) {
        this.state.queue = shuffleArray(queue);
      }
    }

    // Skip schedule-inactive assets (up to one full loop)
    let attempts = 0;
    while (!isScheduledActive(queue[nextIndex], nowMs) && attempts < queue.length) {
      nextIndex = (nextIndex + 1) % queue.length;
      attempts++;
    }

    this.state.currentIndex = nextIndex;
    this.state.currentAsset  = queue[nextIndex];
    this.state.rotationCount++;
    this.assetStartMs        = nowMs;

    this.callbacks.onAssetChange?.(this.state.currentAsset, nextIndex);
  }

  private _closeCurrentImpression(): void {
    const asset = this.state.currentAsset;
    if (!asset || this.assetStartMs === null) return;

    const endMs      = Date.now();
    const durationMs = endMs - this.assetStartMs;
    const billable   = durationMs >= this.config.billableThresholdMs;
    const valueCents = billable ? asset.cpiCents : 0;

    const record: ImpressionRecord = {
      impressionId: generateId("imp"),
      assetId:      asset.id,
      advertiserId: asset.advertiserId,
      startMs:      this.assetStartMs,
      endMs,
      durationMs,
      billable,
      valueCents,
    };

    const ledger = this.state.ledger;
    ledger.impressions.push(record);
    ledger.totalImpressions++;
    if (billable) {
      ledger.billableImpressions++;
      ledger.grossRevenueCents += valueCents;
      creditAdvertiser(ledger, asset.advertiserId, valueCents, "impression");
    }

    this.callbacks.onImpression?.(record);
    this.assetStartMs = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PURE HELPERS (importable without instantiating AdSequencer)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a 3D Y-axis rotation angle for a given elapsed time.
 * Gives your WebGL renderer a single float to plug into mesh.rotation.y.
 *
 * @param elapsedMs   Total elapsed milliseconds since rotation start
 * @param rpm         Revolutions per minute. Default 6 (one full spin per 10 s).
 */
export function computeRotationAngle(elapsedMs: number, rpm = 6): number {
  const rps = rpm / 60;
  return ((elapsedMs / 1000) * rps * 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Generate a simple WebGL-compatible model matrix (column-major Float32Array)
 * for a billboard that always faces the camera, scaled uniformly.
 *
 * This is a translation × uniform-scale matrix only — rotation is handled
 * by the caller's view matrix or billboard shader.
 */
export function buildBillboardMatrix(
  tx: number, ty: number, tz: number,
  scale: number
): Float32Array {
  // Column-major 4×4 identity with translation and uniform scale
  return new Float32Array([
    scale, 0,     0,     0,
    0,     scale, 0,     0,
    0,     0,     scale, 0,
    tx,    ty,    tz,    1,
  ]);
}

/**
 * Filter an asset list down to those that are currently schedulable.
 */
export function filterScheduledAssets(assets: AdAsset[], nowMs = Date.now()): AdAsset[] {
  return assets.filter((a) => a.isActive && isScheduledActive(a, nowMs));
}

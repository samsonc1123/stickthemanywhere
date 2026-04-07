/**
 * toolbox/tools/monetization/typing-engine.tool.ts
 * version: 1.0.0
 *
 * Monetized Interface — Typing Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Manages a real-time typing challenge session:
 *   - Provides text segments sourced from the GAB 'Historical-Truth' domain
 *   - Calculates WPM (Words Per Minute) and accuracy in real-time
 *   - Tracks character-level events for detailed session replay
 *   - Integrates with the Yellow Pages ledger for gamified ad revenue
 *
 * Pillar 11: Monetized Interface (GAB domain: COMMERCIAL-ENGINE)
 *
 * WPM standard: 1 "word" = 5 characters (industry standard).
 * Accuracy: correct characters / total typed characters × 100.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — TEXT SEGMENTS
// ═══════════════════════════════════════════════════════════════════

export type HistoricalTruthTopic =
  | "pre-flood-atmosphere"
  | "canopy-hypothesis"
  | "ancient-chronology"
  | "gematria-significance"
  | "edenic-geography"
  | "patriarchal-longevity"
  | "flood-geology"
  | "spectral-discernment"
  | "general";

export interface TextSegment {
  id:          string;
  text:        string;
  topic:       HistoricalTruthTopic;
  /** Estimated difficulty 1–5 (punctuation density, word length, etc.) */
  difficulty:  number;
  /** Source attribution (e.g. "GAB Historical-Truth Domain") */
  source:      string;
  wordCount:   number;
  charCount:   number;
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN SEGMENT LIBRARY  (Historical-Truth domain)
// ═══════════════════════════════════════════════════════════════════

const SEGMENT_LIBRARY: TextSegment[] = [
  {
    id: "ht-001",
    text: "The pre-Flood atmosphere maintained a higher barometric pressure due to a hypothesized water-vapor canopy above the troposphere. This elevated pressure would have increased oxygen partial pressure at the surface, supporting larger fauna and extended human lifespans recorded in early genealogies.",
    topic: "pre-flood-atmosphere",
    difficulty: 4,
    source: "GAB Historical-Truth Domain",
    wordCount: 44,
    charCount: 285,
  },
  {
    id: "ht-002",
    text: "Standard Gematria, known as Mispar Hechrachi, assigns each Hebrew letter its traditional ordinal value. The letter Aleph carries a value of one, while Tav, the final letter, carries four hundred. Theosophical reduction collapses any sum to a single digit by iteratively summing its digits.",
    topic: "gematria-significance",
    difficulty: 3,
    source: "GAB Historical-Truth Domain",
    wordCount: 48,
    charCount: 289,
  },
  {
    id: "ht-003",
    text: "Flood geology proposes that the stratigraphic record observed in sedimentary layers was deposited rapidly during a global catastrophic event rather than over millions of years. Hydrological sorting accounts for the observed fossil distribution without invoking deep-time uniformitarian assumptions.",
    topic: "flood-geology",
    difficulty: 5,
    source: "GAB Historical-Truth Domain",
    wordCount: 42,
    charCount: 283,
  },
  {
    id: "ht-004",
    text: "The canopy hypothesis, as developed by Joseph Dillow in 1981, estimated that a global water-vapor firmament of approximately 1,600 kilograms per square meter would have contributed an additional two atmospheres of surface pressure. Vardiman later proposed higher estimates in the range of 2,500 kilograms.",
    topic: "canopy-hypothesis",
    difficulty: 4,
    source: "GAB Historical-Truth Domain",
    wordCount: 50,
    charCount: 305,
  },
  {
    id: "ht-005",
    text: "Patriarchal longevity in the pre-Flood genealogies of Genesis records individuals living beyond nine hundred years. Proposed mechanisms include a hyperoxic atmosphere, reduced ultraviolet radiation from the vapor canopy shielding, absence of accumulated genetic mutations, and optimized metabolic conditions.",
    topic: "patriarchal-longevity",
    difficulty: 4,
    source: "GAB Historical-Truth Domain",
    wordCount: 41,
    charCount: 278,
  },
  {
    id: "ht-006",
    text: "Near-infrared spectroscopy reveals molecular absorption bands invisible to the human eye. When mapped into a composite visible frame using false-color techniques, NIR data highlights biological activity, structural material composition, and thermal gradients that standard visible-light cameras cannot capture.",
    topic: "spectral-discernment",
    difficulty: 4,
    source: "GAB Historical-Truth Domain",
    wordCount: 44,
    charCount: 284,
  },
  {
    id: "ht-007",
    text: "The Edenic geography described in Genesis references four rivers diverging from a single source. Post-Flood tectonic activity and sediment redistribution significantly reshaped the pre-Flood landscape, making direct correlation with modern geography complex but not without merit for comparative study.",
    topic: "edenic-geography",
    difficulty: 3,
    source: "GAB Historical-Truth Domain",
    wordCount: 45,
    charCount: 282,
  },
  {
    id: "ht-008",
    text: "Ancient chronology diverges significantly between the Masoretic, Septuagint, and Samaritan Pentateuch manuscripts. The Septuagint preserves an additional millennium of pre-Flood patriarchal ages, which some scholars argue aligns more accurately with independent archaeological and astronomical calibration sources.",
    topic: "ancient-chronology",
    difficulty: 5,
    source: "GAB Historical-Truth Domain",
    wordCount: 40,
    charCount: 285,
  },
];

// ═══════════════════════════════════════════════════════════════════
// SEGMENT SELECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Retrieve text segments from the GAB Historical-Truth domain library.
 * Mirrors the interface a Convex query would expose so the caller can
 * swap in a real DB fetch without changing consuming code.
 *
 * @param topic      Filter by topic. Omit for all topics.
 * @param difficulty Max difficulty level (1–5). Omit for all.
 * @param limit      Maximum segments to return. Default 5.
 * @param shuffle    Randomise order. Default true.
 */
export function getSegments(options: {
  topic?:      HistoricalTruthTopic;
  difficulty?: number;
  limit?:      number;
  shuffle?:    boolean;
} = {}): TextSegment[] {
  const { topic, difficulty, limit = 5, shuffle = true } = options;

  let pool = SEGMENT_LIBRARY.filter((s) => {
    if (topic && s.topic !== topic) return false;
    if (difficulty && s.difficulty > difficulty) return false;
    return true;
  });

  if (shuffle) {
    pool = [...pool].sort(() => Math.random() - 0.5);
  }

  return pool.slice(0, limit);
}

/**
 * Get a single segment by id.
 */
export function getSegmentById(id: string): TextSegment | null {
  return SEGMENT_LIBRARY.find((s) => s.id === id) ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — TYPING SESSION
// ═══════════════════════════════════════════════════════════════════

export type KeyEventType = "correct" | "incorrect" | "backspace" | "space" | "skip";

export interface KeyEvent {
  type:        KeyEventType;
  expected:    string;
  actual:      string;
  positionIndex: number;
  timestampMs: number;
  /** Time since previous keystroke in ms (inter-key latency) */
  latencyMs:   number;
}

export interface RealTimeMetrics {
  /** Words per minute (5-char standard). Computed over total session duration. */
  wpm:               number;
  /** Raw WPM — only correct characters counted */
  rawWpm:            number;
  /** Accuracy 0–100 (correct chars / total typed chars × 100) */
  accuracy:          number;
  /** Total characters typed (including backspaces) */
  totalTyped:        number;
  /** Correct characters (against the target text) */
  correctChars:      number;
  /** Incorrect characters */
  incorrectChars:    number;
  /** Backspace count */
  backspaces:        number;
  /** Session duration in seconds */
  elapsedSeconds:    number;
  /** Current position in the target text */
  cursorPosition:    number;
  /** Characters remaining */
  remaining:         number;
  /** Estimated seconds to completion at current WPM */
  etaSeconds:        number | null;
  /** Consistency score 0–100: inverse of inter-key latency variance */
  consistency:       number;
}

export interface SessionResult {
  sessionId:         string;
  segment:           TextSegment;
  startMs:           number;
  endMs:             number;
  durationMs:        number;
  finalMetrics:      RealTimeMetrics;
  keyEvents:         KeyEvent[];
  completedFully:    boolean;
  /** Errors per word (EPW) */
  errorsPerWord:     number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPING SESSION CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * TypingSession — stateful engine for one typing challenge.
 *
 * Usage (framework-agnostic):
 *
 *   const session = new TypingSession(segment);
 *   session.start();
 *
 *   // On each keypress in your UI:
 *   const metrics = session.processKey(event.key);
 *   updateUI(metrics);
 *
 *   // On completion:
 *   const result = session.finish();
 */
export class TypingSession {
  private segment:       TextSegment;
  private sessionId:     string;
  private startMs:       number | null = null;
  private lastKeyMs:     number | null = null;
  private keyEvents:     KeyEvent[]    = [];
  private inputBuffer:   string        = "";
  private isActive:      boolean       = false;
  private isFinished:    boolean       = false;
  private onMetrics?:    (metrics: RealTimeMetrics) => void;
  private onComplete?:   (result: SessionResult) => void;

  constructor(
    segment: TextSegment,
    callbacks?: {
      onMetrics?:  (metrics: RealTimeMetrics) => void;
      onComplete?: (result: SessionResult) => void;
    }
  ) {
    this.segment     = segment;
    this.sessionId   = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.onMetrics   = callbacks?.onMetrics;
    this.onComplete  = callbacks?.onComplete;
  }

  // ── Control ────────────────────────────────────────────────────

  start(): void {
    if (this.isActive) return;
    this.startMs   = Date.now();
    this.isActive  = true;
    this.inputBuffer = "";
    this.keyEvents   = [];
  }

  /** Manually finish (e.g. time-out or user quit) */
  finish(): SessionResult {
    this.isActive  = false;
    this.isFinished = true;
    return this._buildResult(Date.now());
  }

  // ── Key processing ─────────────────────────────────────────────

  /**
   * Process a single keypress. Returns current real-time metrics.
   * Call this inside your keydown / input handler.
   *
   * @param key  The pressed key value (e.g. "a", "Backspace", " ")
   */
  processKey(key: string): RealTimeMetrics {
    if (!this.isActive || this.isFinished) return this._computeMetrics();

    const nowMs     = Date.now();
    const latencyMs = this.lastKeyMs !== null ? nowMs - this.lastKeyMs : 0;
    this.lastKeyMs  = nowMs;

    const target = this.segment.text;
    const pos    = this.inputBuffer.length;

    if (key === "Backspace") {
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.keyEvents.push({
          type: "backspace", expected: target[pos - 1] ?? "", actual: key,
          positionIndex: pos - 1, timestampMs: nowMs, latencyMs,
        });
      }
    } else if (key.length === 1) {
      // Single printable character
      const expected = target[pos] ?? "";
      const isCorrect = key === expected;

      this.inputBuffer += key;
      this.keyEvents.push({
        type:          isCorrect ? (key === " " ? "space" : "correct") : "incorrect",
        expected,
        actual:        key,
        positionIndex: pos,
        timestampMs:   nowMs,
        latencyMs,
      });
    }

    const metrics = this._computeMetrics();
    this.onMetrics?.(metrics);

    // Auto-complete when the full text is typed correctly
    if (this.inputBuffer === target) {
      const result = this._buildResult(nowMs);
      this.isFinished = true;
      this.isActive   = false;
      this.onComplete?.(result);
    }

    return metrics;
  }

  // ── Accessors ──────────────────────────────────────────────────

  getInputBuffer():    string   { return this.inputBuffer; }
  getTargetText():     string   { return this.segment.text; }
  getCursorPosition(): number   { return this.inputBuffer.length; }
  isComplete():        boolean  { return this.isFinished; }

  // ── Metrics computation ────────────────────────────────────────

  private _computeMetrics(): RealTimeMetrics {
    const target         = this.segment.text;
    const elapsedMs      = this.startMs !== null ? Date.now() - this.startMs : 0;
    const elapsedSeconds = elapsedMs / 1000;
    const elapsedMinutes = elapsedSeconds / 60;

    const backspaces     = this.keyEvents.filter((e) => e.type === "backspace").length;
    const allTyped       = this.keyEvents.filter((e) => e.type !== "backspace");
    const correctChars   = this._countCorrectChars();
    const incorrectChars = allTyped.length - correctChars - backspaces;
    const totalTyped     = allTyped.length;

    // WPM: correct chars / 5 / elapsed minutes
    const wpm    = elapsedMinutes > 0 ? Math.round(correctChars / 5 / elapsedMinutes) : 0;
    // Raw WPM: all typed (including errors) / 5 / elapsed minutes
    const rawWpm = elapsedMinutes > 0 ? Math.round(totalTyped / 5 / elapsedMinutes) : 0;
    // Accuracy: correct typed chars / total typed chars
    const accuracy = totalTyped > 0
      ? Math.round((correctChars / totalTyped) * 10000) / 100
      : 100;

    const cursorPosition = this.inputBuffer.length;
    const remaining      = Math.max(0, target.length - cursorPosition);

    const etaSeconds = wpm > 0 && remaining > 0
      ? Math.round((remaining / 5 / wpm) * 60)
      : null;

    // Consistency: 100 - coefficient of variation of inter-key latencies
    const latencies = this.keyEvents
      .filter((e) => e.type !== "backspace" && e.latencyMs > 0)
      .map((e) => e.latencyMs);

    let consistency = 100;
    if (latencies.length > 2) {
      const mu  = latencies.reduce((s, v) => s + v, 0) / latencies.length;
      const sd  = Math.sqrt(latencies.reduce((s, v) => s + (v - mu) ** 2, 0) / latencies.length);
      const cv  = mu > 0 ? sd / mu : 1;
      consistency = Math.round(Math.max(0, (1 - cv) * 100));
    }

    return {
      wpm, rawWpm, accuracy,
      totalTyped,
      correctChars,
      incorrectChars: Math.max(0, incorrectChars),
      backspaces,
      elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
      cursorPosition,
      remaining,
      etaSeconds,
      consistency,
    };
  }

  /**
   * Count correctly typed characters by comparing inputBuffer against target
   * character by character. Does NOT award credit for overcorrected errors.
   */
  private _countCorrectChars(): number {
    const target = this.segment.text;
    let correct  = 0;
    for (let i = 0; i < Math.min(this.inputBuffer.length, target.length); i++) {
      if (this.inputBuffer[i] === target[i]) correct++;
    }
    return correct;
  }

  private _buildResult(endMs: number): SessionResult {
    const startMs    = this.startMs ?? endMs;
    const durationMs = endMs - startMs;
    const metrics    = this._computeMetrics();

    return {
      sessionId:      this.sessionId,
      segment:        this.segment,
      startMs,
      endMs,
      durationMs,
      finalMetrics:   metrics,
      keyEvents:      this.keyEvents,
      completedFully: this.inputBuffer === this.segment.text,
      errorsPerWord:  this.segment.wordCount > 0
        ? Math.round((metrics.incorrectChars / this.segment.wordCount) * 100) / 100
        : 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PURE UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute WPM from raw values without a session object.
 */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  return minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0;
}

/**
 * Compute accuracy from raw values.
 */
export function computeAccuracy(correctChars: number, totalTyped: number): number {
  return totalTyped > 0 ? Math.round((correctChars / totalTyped) * 10000) / 100 : 100;
}

/**
 * Diff two strings character-by-character.
 * Returns an array of { char, status: 'correct'|'incorrect'|'pending' }
 * for rendering a colour-coded typing display.
 */
export function diffTyped(
  typed:  string,
  target: string
): Array<{ char: string; status: "correct" | "incorrect" | "pending" }> {
  return target.split("").map((char, i) => {
    if (i >= typed.length)    return { char, status: "pending" };
    if (typed[i] === char)    return { char, status: "correct" };
    return { char, status: "incorrect" };
  });
}

/**
 * Estimate segment difficulty score from raw text.
 * Used when adding custom segments without a pre-assigned difficulty.
 */
export function estimateDifficulty(text: string): number {
  const words         = text.split(/\s+/);
  const avgWordLen    = words.reduce((s, w) => s + w.length, 0) / words.length;
  const punctuationPct = (text.match(/[^a-zA-Z0-9\s]/g) ?? []).length / text.length;
  const capitalPct     = (text.match(/[A-Z]/g) ?? []).length / text.length;
  const score = avgWordLen * 0.4 + punctuationPct * 20 + capitalPct * 10;
  return Math.min(5, Math.max(1, Math.round(score)));
}

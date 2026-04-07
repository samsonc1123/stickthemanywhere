/**
 * toolbox/tools/attention-foundry/structural-miner.ts
 * version: 1.0.0
 *
 * Pillar 19: Format Extraction Engine
 * Domains: MARKETPLACE-INFRASTRUCTURE | Attention-Sovereignty
 *
 * Takes a URL (fetched) or raw transcript text and extracts:
 *   1. A four-beat narrative Timeline: Hook → Context → Tension → Resolution
 *   2. A topic-agnostic Skeleton JSON encoding pacing, rhythm, and structure
 *      — ready to be transmuted into any target topic via format-transmuter.ts
 *
 * Algorithm:
 *   ─ Segmentation:  Text is split into sentences, then grouped into
 *                    semantic "beats" using a sliding energy-window that
 *                    measures lexical density, sentence-length variance,
 *                    and keyword signal strength.
 *   ─ Phase labelling: Each beat is labelled Hook/Context/Tension/Resolution
 *                    using position heuristics + signal keywords.
 *   ─ Skeleton:      Per-beat metadata (position, length, energy, pacing label,
 *                    structural role, anonymised topic slots) is serialised
 *                    as a topic-agnostic SkeletonJSON.
 *
 * Pure TypeScript — no external dependencies.
 * URL fetching uses the built-in fetch() API (Bun / Node 18+).
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — INPUT
// ═══════════════════════════════════════════════════════════════════

export type InputMode = "url" | "transcript";

export interface MinerInput {
  mode:        InputMode;
  /** URL to fetch OR raw transcript text, depending on mode */
  source:      string;
  /** Optional title override (used in Skeleton metadata) */
  title?:      string;
  /** Fetch timeout in ms (URL mode only). Default: 10 000 */
  fetchTimeoutMs?: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — TIMELINE
// ═══════════════════════════════════════════════════════════════════

export type NarrativePhase = "HOOK" | "CONTEXT" | "TENSION" | "RESOLUTION";

export type PacingLabel = "fast" | "medium" | "slow" | "punchy";

/** A single narrative beat within the timeline */
export interface TimelineBeat {
  /** Sequential index (0-based) */
  index:          number;
  phase:          NarrativePhase;
  /** Raw sentences in this beat */
  sentences:      string[];
  /** Concatenated text */
  text:           string;
  /** Average words per sentence */
  avgWordsPerSentence: number;
  /** Lexical density: unique words / total words */
  lexicalDensity: number;
  /** Relative energy score [0, 1] — higher = more intense */
  energy:         number;
  pacing:         PacingLabel;
  /** Detected signal keywords that influenced phase assignment */
  signalKeywords: string[];
  /** Character position of this beat's start in the source text */
  charStart:      number;
  /** Character position of this beat's end in the source text */
  charEnd:        number;
}

export interface NarrativeTimeline {
  beats:          TimelineBeat[];
  totalBeats:     number;
  totalSentences: number;
  totalWords:     number;
  dominantPacing: PacingLabel;
  /** Estimated read-time in seconds (at 150 wpm read aloud) */
  estimatedReadTimeSecs: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — SKELETON JSON
// ═══════════════════════════════════════════════════════════════════

/**
 * A topic-agnostic structural template derived from the source content.
 * All topic-specific words are replaced with {{SLOT_N}} placeholders.
 * Pass to format-transmuter.ts with a target topic to generate new scripts.
 */
export interface SkeletonBeat {
  index:          number;
  phase:          NarrativePhase;
  pacing:         PacingLabel;
  energy:         number;
  sentenceCount:  number;
  avgWordsPerSentence: number;
  /** Anonymised sentence templates with topic words replaced by slots */
  templates:      string[];
  /** Slot keys referenced in this beat's templates, e.g. ["SUBJECT", "CONCEPT_1"] */
  slots:          string[];
  /** Structural cue for the transmuter, e.g. "open-with-question" */
  structuralCue:  string;
}

export interface SkeletonJSON {
  version:        "1.0.0";
  extractedAt:    string;   // ISO timestamp
  sourceTitle:    string;
  sourceMode:     InputMode;
  /** Word count of the source */
  wordCount:      number;
  estimatedReadTimeSecs: number;
  dominantPacing: PacingLabel;
  beats:          SkeletonBeat[];
  /** All unique slot keys across all beats */
  allSlots:       string[];
  /**
   * High-retention structural fingerprint — a compact string encoding
   * the phase sequence and pacing rhythm.
   * e.g. "H:punchy|C:slow|T:fast|T:fast|R:medium"
   */
  fingerprint:    string;
}

// ═══════════════════════════════════════════════════════════════════
// URL FETCHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch a URL and extract readable text.
 * Strips HTML tags, script/style blocks, and normalises whitespace.
 */
async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const resp = await fetch(url, {
    signal:  AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "StructuralMiner/1.0 (toolbox; Bun)" },
  });
  if (!resp.ok) throw new Error(`fetchText: HTTP ${resp.status} for ${url}`);
  const raw = await resp.text();
  // Strip <script>, <style>, HTML tags
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
// SENTENCE SPLITTING
// ═══════════════════════════════════════════════════════════════════

function splitSentences(text: string): string[] {
  // Split on terminal punctuation followed by whitespace or end-of-string
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

// ═══════════════════════════════════════════════════════════════════
// SIGNAL KEYWORDS (phase detection)
// ═══════════════════════════════════════════════════════════════════

const PHASE_SIGNALS: Record<NarrativePhase, string[]> = {
  HOOK: [
    "what if", "imagine", "picture this", "here's the thing",
    "nobody talks about", "the truth is", "most people don't",
    "you won't believe", "shocking", "secret", "discovered", "revealed",
    "i never expected", "everything changed", "the day", "it started when",
  ],
  CONTEXT: [
    "background", "history", "originally", "back in", "let me explain",
    "for context", "traditionally", "it's important to know", "here's why",
    "this is because", "the reason", "founded", "established", "began",
    "at the time", "previously", "according to",
  ],
  TENSION: [
    "problem", "challenge", "crisis", "conflict", "but then", "however",
    "suddenly", "everything changed", "the issue", "struggle", "failed",
    "couldn't", "disaster", "threat", "risk", "danger", "critical",
    "breaking point", "forced to", "had no choice", "despite", "although",
    "yet", "nonetheless", "the catch", "plot twist",
  ],
  RESOLUTION: [
    "solution", "solved", "discovered", "breakthrough", "finally",
    "ultimately", "in the end", "the answer", "turned out", "realised",
    "learned", "takeaway", "lesson", "result", "outcome", "conclusion",
    "now", "today", "moving forward", "going forward", "what this means",
    "the key is", "this proves",
  ],
};

function detectSignalKeywords(text: string): Partial<Record<NarrativePhase, string[]>> {
  const lower = text.toLowerCase();
  const found: Partial<Record<NarrativePhase, string[]>> = {};
  for (const [phase, signals] of Object.entries(PHASE_SIGNALS) as [NarrativePhase, string[]][]) {
    const hits = signals.filter((s) => lower.includes(s));
    if (hits.length) found[phase] = hits;
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════════
// LEXICAL / ENERGY METRICS
// ═══════════════════════════════════════════════════════════════════

function words(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
}

function lexicalDensity(text: string): number {
  const ws = words(text);
  if (ws.length === 0) return 0;
  return new Set(ws).size / ws.length;
}

function avgWordsPerSentence(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((s, sen) => s + words(sen).length, 0);
  return total / sentences.length;
}

/**
 * Compute a normalised energy score for a group of sentences.
 * Energy = weighted combination of:
 *   - punctuation density (!, ?, …)
 *   - short-sentence ratio (punchy = high energy)
 *   - exclamation + interrogative count
 */
function computeEnergy(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  const text = sentences.join(" ");
  const excl   = (text.match(/!/g)  ?? []).length;
  const quest  = (text.match(/\?/g) ?? []).length;
  const ellips = (text.match(/…|\.\.\./g) ?? []).length;
  const wordLen = words(text).length || 1;
  const punctScore = Math.min(1, (excl * 0.4 + quest * 0.3 + ellips * 0.2) / wordLen * 20);
  const shortSentCount = sentences.filter((s) => words(s).length < 8).length;
  const shortRatio = shortSentCount / sentences.length;
  return Math.min(1, punctScore * 0.5 + shortRatio * 0.5);
}

function energyToPacing(energy: number, avgWps: number): PacingLabel {
  if (avgWps < 10 && energy > 0.5) return "punchy";
  if (energy > 0.6)                return "fast";
  if (energy < 0.25)               return "slow";
  return "medium";
}

// ═══════════════════════════════════════════════════════════════════
// BEAT SEGMENTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Group sentences into beats of approximately `targetBeatSize` sentences,
 * respecting natural paragraph breaks (double-newlines in original).
 */
function segmentBeats(sentences: string[], targetBeatSize: number): string[][] {
  const beats: string[][] = [];
  let current: string[] = [];
  for (const s of sentences) {
    current.push(s);
    if (current.length >= targetBeatSize) {
      beats.push(current);
      current = [];
    }
  }
  if (current.length) beats.push(current);
  return beats;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Assign NarrativePhase to each beat using:
 *   1. Signal keyword detection (highest priority)
 *   2. Position heuristics (first 15% = HOOK, last 20% = RESOLUTION)
 *   3. Energy heuristic (high-energy mid-section = TENSION)
 */
function assignPhases(
  beatGroups: string[][],
  energies:   number[]
): NarrativePhase[] {
  const n = beatGroups.length;
  return beatGroups.map((sentences, i) => {
    const text    = sentences.join(" ");
    const signals = detectSignalKeywords(text);
    const pos     = i / n;

    // Keyword overrides — strongest signal wins
    const signalPhases = Object.keys(signals) as NarrativePhase[];
    if (signalPhases.length === 1) return signalPhases[0];
    if (signalPhases.length > 1) {
      // Pick phase with most keyword hits
      const best = signalPhases.reduce((a, b) =>
        (signals[a]?.length ?? 0) >= (signals[b]?.length ?? 0) ? a : b
      );
      return best;
    }

    // Position heuristics
    if (pos < 0.15) return "HOOK";
    if (pos > 0.82) return "RESOLUTION";
    if (energies[i] > 0.45 && pos > 0.35) return "TENSION";
    return "CONTEXT";
  });
}

// ═══════════════════════════════════════════════════════════════════
// TOPIC ANONYMISATION (slot extraction)
// ═══════════════════════════════════════════════════════════════════

/**
 * Replace proper nouns, numbers, and domain-specific terms with
 * typed slot placeholders.  This makes the skeleton topic-agnostic.
 *
 * Slot types:
 *   {{SUBJECT}}      — first proper noun / main entity per beat
 *   {{CONCEPT_N}}    — recurring domain-specific nouns
 *   {{NUMBER_N}}     — numeric values
 *   {{DATE_N}}       — date references
 *   {{LOCATION_N}}   — place names (heuristic: follows "in", "at", "near")
 */
function anonymise(
  sentences: string[],
  beatIndex: number
): { templates: string[]; slots: string[] } {
  const slotRegistry: Map<string, string> = new Map();
  let conceptCount  = 0;
  let numberCount   = 0;
  let dateCount     = 0;
  let locationCount = 0;
  let subjectUsed   = false;

  const templates = sentences.map((sent) => {
    let out = sent;

    // Dates: "January 2020", "2020", "20th century"
    out = out.replace(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\b\d{4}\b|(?:early|mid|late)\s+\d{4}s?)\b/gi, () => {
      const key = `DATE_${++dateCount}`;
      slotRegistry.set(key, key);
      return `{{${key}}}`;
    });

    // Numbers (non-date)
    out = out.replace(/\b\d[\d,.]*%?\b/g, () => {
      const key = `NUMBER_${++numberCount}`;
      slotRegistry.set(key, key);
      return `{{${key}}}`;
    });

    // Locations: word after "in", "at", "near", "from" that starts with uppercase
    out = out.replace(/\b(in|at|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, (_, prep, loc) => {
      const key = `LOCATION_${++locationCount}`;
      slotRegistry.set(key, key);
      return `${prep} {{${key}}}`;
    });

    // Proper nouns — sequences of Title-Case words NOT after a period/start
    out = out.replace(/(?<=[a-z,;]\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/g, (match) => {
      if (!subjectUsed) {
        subjectUsed = true;
        const key = "SUBJECT";
        slotRegistry.set(key, key);
        return `{{${key}}}`;
      }
      // Subsequent proper nouns → CONCEPT slots
      const existing = [...slotRegistry.entries()].find(([, v]) => v === `CONCEPT_${match}`);
      if (existing) return `{{${existing[0]}}}`;
      const key = `CONCEPT_${++conceptCount}`;
      slotRegistry.set(key, match);
      return `{{${key}}}`;
    });

    return out;
  });

  return { templates, slots: [...slotRegistry.keys()] };
}

// ═══════════════════════════════════════════════════════════════════
// STRUCTURAL CUE
// ═══════════════════════════════════════════════════════════════════

function structuralCue(phase: NarrativePhase, sentences: string[]): string {
  const text  = sentences.join(" ").toLowerCase();
  const first = sentences[0]?.toLowerCase() ?? "";

  if (phase === "HOOK") {
    if (first.startsWith("what if") || first.startsWith("imagine")) return "open-with-hypothetical";
    if (first.includes("?"))  return "open-with-question";
    if (sentences.length < 3) return "cold-open";
    return "statement-hook";
  }
  if (phase === "CONTEXT") {
    if (text.includes("history") || text.includes("back in")) return "historical-context";
    if (text.includes("because") || text.includes("the reason")) return "explanatory-context";
    return "scene-setting";
  }
  if (phase === "TENSION") {
    if (text.includes("but") || text.includes("however")) return "contrast-tension";
    if (text.includes("suddenly") || text.includes("plot twist")) return "revelation-tension";
    return "escalation";
  }
  if (phase === "RESOLUTION") {
    if (text.includes("lesson") || text.includes("takeaway")) return "lesson-close";
    if (text.includes("now") || text.includes("today")) return "present-state-close";
    return "payoff-close";
  }
  return "generic";
}

// ═══════════════════════════════════════════════════════════════════
// DOMINANT PACING
// ═══════════════════════════════════════════════════════════════════

function dominantPacing(beats: TimelineBeat[]): PacingLabel {
  const counts: Record<PacingLabel, number> = { fast: 0, medium: 0, slow: 0, punchy: 0 };
  for (const b of beats) counts[b.pacing]++;
  return (Object.entries(counts) as [PacingLabel, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
}

// ═══════════════════════════════════════════════════════════════════
// FINGERPRINT
// ═══════════════════════════════════════════════════════════════════

function buildFingerprint(beats: SkeletonBeat[]): string {
  return beats.map((b) => `${b.phase[0]}:${b.pacing}`).join("|");
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: STRUCTURAL MINER
// ═══════════════════════════════════════════════════════════════════

export interface MinerResult {
  timeline: NarrativeTimeline;
  skeleton: SkeletonJSON;
  /** Raw extracted text (after fetch + HTML strip if URL mode) */
  rawText:  string;
}

/**
 * Mine a URL or transcript for its narrative structure.
 *
 * @param input  Source (URL or raw transcript) + mode flag
 * @returns      Timeline, topic-agnostic SkeletonJSON, and raw text
 */
export async function mineStructure(input: MinerInput): Promise<MinerResult> {
  // ── 1. Acquire text ─────────────────────────────────────────────
  let rawText: string;
  if (input.mode === "url") {
    rawText = await fetchText(input.source, input.fetchTimeoutMs ?? 10_000);
  } else {
    rawText = input.source.trim();
  }

  if (rawText.length < 50) {
    throw new Error("mineStructure: source text is too short (< 50 chars) to analyse.");
  }

  // ── 2. Segment into sentences ───────────────────────────────────
  const sentences    = splitSentences(rawText);
  const totalWords   = words(rawText).length;
  const totalSents   = sentences.length;

  // ── 3. Group sentences into beats ──────────────────────────────
  // Target ~4–8 beats regardless of source length
  const targetBeats  = Math.min(8, Math.max(4, Math.round(totalSents / 5)));
  const beatSize     = Math.max(2, Math.round(totalSents / targetBeats));
  const beatGroups   = segmentBeats(sentences, beatSize);

  // ── 4. Compute per-beat metrics ─────────────────────────────────
  const energies     = beatGroups.map(computeEnergy);
  const phases       = assignPhases(beatGroups, energies);

  // ── 5. Build TimelineBeat objects ──────────────────────────────
  let charCursor = 0;
  const timelineBeats: TimelineBeat[] = beatGroups.map((sents, i) => {
    const text   = sents.join(" ");
    const energy = energies[i];
    const avgWps = avgWordsPerSentence(sents);
    const phase  = phases[i];
    const sigs   = detectSignalKeywords(text);
    const allSigs: string[] = Object.values(sigs).flat();
    const pacing = energyToPacing(energy, avgWps);

    const charStart = charCursor;
    charCursor     += text.length + 1;

    return {
      index:               i,
      phase,
      sentences:           sents,
      text,
      avgWordsPerSentence: avgWps,
      lexicalDensity:      lexicalDensity(text),
      energy,
      pacing,
      signalKeywords:      allSigs,
      charStart,
      charEnd:             charCursor,
    };
  });

  // ── 6. Build NarrativeTimeline ──────────────────────────────────
  const readTimeSecs = Math.round((totalWords / 150) * 60);
  const domPacing    = dominantPacing(timelineBeats);

  const timeline: NarrativeTimeline = {
    beats:                 timelineBeats,
    totalBeats:            timelineBeats.length,
    totalSentences:        totalSents,
    totalWords,
    dominantPacing:        domPacing,
    estimatedReadTimeSecs: readTimeSecs,
  };

  // ── 7. Build SkeletonJSON ───────────────────────────────────────
  const allSlotKeys  = new Set<string>();
  const skeletonBeats: SkeletonBeat[] = timelineBeats.map((beat) => {
    const { templates, slots } = anonymise(beat.sentences, beat.index);
    for (const s of slots) allSlotKeys.add(s);
    return {
      index:               beat.index,
      phase:               beat.phase,
      pacing:              beat.pacing,
      energy:              beat.energy,
      sentenceCount:       beat.sentences.length,
      avgWordsPerSentence: beat.avgWordsPerSentence,
      templates,
      slots,
      structuralCue:       structuralCue(beat.phase, beat.sentences),
    };
  });

  const skeleton: SkeletonJSON = {
    version:               "1.0.0",
    extractedAt:           new Date().toISOString(),
    sourceTitle:           input.title ?? (input.mode === "url" ? input.source : "Untitled Transcript"),
    sourceMode:            input.mode,
    wordCount:             totalWords,
    estimatedReadTimeSecs: readTimeSecs,
    dominantPacing:        domPacing,
    beats:                 skeletonBeats,
    allSlots:              [...allSlotKeys],
    fingerprint:           buildFingerprint(skeletonBeats),
  };

  return { timeline, skeleton, rawText };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Format the timeline as a compact beat-by-beat summary */
export function formatTimeline(timeline: NarrativeTimeline): string {
  const lines: string[] = [
    `Timeline — ${timeline.totalBeats} beats | ${timeline.totalWords} words | ~${Math.round(timeline.estimatedReadTimeSecs / 60)}m read | dominant pacing: ${timeline.dominantPacing}`,
  ];
  for (const b of timeline.beats) {
    lines.push(
      `  [${b.index}] ${b.phase.padEnd(10)} | pacing:${b.pacing.padEnd(6)} | energy:${b.energy.toFixed(2)} | sents:${b.sentences.length}` +
      (b.signalKeywords.length ? ` | signals: ${b.signalKeywords.slice(0, 3).join(", ")}` : "")
    );
  }
  return lines.join("\n");
}

/** Serialise a SkeletonJSON for storage or transmission */
export function serialiseSkeleton(skeleton: SkeletonJSON): string {
  return JSON.stringify(skeleton, null, 2);
}

/** Parse a previously serialised SkeletonJSON string */
export function parseSkeleton(raw: string): SkeletonJSON {
  return JSON.parse(raw) as SkeletonJSON;
}

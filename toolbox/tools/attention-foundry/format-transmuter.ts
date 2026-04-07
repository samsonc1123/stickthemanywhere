/**
 * toolbox/tools/attention-foundry/format-transmuter.ts
 * version: 1.0.0
 *
 * Pillar 19: Format Extraction Engine
 * Domains: MARKETPLACE-INFRASTRUCTURE | Attention-Sovereignty
 *
 * Takes a SkeletonJSON (from structural-miner.ts) and a Target Topic
 * and generates a full content script that matches the high-retention
 * pacing, rhythm, and structural fingerprint of the original source.
 *
 * The transmuter:
 *   1. Maps each skeleton slot (SUBJECT, CONCEPT_N, etc.) to a
 *      topic-specific term drawn from the TargetTopic definition
 *   2. Renders each skeleton beat using its structural cue and pacing
 *      label to choose the correct sentence pattern from a built-in
 *      pattern library
 *   3. Assembles the beats into a full ContentScript with per-beat
 *      metadata preserved for downstream editors or TTS systems
 *
 * Built-in target topic presets:
 *   gematria | bio-audit | redesign-ai | yod-coin | yellow-pages
 *   (extendable via TargetTopic interface)
 *
 * Pure TypeScript — no external dependencies.
 */

import type { SkeletonJSON, SkeletonBeat, NarrativePhase, PacingLabel } from "./structural-miner.ts";

// ═══════════════════════════════════════════════════════════════════
// TYPES — TARGET TOPIC
// ═══════════════════════════════════════════════════════════════════

export interface TargetTopic {
  /** Display name, e.g. "Gematria" */
  name:         string;
  /** The main entity/subject of this topic */
  subject:      string;
  /** Primary concept terms (mapped to CONCEPT_1, CONCEPT_2 …) */
  concepts:     string[];
  /** Domain-specific verbs (used in sentence patterns) */
  verbs:        string[];
  /** Domain-specific adjectives */
  adjectives:   string[];
  /** Specific facts / stats / numbers relevant to this topic */
  numbers:      string[];
  /** Time references relevant to this topic */
  dates:        string[];
  /** Location references relevant to this topic */
  locations:    string[];
  /** One-sentence hook/thesis for the topic */
  thesis:       string;
  /** Closing call-to-action */
  callToAction: string;
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN TOPIC PRESETS
// ═══════════════════════════════════════════════════════════════════

export const TOPIC_PRESETS: Record<string, TargetTopic> = {
  gematria: {
    name:         "Gematria",
    subject:      "Gematria",
    concepts:     ["numerical value", "letter cipher", "Sovereign Mainframe", "resonance score", "harmonic frequency", "word-number map"],
    verbs:        ["encodes", "reveals", "synchronises", "maps", "decodes", "resonates"],
    adjectives:   ["encoded", "sovereign", "harmonic", "cryptic", "precise", "hidden"],
    numbers:      ["432", "72", "26", "888", "666", "137"],
    dates:        ["ancient times", "the 12th century", "1775", "modern day"],
    locations:    ["the Kabbalah", "ancient Greece", "Jerusalem", "the Sovereign Mainframe"],
    thesis:       "Every word carries a numerical signature — and Gematria is the key to decoding it.",
    callToAction: "Run your first Gematria score and see what the numbers are telling you.",
  },

  "bio-audit": {
    name:         "Bio-Audit",
    subject:      "the Biological Audit",
    concepts:     ["parasite load", "terrain mapping", "detox protocol", "lymph flow", "biofilm", "microbiome signal"],
    verbs:        ["detects", "maps", "flushes", "reveals", "resets", "tracks"],
    adjectives:   ["biological", "parasitic", "systemic", "suppressed", "terrain-level", "sovereign"],
    numbers:      ["72 hours", "30 days", "3 cycles", "pH 7.4", "99%", "21 days"],
    dates:        ["the industrial age", "post-1950", "the last decade", "week one"],
    locations:    ["the gut", "the lymph system", "the liver", "the bloodstream"],
    thesis:       "Most chronic symptoms trace back to terrain — and the Bio-Audit maps every inch of it.",
    callToAction: "Start your terrain audit and find out what your body has been hiding.",
  },

  "redesign-ai": {
    name:         "Redesign-AI",
    subject:      "Redesign-AI",
    concepts:     ["3D scene graph", "semantic tag", "vision-to-geometry", "primitive mapping", "spatial layout", "rendering pipeline"],
    verbs:        ["converts", "renders", "maps", "reconstructs", "analyses", "generates"],
    adjectives:   ["visual", "spatial", "semantic", "generative", "3D", "synthetic"],
    numbers:      ["30+", "5 primitives", "128-bit", "60fps", "4K", "real-time"],
    dates:        ["this quarter", "the last build", "version 2.0", "release day"],
    locations:    ["the scene graph", "the render pipeline", "the canvas", "the Sovereign Mainframe"],
    thesis:       "A single 2D image contains a complete 3D world — Redesign-AI extracts it.",
    callToAction: "Upload your first image and watch Redesign-AI build the scene in three dimensions.",
  },

  "yod-coin": {
    name:         "Yod Coin",
    subject:      "Yod Coin",
    concepts:     ["sovereign ledger", "cryptographic proof", "on-chain audit", "staking vault", "liquidity pool", "wallet sovereignty"],
    verbs:        ["mints", "verifies", "locks", "distributes", "audits", "compounds"],
    adjectives:   ["sovereign", "on-chain", "immutable", "trustless", "cryptographic", "liquid"],
    numbers:      ["21 million", "10%", "72 hours", "block 0", "1:1", "$299"],
    dates:        ["genesis block", "Q1 2026", "mainnet launch", "epoch one"],
    locations:    ["the vault", "the chain", "the Sovereign Mainframe", "the public ledger"],
    thesis:       "The Sovereign Ledger is not a bank — it is a proof-of-work for your autonomy.",
    callToAction: "Claim your first Yod Coin and register your sovereignty on the chain.",
  },

  "yellow-pages": {
    name:         "Yellow Pages Automation",
    subject:      "the Yellow Pages pipeline",
    concepts:     ["business score", "lead extraction", "outreach cadence", "CTA density", "conversion funnel", "territory map"],
    verbs:        ["scores", "qualifies", "extracts", "targets", "automates", "converts"],
    adjectives:   ["automated", "qualified", "high-intent", "local", "data-driven", "targeted"],
    numbers:      ["10 000 leads", "72%", "3-touch", "48 hours", "$0.003 per lead", "97%"],
    dates:        ["this week", "Q2 2026", "day one", "the first sprint"],
    locations:    ["the directory", "your territory", "the pipeline", "the CRM"],
    thesis:       "Every business listing is a qualified lead — the pipeline finds the ones ready to buy.",
    callToAction: "Run your first territory sweep and pull your first 1 000 qualified leads today.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// SLOT RESOLVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a slot → value map from the topic definition.
 * Falls back gracefully when the topic has fewer items than slots.
 */
function buildSlotMap(topic: TargetTopic, allSlots: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let conceptIdx  = 0;
  let numberIdx   = 0;
  let dateIdx     = 0;
  let locationIdx = 0;

  for (const slot of allSlots) {
    if (slot === "SUBJECT") {
      map.set("SUBJECT", topic.subject);
    } else if (slot.startsWith("CONCEPT_")) {
      map.set(slot, topic.concepts[conceptIdx % topic.concepts.length]);
      conceptIdx++;
    } else if (slot.startsWith("NUMBER_")) {
      map.set(slot, topic.numbers[numberIdx % topic.numbers.length]);
      numberIdx++;
    } else if (slot.startsWith("DATE_")) {
      map.set(slot, topic.dates[dateIdx % topic.dates.length]);
      dateIdx++;
    } else if (slot.startsWith("LOCATION_")) {
      map.set(slot, topic.locations[locationIdx % topic.locations.length]);
      locationIdx++;
    } else {
      map.set(slot, topic.subject);
    }
  }
  return map;
}

/**
 * Fill slot placeholders in a template string using the slot map.
 */
function fillSlots(template: string, slotMap: Map<string, string>): string {
  return template.replace(/\{\{([A-Z_0-9]+)\}\}/g, (_, key) => slotMap.get(key) ?? `[${key}]`);
}

// ═══════════════════════════════════════════════════════════════════
// SENTENCE PATTERN LIBRARY
// ═══════════════════════════════════════════════════════════════════

/**
 * Each pattern is a function that takes topic terms and returns
 * a complete sentence.  Patterns are selected by phase + structural cue.
 */
type PatternFn = (topic: TargetTopic, slot: string) => string;

const PATTERNS: Record<NarrativePhase, Record<string, PatternFn[]>> = {
  HOOK: {
    "open-with-hypothetical": [
      (t, s) => `What if ${t.subject} could ${t.verbs[0]} something most people will never see?`,
      (t, s) => `Imagine having ${t.adjectives[0]} access to ${s} — and knowing exactly what it means.`,
      (t, s) => `What if the ${t.adjectives[1]} truth about ${t.subject} was hiding in plain sight?`,
    ],
    "open-with-question": [
      (t, s) => `Have you ever wondered why ${t.subject} ${t.verbs[0]} what it does?`,
      (t, s) => `What does ${s} actually tell you — and why does almost nobody know?`,
      (t, s) => `Why does ${t.subject} keep showing up in the most ${t.adjectives[0]} places?`,
    ],
    "cold-open": [
      (t, s) => `${t.subject} changed everything. Here is what they don't tell you.`,
      (t, s) => `${s}. That's it. That's the whole secret.`,
    ],
    "statement-hook": [
      (t, s) => `Nobody talks about what ${t.subject} actually ${t.verbs[0]}.`,
      (t, s) => `The truth about ${s} is stranger — and more powerful — than you think.`,
      (t, s) => `Most people have heard of ${t.subject}. Almost none of them understand it.`,
    ],
  },
  CONTEXT: {
    "historical-context": [
      (t, s) => `${t.subject} has existed since ${t.dates[0]}, when early practitioners first noticed how it ${t.verbs[1]} patterns across ${t.locations[0]}.`,
      (t, s) => `Long before modern systems, ${s} was already ${t.verbs[0]}ing data that conventional methods couldn't reach.`,
    ],
    "explanatory-context": [
      (t, s) => `Here is the core mechanic: ${t.subject} ${t.verbs[0]} every ${t.concepts[0]} against a reference map drawn from ${t.locations[1]}.`,
      (t, s) => `The reason ${t.subject} works is simple — it treats ${t.concepts[1]} as a first-class signal, not background noise.`,
      (t, s) => `${s} doesn't guess. It uses ${t.concepts[2]} to produce a score with ${t.numbers[0]} precision.`,
    ],
    "scene-setting": [
      (t, s) => `Think of ${t.subject} as a ${t.adjectives[0]} instrument — precise, ${t.adjectives[2]}, and built for ${t.locations[0]}.`,
      (t, s) => `The world ${t.subject} operates in is made of ${t.concepts[0]} and ${t.concepts[3]} — invisible to most observers.`,
    ],
  },
  TENSION: {
    "contrast-tension": [
      (t, s) => `But here is the problem: most implementations of ${t.subject} stop at the surface and never ${t.verbs[0]} the ${t.concepts[1]} beneath.`,
      (t, s) => `The challenge is that ${s} produces data that standard tools simply weren't built to handle.`,
      (t, s) => `However, getting ${t.subject} to ${t.verbs[2]} correctly requires confronting a pattern that ${t.adjectives[3]} systems consistently miss.`,
    ],
    "revelation-tension": [
      (t, s) => `Then came the discovery: ${t.subject} wasn't just ${t.verbs[0]}ing — it was predicting ${t.concepts[0]} shifts ${t.numbers[1]} before they surfaced.`,
      (t, s) => `The plot twist: the ${t.adjectives[4]} signal was already inside ${t.locations[2]} the entire time.`,
    ],
    "escalation": [
      (t, s) => `Every day that ${t.subject} goes unmeasured, the gap between what you know and what is actually happening in ${t.locations[0]} widens.`,
      (t, s) => `The stakes are ${t.adjectives[0]}: without ${s}, ${t.concepts[3]} accumulates silently until the system can no longer hold.`,
      (t, s) => `${t.subject} doesn't wait. It ${t.verbs[0]}s continuously — and the window to act is narrower than most people realise.`,
    ],
  },
  RESOLUTION: {
    "lesson-close": [
      (t, s) => `The lesson: ${t.subject} is not a tool for the few — it is a ${t.adjectives[0]} system that scales to anyone willing to run it.`,
      (t, s) => `What this proves is that ${s} ${t.verbs[3]}s in direct proportion to the clarity of your intent.`,
    ],
    "present-state-close": [
      (t, s) => `Today, ${t.subject} ${t.verbs[0]}s ${t.numbers[0]} data points in real time — and the gap between early adopters and everyone else is growing.`,
      (t, s) => `Right now, ${s} is available to anyone with the discipline to run it through ${t.locations[3]}.`,
    ],
    "payoff-close": [
      (t, s) => `${t.thesis}`,
      (t, s) => `The payoff is ${t.adjectives[2]}: ${t.subject} ${t.verbs[0]}s what took years to understand — in seconds.`,
      (t, s) => `${t.callToAction}`,
    ],
  },
};

function pickPattern(
  phase:         NarrativePhase,
  structuralCue: string,
  index:         number
): PatternFn {
  const phasePatterns = PATTERNS[phase];
  const cuePatterns   = phasePatterns[structuralCue] ?? Object.values(phasePatterns)[0] ?? [];
  const fallback: PatternFn = (t, s) => `${t.subject} ${t.verbs[0]} ${s}.`;
  if (!cuePatterns.length) return fallback;
  return cuePatterns[index % cuePatterns.length];
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — CONTENT SCRIPT OUTPUT
// ═══════════════════════════════════════════════════════════════════

export interface ScriptBeat {
  index:         number;
  phase:         NarrativePhase;
  pacing:        PacingLabel;
  energy:        number;
  /** Generated sentences for this beat */
  lines:         string[];
  /** Concatenated beat text */
  text:          string;
  structuralCue: string;
  /** Approximate word count */
  wordCount:     number;
}

export interface ContentScript {
  /** Target topic name */
  topic:                string;
  /** Structural fingerprint from the source skeleton */
  fingerprint:          string;
  /** ISO timestamp */
  generatedAt:          string;
  beats:                ScriptBeat[];
  /** Full script as a single string (beats separated by double newline) */
  fullText:             string;
  /** Total word count */
  totalWords:           number;
  /** Estimated read time in seconds at 150 wpm aloud */
  estimatedReadTimeSecs: number;
  /** The thesis sentence of the topic */
  thesis:               string;
  /** The call-to-action */
  callToAction:         string;
}

// ═══════════════════════════════════════════════════════════════════
// TRANSMUTER OPTIONS
// ═══════════════════════════════════════════════════════════════════

export interface TransmuterOptions {
  /**
   * If true, also include slot-filled versions of the original skeleton
   * templates alongside the generated pattern lines.
   * Default: false
   */
  blendOriginalTemplates?: boolean;
  /**
   * If true, append the topic callToAction as a final standalone beat.
   * Default: true
   */
  appendCta?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: FORMAT TRANSMUTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Transmute a SkeletonJSON into a new ContentScript for a given TargetTopic.
 *
 * @param skeleton  Output of structural-miner.ts `mineStructure()`
 * @param topic     Target topic definition (preset string or full TargetTopic object)
 * @param opts      Transmuter options
 */
export function transmuteFormat(
  skeleton: SkeletonJSON,
  topic:    string | TargetTopic,
  opts:     TransmuterOptions = {}
): ContentScript {
  const blendTemplates = opts.blendOriginalTemplates ?? false;
  const appendCta      = opts.appendCta              ?? true;

  // Resolve topic
  const topicDef: TargetTopic = typeof topic === "string"
    ? TOPIC_PRESETS[topic.toLowerCase().replace(/\s+/g, "-")]
      ?? (() => { throw new Error(`transmuteFormat: unknown topic preset '${topic}'.  Available: ${Object.keys(TOPIC_PRESETS).join(", ")}`); })()
    : topic;

  // Build slot → value map from skeleton's allSlots
  const slotMap = buildSlotMap(topicDef, skeleton.allSlots);

  // Transmute each beat
  const scriptBeats: ScriptBeat[] = skeleton.beats.map((beat: SkeletonBeat) => {
    const lines: string[] = [];

    // ── Generated pattern lines ──────────────────────────────────
    const sentenceCount = Math.max(1, beat.sentenceCount);
    for (let i = 0; i < sentenceCount; i++) {
      const patternFn  = pickPattern(beat.phase, beat.structuralCue, i);
      const slotSubject = slotMap.get("SUBJECT") ?? topicDef.subject;
      const generated  = patternFn(topicDef, slotSubject);
      lines.push(generated);
    }

    // ── Optional: blend slot-filled original templates ───────────
    if (blendTemplates && beat.templates.length) {
      for (const tpl of beat.templates) {
        const filled = fillSlots(tpl, slotMap);
        if (filled && !lines.includes(filled)) lines.push(filled);
      }
    }

    const text      = lines.join(" ");
    const wordCount = (text.match(/\b\w+\b/g) ?? []).length;

    return {
      index:         beat.index,
      phase:         beat.phase,
      pacing:        beat.pacing,
      energy:        beat.energy,
      lines,
      text,
      structuralCue: beat.structuralCue,
      wordCount,
    };
  });

  // ── Optional: CTA beat ────────────────────────────────────────
  if (appendCta) {
    scriptBeats.push({
      index:         scriptBeats.length,
      phase:         "RESOLUTION",
      pacing:        "punchy",
      energy:        0.9,
      lines:         [topicDef.callToAction],
      text:          topicDef.callToAction,
      structuralCue: "payoff-close",
      wordCount:     (topicDef.callToAction.match(/\b\w+\b/g) ?? []).length,
    });
  }

  const fullText    = scriptBeats.map((b) => b.text).join("\n\n");
  const totalWords  = scriptBeats.reduce((s, b) => s + b.wordCount, 0);

  return {
    topic:                 topicDef.name,
    fingerprint:           skeleton.fingerprint,
    generatedAt:           new Date().toISOString(),
    beats:                 scriptBeats,
    fullText,
    totalWords,
    estimatedReadTimeSecs: Math.round((totalWords / 150) * 60),
    thesis:                topicDef.thesis,
    callToAction:          topicDef.callToAction,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS — MULTI-TOPIC BATCH
// ═══════════════════════════════════════════════════════════════════

/**
 * Transmute a single skeleton into multiple topic variants simultaneously.
 * Returns a map of topicName → ContentScript.
 */
export function transmuteMultiTopic(
  skeleton: SkeletonJSON,
  topics:   Array<string | TargetTopic>,
  opts?:    TransmuterOptions
): Map<string, ContentScript> {
  const results = new Map<string, ContentScript>();
  for (const topic of topics) {
    const script = transmuteFormat(skeleton, topic, opts);
    results.set(script.topic, script);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a ContentScript as a teleprompter-ready plain-text script.
 * Each beat is preceded by a phase/pacing header.
 */
export function formatTeleprompterScript(script: ContentScript): string {
  const header = [
    `═══════════════════════════════════════`,
    `TOPIC:    ${script.topic}`,
    `THESIS:   ${script.thesis}`,
    `WORDS:    ${script.totalWords}  |  READ TIME: ~${Math.round(script.estimatedReadTimeSecs / 60)}m`,
    `PACING:   ${script.fingerprint}`,
    `═══════════════════════════════════════`,
    "",
  ].join("\n");

  const beatBlocks = script.beats.map((b) => {
    const tag = `[${b.phase} | ${b.pacing.toUpperCase()} | energy:${b.energy.toFixed(2)}]`;
    return `${tag}\n${b.lines.join("\n")}`;
  });

  return header + beatBlocks.join("\n\n");
}

/**
 * Export a ContentScript as a structured JSON string.
 */
export function exportScriptJSON(script: ContentScript): string {
  return JSON.stringify(script, null, 2);
}

/**
 * List all available built-in topic preset keys.
 */
export function listTopicPresets(): string[] {
  return Object.keys(TOPIC_PRESETS);
}

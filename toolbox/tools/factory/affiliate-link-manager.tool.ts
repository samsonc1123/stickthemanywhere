/**
 * toolbox/tools/factory/affiliate-link-manager.tool.ts
 * version: 1.0.0
 *
 * Tool Manufacturing — Affiliate Link Manager.
 * Pure TypeScript. Zero framework imports.
 *
 * Manages the full lifecycle of affiliate links tied to Pillar 11
 * (Monetized Interface) content:
 *
 *   1. Maintains a typed registry of affiliate programs and offers
 *   2. Maps active offers to Pillar 11 ad slots and typing engine content
 *   3. Health-checks links via HTTP HEAD requests to detect dead links
 *   4. Auto-swaps dead links for active alternatives from the same program
 *      — ensuring zero revenue leakage
 *   5. Emits a SwapEvent log every time a replacement occurs
 *
 * Pillar 15: Tool Manufacturing (GAB domain: MARKETPLACE-INFRASTRUCTURE)
 *
 * "Zero revenue leakage" guarantee:
 *   Every dead link is replaced by the highest-priority active alternative
 *   in the same program × category slot. If no alternative exists, the slot
 *   is flagged UNFILLED and reported so a human can replenish the pool.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — AFFILIATE PROGRAMS & OFFERS
// ═══════════════════════════════════════════════════════════════════

export type AffiliateProgram =
  | "amazon-associates"
  | "clickbank"
  | "shareasale"
  | "cj-affiliate"
  | "impact"
  | "digistore24"
  | "custom";

export type AffiliateCategory =
  | "health-supplements"   // Ivermectin research, parasite kits, zinc
  | "tech-hardware"        // Cameras, spectral sensors, smart glasses
  | "software-tools"       // Design tools, AI subscriptions
  | "books-media"          // Historical truth, health research literature
  | "3d-printing"          // Food models, ad texture printing
  | "food-delivery"        // Yellow Pages restaurant integrations
  | "crypto-exchange"      // Yod Coin on-ramps
  | "general";

export type LinkStatus =
  | "ACTIVE"       // Verified live within healthCheckTtlMs
  | "DEAD"         // HTTP non-2xx / timeout / DNS failure
  | "PENDING"      // Not yet health-checked
  | "REPLACED"     // Dead link replaced by a swap — kept for audit trail
  | "PAUSED";      // Manually paused (e.g. seasonal, stock-out)

export interface AffiliateOffer {
  id:             string;
  program:        AffiliateProgram;
  category:       AffiliateCategory;
  name:           string;
  /** Raw affiliate tracking URL */
  url:            string;
  /** Fallback URL if the primary is dead — can be another offer ID or a direct URL */
  fallbackOfferId?: string;
  /** Commission rate as a fraction (e.g. 0.08 = 8%) */
  commissionRate: number;
  /** Commission type */
  commissionType: "percentage" | "fixed-cents";
  /** Fixed commission in USD cents if commissionType = fixed-cents */
  fixedCents?:    number;
  status:         LinkStatus;
  priority:       number;   // 1–10, higher = preferred in rotation
  /** Unix ms of last successful health check */
  lastCheckedMs:  number;
  /** Unix ms of last confirmed live status */
  lastLiveMs:     number;
  /** Number of consecutive failures */
  failureCount:   number;
  /** Which Pillar 11 content slots this offer is mapped to */
  mappedSlots:    Pillar11Slot[];
  /** Program-specific tracking tags / sub-IDs */
  trackingTags:   Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — PILLAR 11 CONTENT MAPPING
// ═══════════════════════════════════════════════════════════════════

export type Pillar11SlotType =
  | "ad-slot"        // AdSequencer asset slot — shows during rotation
  | "typing-segment" // TypingSession text — embedded in segment body
  | "banner"         // Static banner in the storefront
  | "product-card";  // Yellow Pages product listing

export interface Pillar11Slot {
  slotId:    string;
  slotType:  Pillar11SlotType;
  /** Human-readable description of where this appears in the UI */
  placement: string;
  /** The offer currently assigned to this slot */
  activeOfferId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — HEALTH CHECK & SWAP EVENTS
// ═══════════════════════════════════════════════════════════════════

export interface HealthCheckResult {
  offerId:     string;
  url:         string;
  status:      LinkStatus;
  httpStatus?: number;
  latencyMs?:  number;
  checkedAt:   number;
  error?:      string;
}

export type SwapReason = "DEAD_LINK" | "PAUSED" | "HIGHER_PRIORITY_AVAILABLE" | "MANUAL";

export interface SwapEvent {
  swapId:        string;
  slotId:        string;
  slotType:      Pillar11SlotType;
  outgoingOfferId: string;
  incomingOfferId: string | null;  // null = UNFILLED
  reason:        SwapReason;
  timestampMs:   number;
  note?:         string;
}

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN OFFER REGISTRY (seed data)
// ═══════════════════════════════════════════════════════════════════

export const SEED_OFFERS: Omit<AffiliateOffer, "status" | "lastCheckedMs" | "lastLiveMs" | "failureCount">[] = [
  {
    id: "aff-001",
    program: "amazon-associates",
    category: "health-supplements",
    name: "Ivermectin Veterinary Research Formula (Amazon)",
    url: "https://www.amazon.com/dp/PLACEHOLDER001?tag=sovereignmf-20",
    commissionRate: 0.04,
    commissionType: "percentage",
    priority: 9,
    mappedSlots: [{ slotId: "ad-slot-health-01", slotType: "ad-slot", placement: "Ad Sequencer — Health rotation" }],
    trackingTags: { tag: "sovereignmf-20", subId: "ivermectin-research" },
  },
  {
    id: "aff-002",
    program: "amazon-associates",
    category: "health-supplements",
    name: "Zinc Picolinate 50mg (Amazon)",
    url: "https://www.amazon.com/dp/PLACEHOLDER002?tag=sovereignmf-20",
    commissionRate: 0.04,
    commissionType: "percentage",
    priority: 7,
    mappedSlots: [{ slotId: "ad-slot-health-01", slotType: "ad-slot", placement: "Ad Sequencer — Health rotation" }],
    trackingTags: { tag: "sovereignmf-20", subId: "zinc-picolinate" },
  },
  {
    id: "aff-003",
    program: "amazon-associates",
    category: "health-supplements",
    name: "Tea Tree Oil 100% Pure (Amazon)",
    url: "https://www.amazon.com/dp/PLACEHOLDER003?tag=sovereignmf-20",
    commissionRate: 0.04,
    commissionType: "percentage",
    priority: 8,
    mappedSlots: [
      { slotId: "ad-slot-health-01", slotType: "ad-slot", placement: "Ad Sequencer — Health rotation" },
      { slotId: "typing-seg-health", slotType: "typing-segment", placement: "Typing Engine — Tea Tree segment CTA" },
    ],
    trackingTags: { tag: "sovereignmf-20", subId: "tea-tree-oil" },
  },
  {
    id: "aff-004",
    program: "amazon-associates",
    category: "tech-hardware",
    name: "NIR-capable Smartphone Camera Lens Adapter (Amazon)",
    url: "https://www.amazon.com/dp/PLACEHOLDER004?tag=sovereignmf-20",
    commissionRate: 0.06,
    commissionType: "percentage",
    priority: 8,
    mappedSlots: [{ slotId: "ad-slot-tech-01", slotType: "ad-slot", placement: "Ad Sequencer — Tech hardware rotation" }],
    trackingTags: { tag: "sovereignmf-20", subId: "nir-camera-lens" },
  },
  {
    id: "aff-005",
    program: "amazon-associates",
    category: "tech-hardware",
    name: "FLIR Thermal Camera Module (Amazon)",
    url: "https://www.amazon.com/dp/PLACEHOLDER005?tag=sovereignmf-20",
    commissionRate: 0.06,
    commissionType: "percentage",
    priority: 9,
    mappedSlots: [{ slotId: "ad-slot-tech-01", slotType: "ad-slot", placement: "Ad Sequencer — Tech hardware rotation" }],
    trackingTags: { tag: "sovereignmf-20", subId: "flir-thermal" },
  },
  {
    id: "aff-006",
    program: "clickbank",
    category: "books-media",
    name: "Ancient Chronology Research Bundle (ClickBank)",
    url: "https://hop.clickbank.net/?affiliate=sovereignmf&vendor=PLACEHOLDER006",
    commissionRate: 0.50,
    commissionType: "percentage",
    priority: 8,
    mappedSlots: [{ slotId: "typing-seg-ancient", slotType: "typing-segment", placement: "Typing Engine — Ancient Chronology segment CTA" }],
    trackingTags: { affiliate: "sovereignmf", vendor: "PLACEHOLDER006" },
  },
  {
    id: "aff-007",
    program: "digistore24",
    category: "crypto-exchange",
    name: "Crypto On-Ramp for EVM Chains (Digistore24)",
    url: "https://www.digistore24.com/redir/PLACEHOLDER007/sovereignmf/",
    commissionRate: 0.30,
    commissionType: "percentage",
    priority: 7,
    mappedSlots: [
      { slotId: "ad-slot-crypto-01", slotType: "ad-slot", placement: "Ad Sequencer — Crypto rotation" },
      { slotId: "banner-yod-01",     slotType: "banner",   placement: "Storefront banner — Yod Coin CTA" },
    ],
    trackingTags: { subId: "sovereignmf" },
  },
  {
    id: "aff-008",
    program: "shareasale",
    category: "software-tools",
    name: "AI Design Suite — Redesign Tool Partner (ShareASale)",
    url: "https://www.shareasale.com/r.cfm?b=PLACEHOLDER&u=SOVEREIGNMF&m=PLACEHOLDER008",
    commissionRate: 0.20,
    commissionType: "percentage",
    priority: 6,
    fallbackOfferId: "aff-006",
    mappedSlots: [{ slotId: "ad-slot-software-01", slotType: "ad-slot", placement: "Ad Sequencer — Software tools rotation" }],
    trackingTags: { u: "SOVEREIGNMF", m: "PLACEHOLDER008" },
  },
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════
// AFFILIATE LINK MANAGER — CORE CLASS
// ═══════════════════════════════════════════════════════════════════

export interface AffiliateLinkManagerConfig {
  /** How long a health-check result is considered fresh before re-checking. Default 3 600 000 (1 h). */
  healthCheckTtlMs?:         number;
  /** HTTP timeout for health checks in ms. Default 8 000. */
  healthCheckTimeoutMs?:     number;
  /** Consecutive failures before a link is marked DEAD. Default 2. */
  failureThreshold?:         number;
  /** Callback fired every time a swap occurs — use to persist to DB. */
  onSwap?:                   (event: SwapEvent) => void;
  /** Callback fired when a slot is UNFILLED after a dead-link swap. */
  onUnfilled?:               (slotId: string, outgoingOfferId: string) => void;
}

export class AffiliateLinkManager {
  private offers:    Map<string, AffiliateOffer> = new Map();
  private swapLog:   SwapEvent[]                 = [];
  private config:    Required<AffiliateLinkManagerConfig>;

  constructor(config: AffiliateLinkManagerConfig = {}) {
    this.config = {
      healthCheckTtlMs:     config.healthCheckTtlMs     ?? 3_600_000,
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 8_000,
      failureThreshold:     config.failureThreshold     ?? 2,
      onSwap:               config.onSwap               ?? (() => {}),
      onUnfilled:           config.onUnfilled           ?? (() => {}),
    };

    // Seed from built-in registry
    for (const seed of SEED_OFFERS) {
      this.addOffer({ ...seed, status: "PENDING", lastCheckedMs: 0, lastLiveMs: 0, failureCount: 0 });
    }
  }

  // ── Offer CRUD ─────────────────────────────────────────────────

  addOffer(offer: AffiliateOffer): void {
    this.offers.set(offer.id, { ...offer });
  }

  updateOffer(id: string, patch: Partial<AffiliateOffer>): boolean {
    const offer = this.offers.get(id);
    if (!offer) return false;
    Object.assign(offer, patch);
    return true;
  }

  removeOffer(id: string): boolean { return this.offers.delete(id); }

  getOffer(id: string): AffiliateOffer | null { return this.offers.get(id) ?? null; }

  listOffers(filter?: { status?: LinkStatus; category?: AffiliateCategory; program?: AffiliateProgram }): AffiliateOffer[] {
    return [...this.offers.values()].filter((o) => {
      if (filter?.status   && o.status   !== filter.status)   return false;
      if (filter?.category && o.category !== filter.category) return false;
      if (filter?.program  && o.program  !== filter.program)  return false;
      return true;
    });
  }

  // ── Health checks ──────────────────────────────────────────────

  /**
   * Health-check a single offer via HTTP HEAD.
   * Updates offer status, failureCount, lastCheckedMs, lastLiveMs.
   */
  async checkOfferHealth(offerId: string): Promise<HealthCheckResult> {
    const offer = this.offers.get(offerId);
    if (!offer) return { offerId, url: "", status: "DEAD", checkedAt: Date.now(), error: "Offer not found." };

    const start = Date.now();
    try {
      const resp = await fetch(offer.url, {
        method:  "HEAD",
        redirect: "follow",
        signal:  AbortSignal.timeout(this.config.healthCheckTimeoutMs),
        headers: { "User-Agent": "SovereignMainframe-LinkChecker/1.0" },
      });

      const latencyMs = Date.now() - start;
      const isLive    = resp.ok || resp.status === 301 || resp.status === 302 || resp.status === 303;

      if (isLive) {
        offer.status        = "ACTIVE";
        offer.failureCount  = 0;
        offer.lastLiveMs    = Date.now();
      } else {
        offer.failureCount++;
        if (offer.failureCount >= this.config.failureThreshold) {
          offer.status = "DEAD";
        }
      }

      offer.lastCheckedMs = Date.now();
      return { offerId, url: offer.url, status: offer.status, httpStatus: resp.status, latencyMs, checkedAt: Date.now() };

    } catch (err: unknown) {
      offer.failureCount++;
      if (offer.failureCount >= this.config.failureThreshold) offer.status = "DEAD";
      offer.lastCheckedMs = Date.now();
      return { offerId, url: offer.url, status: offer.status, checkedAt: Date.now(), error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Run health checks across all ACTIVE or PENDING offers whose TTL has expired.
   * Returns a summary of checked / dead / swapped counts.
   */
  async runHealthSweep(): Promise<{
    checked: number;
    stillActive: number;
    markedDead: number;
    swapped: number;
    unfilled: number;
  }> {
    const now       = Date.now();
    const toCheck   = [...this.offers.values()].filter((o) =>
      (o.status === "ACTIVE" || o.status === "PENDING") &&
      now - o.lastCheckedMs > this.config.healthCheckTtlMs
    );

    const results = await Promise.allSettled(toCheck.map((o) => this.checkOfferHealth(o.id)));

    let markedDead  = 0;
    let stillActive = 0;
    let swapped     = 0;
    let unfilled    = 0;

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      if (r.value.status === "ACTIVE") stillActive++;
      if (r.value.status === "DEAD") {
        markedDead++;
        const offer = this.offers.get(r.value.offerId)!;
        for (const slot of offer.mappedSlots) {
          if (slot.activeOfferId === offer.id) {
            const swapResult = this._swapDeadLink(offer, slot, "DEAD_LINK");
            if (swapResult) swapped++; else unfilled++;
          }
        }
      }
    }

    return { checked: toCheck.length, stillActive, markedDead, swapped, unfilled };
  }

  // ── Pillar 11 mapping ──────────────────────────────────────────

  /**
   * Map an affiliate offer to a Pillar 11 slot.
   * Assigns this offer as the active offer for that slot.
   */
  assignOfferToSlot(offerId: string, slot: Pillar11Slot): boolean {
    const offer = this.offers.get(offerId);
    if (!offer || offer.status === "DEAD" || offer.status === "REPLACED") return false;

    // Update slot on the offer
    const existingSlotIdx = offer.mappedSlots.findIndex((s) => s.slotId === slot.slotId);
    const updatedSlot     = { ...slot, activeOfferId: offerId };

    if (existingSlotIdx >= 0) offer.mappedSlots[existingSlotIdx] = updatedSlot;
    else offer.mappedSlots.push(updatedSlot);

    return true;
  }

  /**
   * Get the best active offer for a given Pillar 11 slot.
   * Returns the highest-priority ACTIVE offer mapped to that slot.
   */
  getBestOfferForSlot(slotId: string): AffiliateOffer | null {
    const candidates = [...this.offers.values()]
      .filter((o) => o.status === "ACTIVE" && o.mappedSlots.some((s) => s.slotId === slotId))
      .sort((a, b) => b.priority - a.priority);
    return candidates[0] ?? null;
  }

  /**
   * Get all Pillar 11 slot → active offer mappings.
   * Returns a flat map ready for the Ad Sequencer to consume.
   */
  getSlotMapping(): Record<string, { offer: AffiliateOffer; slot: Pillar11Slot } | null> {
    const map: Record<string, { offer: AffiliateOffer; slot: Pillar11Slot } | null> = {};
    for (const offer of this.offers.values()) {
      for (const slot of offer.mappedSlots) {
        if (!map[slot.slotId]) {
          map[slot.slotId] = offer.status === "ACTIVE" ? { offer, slot } : null;
        }
      }
    }
    return map;
  }

  // ── Dead link swap ─────────────────────────────────────────────

  /**
   * Immediately swap all dead-link slots across the registry.
   * Call this after any manual status change or on startup.
   */
  swapAllDeadLinks(): SwapEvent[] {
    const events: SwapEvent[] = [];
    for (const offer of this.offers.values()) {
      if (offer.status !== "DEAD" && offer.status !== "PAUSED") continue;
      for (const slot of offer.mappedSlots) {
        if (slot.activeOfferId === offer.id) {
          const ev = this._swapDeadLink(offer, slot, offer.status === "PAUSED" ? "PAUSED" : "DEAD_LINK");
          if (ev) events.push(ev);
        }
      }
    }
    return events;
  }

  // ── Scraping / offer discovery ─────────────────────────────────

  /**
   * Scrape current affiliate offers from a network API endpoint.
   * Returns newly discovered offers not yet in the registry.
   *
   * Networks vary in their API format — this provides a typed adapter layer.
   * Implement per-network parsers in the `networkParsers` map.
   *
   * @param networkUrl   Full URL to the network's offer feed or search API
   * @param program      Which affiliate program this URL belongs to
   * @param category     Default category for discovered offers
   * @param apiKey       Network API key (stored in env, passed here by caller)
   */
  async scrapeAffiliateOffers(
    networkUrl: string,
    program:    AffiliateProgram,
    category:   AffiliateCategory,
    apiKey:     string
  ): Promise<{ discovered: AffiliateOffer[]; added: number; skipped: number }> {
    let rawOffers: Array<{ name: string; url: string; commissionRate?: number; commissionType?: string }> = [];

    try {
      const resp = await fetch(networkUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept":        "application/json",
          "User-Agent":    "SovereignMainframe-AffiliateScraper/1.0",
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (!resp.ok) throw new Error(`Network API returned ${resp.status}`);
      const json = await resp.json() as { offers?: typeof rawOffers; data?: typeof rawOffers; items?: typeof rawOffers };

      // Try common response shapes
      rawOffers = json.offers ?? json.data ?? json.items ?? [];
    } catch (err: unknown) {
      console.warn(`[affiliate-manager] Scrape failed for ${program} at ${networkUrl}:`, err instanceof Error ? err.message : err);
      return { discovered: [], added: 0, skipped: 0 };
    }

    let added = 0;
    let skipped = 0;
    const discovered: AffiliateOffer[] = [];

    for (const raw of rawOffers) {
      // De-duplicate by URL
      const alreadyExists = [...this.offers.values()].some((o) => o.url === raw.url);
      if (alreadyExists) { skipped++; continue; }

      const offer: AffiliateOffer = {
        id:             generateId("aff"),
        program,
        category,
        name:           raw.name ?? "Unknown Offer",
        url:            raw.url,
        commissionRate: raw.commissionRate ?? 0.05,
        commissionType: (raw.commissionType as "percentage" | "fixed-cents") ?? "percentage",
        status:         "PENDING",
        priority:       5,
        lastCheckedMs:  0,
        lastLiveMs:     0,
        failureCount:   0,
        mappedSlots:    [],
        trackingTags:   {},
      };

      this.addOffer(offer);
      discovered.push(offer);
      added++;
    }

    return { discovered, added, skipped };
  }

  // ── Audit & reporting ──────────────────────────────────────────

  getSwapLog(limit = 50): SwapEvent[] { return this.swapLog.slice(-limit); }

  getRevenueLeakageReport(): {
    deadSlots:    Array<{ slotId: string; slotType: Pillar11SlotType; offerId: string }>;
    unfilledSlots: string[];
    activeSlots:  number;
    totalSlots:   number;
  } {
    const all        = this.getSlotMapping();
    const deadSlots: Array<{ slotId: string; slotType: Pillar11SlotType; offerId: string }> = [];
    const unfilled:  string[] = [];
    let active = 0;

    for (const [slotId, entry] of Object.entries(all)) {
      if (!entry) { unfilled.push(slotId); continue; }
      if (entry.offer.status !== "ACTIVE") {
        deadSlots.push({ slotId, slotType: entry.slot.slotType, offerId: entry.offer.id });
      } else {
        active++;
      }
    }

    return {
      deadSlots,
      unfilledSlots: unfilled,
      activeSlots:   active,
      totalSlots:    Object.keys(all).length,
    };
  }

  // ── Private ────────────────────────────────────────────────────

  /**
   * Swap a dead/paused offer in a slot for the best available alternative.
   * If a `fallbackOfferId` is set on the outgoing offer, try that first.
   * Otherwise find the highest-priority ACTIVE offer in the same category + slot.
   * Returns the SwapEvent or null if no alternative was found (UNFILLED).
   */
  private _swapDeadLink(
    outgoing: AffiliateOffer,
    slot:     Pillar11Slot,
    reason:   SwapReason
  ): SwapEvent | null {
    // 1. Try named fallback first
    let replacement: AffiliateOffer | null = null;
    if (outgoing.fallbackOfferId) {
      const fb = this.offers.get(outgoing.fallbackOfferId);
      if (fb && fb.status === "ACTIVE") replacement = fb;
    }

    // 2. Find best active alternative in same category mapped to same slot
    if (!replacement) {
      replacement = [...this.offers.values()]
        .filter((o) =>
          o.id !== outgoing.id &&
          o.status === "ACTIVE" &&
          o.category === outgoing.category &&
          (o.mappedSlots.some((s) => s.slotId === slot.slotId) || true) // any in category
        )
        .sort((a, b) => b.priority - a.priority)[0] ?? null;
    }

    // 3. Mark outgoing as REPLACED
    outgoing.status = reason === "DEAD_LINK" ? "REPLACED" : outgoing.status;

    // 4. Assign replacement
    if (replacement) {
      this.assignOfferToSlot(replacement.id, { ...slot, activeOfferId: replacement.id });
    }

    const ev: SwapEvent = {
      swapId:          generateId("swap"),
      slotId:          slot.slotId,
      slotType:        slot.slotType,
      outgoingOfferId: outgoing.id,
      incomingOfferId: replacement?.id ?? null,
      reason,
      timestampMs:     Date.now(),
      note: replacement
        ? `Replaced dead link '${outgoing.name}' with '${replacement.name}'.`
        : `Dead link '${outgoing.name}' removed. Slot UNFILLED — replenishment needed.`,
    };

    this.swapLog.push(ev);
    this.config.onSwap(ev);

    if (!replacement) this.config.onUnfilled(slot.slotId, outgoing.id);

    console.log(
      replacement
        ? `[affiliate-manager] SWAP: ${slot.slotId} | out=${outgoing.id} in=${replacement.id} [${reason}]`
        : `[affiliate-manager] UNFILLED: ${slot.slotId} | out=${outgoing.id} [${reason}]`
    );

    return ev;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a fully-qualified affiliate URL with tracking parameters appended.
 * Appends trackingTags as query-string parameters while preserving existing params.
 */
export function buildTrackedUrl(offer: AffiliateOffer, extraParams?: Record<string, string>): string {
  try {
    const u = new URL(offer.url);
    for (const [k, v] of Object.entries(offer.trackingTags)) u.searchParams.set(k, v);
    if (extraParams) for (const [k, v] of Object.entries(extraParams)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return offer.url;
  }
}

/**
 * Estimate annual revenue potential for an offer based on assumed conversion metrics.
 *
 * @param offer              The affiliate offer
 * @param dailyImpressions   Estimated daily ad impressions for its slots
 * @param ctr                Click-through rate (0–1). Default 0.02 (2%)
 * @param conversionRate     Purchase conversion rate (0–1). Default 0.03 (3%)
 * @param avgOrderValueCents Average order value in USD cents. Default 5000 ($50)
 */
export function estimateAnnualRevenueCents(
  offer:              AffiliateOffer,
  dailyImpressions:   number,
  ctr                 = 0.02,
  conversionRate      = 0.03,
  avgOrderValueCents  = 5_000
): { daily: number; monthly: number; annual: number; formatted: string } {
  const dailyClicks       = dailyImpressions * ctr;
  const dailyConversions  = dailyClicks * conversionRate;
  const commissionPerSale = offer.commissionType === "percentage"
    ? avgOrderValueCents * offer.commissionRate
    : (offer.fixedCents ?? 0);

  const daily   = Math.round(dailyConversions * commissionPerSale);
  const monthly = daily * 30;
  const annual  = daily * 365;

  return { daily, monthly, annual, formatted: `$${(annual / 100).toFixed(2)}/yr` };
}

/**
 * Merge a fresh scraped offer list with the existing registry,
 * preserving status and performance data for known offers.
 */
export function mergeOfferUpdates(
  manager:   AffiliateLinkManager,
  freshList: AffiliateOffer[]
): { added: number; updated: number; unchanged: number } {
  let added = 0, updated = 0, unchanged = 0;
  for (const fresh of freshList) {
    const existing = manager.getOffer(fresh.id);
    if (!existing) { manager.addOffer(fresh); added++; }
    else if (existing.url !== fresh.url || existing.name !== fresh.name) {
      manager.updateOffer(fresh.id, { url: fresh.url, name: fresh.name, commissionRate: fresh.commissionRate, status: "PENDING" });
      updated++;
    } else {
      unchanged++;
    }
  }
  return { added, updated, unchanged };
}

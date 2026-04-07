/**
 * toolbox/tools/sovereign-workforce/agent-heartbeat.ts
 * version: 1.0.0
 *
 * Pillar 21: Persistent Agents
 * Domains: NEURAL-INFRASTRUCTURE | Workforce-Sovereignty
 *
 * Manages "always-on" agent loops in a containerised environment.
 *
 * Two primary systems:
 *
 *   1. AgentHeartbeat
 *      Keeps a named Worker/Critic/Fixer agent alive indefinitely.
 *      Each agent runs in its own async loop with:
 *        - Configurable tick interval
 *        - Exponential back-off on failure
 *        - Grace-shutdown via AbortController
 *        - Health ledger (last-seen, tick count, error history)
 *
 *   2. GoalMonitor
 *      Polls a data source (DB value, API endpoint, in-memory store)
 *      at a configurable cadence and fires a registered task callback
 *      whenever a threshold condition is crossed (rising, falling, or
 *      band-exit).  Supports one-shot and repeating triggers.
 *
 * Designed for:
 *   - Bun long-running processes (bun run agent-heartbeat.ts)
 *   - Docker containers with process supervision (Tini / s6-overlay)
 *   - Synology NAS via Docker Compose
 *
 * Pure TypeScript — no framework dependencies.
 * All timers use setInterval / setTimeout (compatible with Bun + Node).
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — AGENT ROLES
// ═══════════════════════════════════════════════════════════════════

export type AgentRole = "WORKER" | "CRITIC" | "FIXER" | "MONITOR" | "CUSTOM";

export type AgentStatus =
  | "IDLE"        // registered but not yet started
  | "RUNNING"     // tick loop active
  | "PAUSED"      // loop suspended; can be resumed
  | "BACKING_OFF" // in exponential back-off after error
  | "STOPPED"     // gracefully shut down
  | "FAULTED";    // exceeded maxConsecutiveErrors — needs human intervention

export interface AgentTickContext {
  agentId:   string;
  role:      AgentRole;
  tickIndex: number;
  signal:    AbortSignal;
}

/** A single tick function — the work the agent does each cycle */
export type TickFn = (ctx: AgentTickContext) => Promise<void>;

export interface AgentConfig {
  /** Unique agent identifier */
  agentId:          string;
  role:             AgentRole;
  tick:             TickFn;
  /** Interval between ticks in ms. Default: 5 000 */
  intervalMs?:      number;
  /** Base back-off delay on error in ms. Default: 2 000 */
  backOffBaseMs?:   number;
  /** Max back-off cap in ms. Default: 60 000 */
  backOffMaxMs?:    number;
  /** Max consecutive errors before FAULTED. Default: 10 */
  maxConsecutiveErrors?: number;
  /** Optional human-readable description */
  description?:     string;
}

export interface AgentHealth {
  agentId:             string;
  role:                AgentRole;
  status:              AgentStatus;
  startedAt:           number | null;   // Unix ms
  lastTickAt:          number | null;
  lastErrorAt:         number | null;
  tickCount:           number;
  errorCount:          number;
  consecutiveErrors:   number;
  currentBackOffMs:    number;
  description:         string;
  recentErrors:        string[];        // last 5 error messages
}

// ═══════════════════════════════════════════════════════════════════
// AGENT HEARTBEAT
// ═══════════════════════════════════════════════════════════════════

export class AgentHeartbeat {
  private configs:   Map<string, Required<AgentConfig>>     = new Map();
  private health:    Map<string, AgentHealth>               = new Map();
  private aborts:    Map<string, AbortController>           = new Map();
  private loops:     Map<string, Promise<void>>             = new Map();

  // ── Registration ────────────────────────────────────────────────

  /**
   * Register an agent. Does not start it — call `start(agentId)` separately.
   */
  register(config: AgentConfig): void {
    if (this.configs.has(config.agentId)) {
      throw new Error(`AgentHeartbeat: agent '${config.agentId}' is already registered.`);
    }
    const full: Required<AgentConfig> = {
      agentId:               config.agentId,
      role:                  config.role,
      tick:                  config.tick,
      intervalMs:            config.intervalMs            ?? 5_000,
      backOffBaseMs:         config.backOffBaseMs         ?? 2_000,
      backOffMaxMs:          config.backOffMaxMs          ?? 60_000,
      maxConsecutiveErrors:  config.maxConsecutiveErrors  ?? 10,
      description:           config.description           ?? `${config.role} agent`,
    };
    this.configs.set(config.agentId, full);
    this.health.set(config.agentId, {
      agentId:            config.agentId,
      role:               config.role,
      status:             "IDLE",
      startedAt:          null,
      lastTickAt:         null,
      lastErrorAt:        null,
      tickCount:          0,
      errorCount:         0,
      consecutiveErrors:  0,
      currentBackOffMs:   0,
      description:        full.description,
      recentErrors:       [],
    });
  }

  // ── Start ────────────────────────────────────────────────────────

  /** Start an agent's tick loop. */
  start(agentId: string): void {
    const cfg    = this.requireConfig(agentId);
    const health = this.requireHealth(agentId);
    if (health.status === "RUNNING") return;

    const abort = new AbortController();
    this.aborts.set(agentId, abort);

    health.status    = "RUNNING";
    health.startedAt = Date.now();
    this.health.set(agentId, health);

    const loop = this._runLoop(cfg, abort.signal);
    this.loops.set(agentId, loop);
    loop.catch((err) => {
      const h = this.health.get(agentId);
      if (h) { h.status = "FAULTED"; this.health.set(agentId, h); }
      console.error(`[HeartBeat] Agent '${agentId}' loop exited with error:`, err);
    });
  }

  /** Start all registered agents. */
  startAll(): void {
    for (const id of this.configs.keys()) {
      const h = this.health.get(id);
      if (h?.status === "IDLE" || h?.status === "STOPPED") this.start(id);
    }
  }

  // ── Stop ─────────────────────────────────────────────────────────

  /** Gracefully stop an agent (completes current tick before stopping). */
  async stop(agentId: string): Promise<void> {
    const abort = this.aborts.get(agentId);
    if (!abort) return;
    abort.abort();
    await this.loops.get(agentId)?.catch(() => {});
    const h = this.health.get(agentId);
    if (h) { h.status = "STOPPED"; this.health.set(agentId, h); }
    this.aborts.delete(agentId);
    this.loops.delete(agentId);
  }

  /** Stop all agents. */
  async stopAll(): Promise<void> {
    await Promise.all([...this.configs.keys()].map((id) => this.stop(id)));
  }

  // ── Pause / Resume ───────────────────────────────────────────────

  /** Pause a running agent (stops tick loop, preserves state). */
  async pause(agentId: string): Promise<void> {
    await this.stop(agentId);
    const h = this.health.get(agentId);
    if (h) { h.status = "PAUSED"; this.health.set(agentId, h); }
  }

  /** Resume a paused agent. */
  resume(agentId: string): void {
    const h = this.health.get(agentId);
    if (!h || h.status !== "PAUSED") return;
    h.status = "IDLE";
    this.start(agentId);
  }

  // ── Health ───────────────────────────────────────────────────────

  getHealth(agentId: string): AgentHealth | null {
    return this.health.get(agentId) ?? null;
  }

  getAllHealth(): AgentHealth[] {
    return [...this.health.values()];
  }

  isHealthy(agentId: string): boolean {
    const h = this.health.get(agentId);
    return h?.status === "RUNNING" || h?.status === "BACKING_OFF";
  }

  // ── Internal tick loop ───────────────────────────────────────────

  private async _runLoop(
    cfg:    Required<AgentConfig>,
    signal: AbortSignal
  ): Promise<void> {
    let tickIndex   = 0;

    while (!signal.aborted) {
      const h = this.health.get(cfg.agentId)!;

      // Wait for interval (or back-off)
      const delay = h.currentBackOffMs > 0 ? h.currentBackOffMs : cfg.intervalMs;
      await sleep(delay, signal);
      if (signal.aborted) break;

      // Execute tick
      try {
        h.status = "RUNNING";
        this.health.set(cfg.agentId, h);

        await cfg.tick({ agentId: cfg.agentId, role: cfg.role, tickIndex, signal });

        // Success — reset back-off
        h.lastTickAt          = Date.now();
        h.tickCount++;
        h.consecutiveErrors   = 0;
        h.currentBackOffMs    = 0;
        tickIndex++;
        this.health.set(cfg.agentId, h);

      } catch (err: unknown) {
        if (signal.aborted) break;

        const msg = err instanceof Error ? err.message : String(err);
        h.errorCount++;
        h.consecutiveErrors++;
        h.lastErrorAt = Date.now();
        h.recentErrors = [...h.recentErrors.slice(-4), msg];

        // Exponential back-off
        h.currentBackOffMs = Math.min(
          cfg.backOffBaseMs * 2 ** (h.consecutiveErrors - 1),
          cfg.backOffMaxMs
        );

        if (h.consecutiveErrors >= cfg.maxConsecutiveErrors) {
          h.status = "FAULTED";
          this.health.set(cfg.agentId, h);
          console.error(
            `[HeartBeat] Agent '${cfg.agentId}' FAULTED after ${h.consecutiveErrors} consecutive errors. Last: ${msg}`
          );
          return;
        }

        h.status = "BACKING_OFF";
        this.health.set(cfg.agentId, h);
        console.warn(
          `[HeartBeat] Agent '${cfg.agentId}' error (${h.consecutiveErrors}/${cfg.maxConsecutiveErrors}): ${msg}. Back-off: ${h.currentBackOffMs}ms`
        );
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private requireConfig(id: string): Required<AgentConfig> {
    const cfg = this.configs.get(id);
    if (!cfg) throw new Error(`AgentHeartbeat: agent '${id}' is not registered.`);
    return cfg;
  }

  private requireHealth(id: string): AgentHealth {
    const h = this.health.get(id);
    if (!h) throw new Error(`AgentHeartbeat: no health record for '${id}'.`);
    return h;
  }
}

// ═══════════════════════════════════════════════════════════════════
// GOAL MONITOR
// ═══════════════════════════════════════════════════════════════════

export type ThresholdDirection =
  | "RISING"       // fires when value crosses threshold upward
  | "FALLING"      // fires when value crosses threshold downward
  | "BAND_EXIT"    // fires when value exits [low, high] band
  | "BAND_ENTER";  // fires when value enters [low, high] band

export type TriggerMode = "ONE_SHOT" | "REPEATING";

/** A function that fetches the current value of a metric (e.g. a DB query) */
export type MetricFetcher = () => Promise<number>;

/** Task callback fired when the threshold condition is met */
export type GoalTask = (context: GoalTriggerContext) => Promise<void>;

export interface GoalTriggerContext {
  goalId:          string;
  metricName:      string;
  currentValue:    number;
  previousValue:   number | null;
  threshold:       number;
  thresholdLow?:   number;
  direction:       ThresholdDirection;
  triggerCount:    number;
  triggeredAt:     number;   // Unix ms
}

export interface GoalConfig {
  goalId:          string;
  metricName:      string;
  /** Function that returns the current metric value */
  fetcher:         MetricFetcher;
  /** Primary threshold value */
  threshold:       number;
  /** Lower bound (BAND_EXIT / BAND_ENTER only) */
  thresholdLow?:   number;
  direction:       ThresholdDirection;
  mode:            TriggerMode;
  /** How often to poll the metric in ms. Default: 10 000 */
  pollIntervalMs?: number;
  /** Task to run when condition fires */
  task:            GoalTask;
  /** Optional: description for the health dashboard */
  description?:    string;
}

export interface GoalHealth {
  goalId:          string;
  metricName:      string;
  status:          "WATCHING" | "TRIGGERED" | "COMPLETED" | "STOPPED" | "FAULTED";
  currentValue:    number | null;
  previousValue:   number | null;
  triggerCount:    number;
  lastCheckedAt:   number | null;
  lastTriggeredAt: number | null;
  description:     string;
}

export class GoalMonitor {
  private goals:   Map<string, GoalConfig>  = new Map();
  private health:  Map<string, GoalHealth>  = new Map();
  private aborts:  Map<string, AbortController> = new Map();

  // ── Registration ────────────────────────────────────────────────

  register(config: GoalConfig): void {
    if (this.goals.has(config.goalId)) {
      throw new Error(`GoalMonitor: goal '${config.goalId}' already registered.`);
    }
    this.goals.set(config.goalId, {
      ...config,
      pollIntervalMs: config.pollIntervalMs ?? 10_000,
    });
    this.health.set(config.goalId, {
      goalId:          config.goalId,
      metricName:      config.metricName,
      status:          "WATCHING",
      currentValue:    null,
      previousValue:   null,
      triggerCount:    0,
      lastCheckedAt:   null,
      lastTriggeredAt: null,
      description:     config.description ?? `Monitor: ${config.metricName} ${config.direction} ${config.threshold}`,
    });
  }

  // ── Start / Stop ─────────────────────────────────────────────────

  start(goalId: string): void {
    const cfg = this.goals.get(goalId);
    if (!cfg) throw new Error(`GoalMonitor: goal '${goalId}' not registered.`);
    const abort = new AbortController();
    this.aborts.set(goalId, abort);
    this._watchLoop(cfg, abort.signal).catch((err) => {
      const h = this.health.get(goalId);
      if (h) { h.status = "FAULTED"; this.health.set(goalId, h); }
      console.error(`[GoalMonitor] Goal '${goalId}' faulted:`, err);
    });
  }

  startAll(): void {
    for (const id of this.goals.keys()) this.start(id);
  }

  async stop(goalId: string): Promise<void> {
    this.aborts.get(goalId)?.abort();
    const h = this.health.get(goalId);
    if (h) { h.status = "STOPPED"; this.health.set(goalId, h); }
    this.aborts.delete(goalId);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.goals.keys()].map((id) => this.stop(id)));
  }

  // ── Health ───────────────────────────────────────────────────────

  getHealth(goalId: string): GoalHealth | null {
    return this.health.get(goalId) ?? null;
  }

  getAllHealth(): GoalHealth[] {
    return [...this.health.values()];
  }

  // ── Threshold evaluation ─────────────────────────────────────────

  private conditionMet(
    current:  number,
    previous: number | null,
    cfg:      GoalConfig
  ): boolean {
    switch (cfg.direction) {
      case "RISING":
        return current >= cfg.threshold && (previous === null || previous < cfg.threshold);
      case "FALLING":
        return current <= cfg.threshold && (previous === null || previous > cfg.threshold);
      case "BAND_EXIT": {
        const lo = cfg.thresholdLow ?? 0;
        const hi = cfg.threshold;
        const wasInside = previous !== null && previous >= lo && previous <= hi;
        const nowOutside = current < lo || current > hi;
        return (wasInside && nowOutside) || (previous === null && nowOutside);
      }
      case "BAND_ENTER": {
        const lo = cfg.thresholdLow ?? 0;
        const hi = cfg.threshold;
        const wasOutside = previous === null || previous < lo || previous > hi;
        const nowInside  = current >= lo && current <= hi;
        return wasOutside && nowInside;
      }
    }
  }

  // ── Watch loop ───────────────────────────────────────────────────

  private async _watchLoop(cfg: GoalConfig, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await sleep(cfg.pollIntervalMs!, signal);
      if (signal.aborted) break;

      const h = this.health.get(cfg.goalId)!;
      let current: number;
      try {
        current = await cfg.fetcher();
      } catch (err) {
        console.warn(`[GoalMonitor] '${cfg.goalId}' fetcher error:`, err);
        continue;
      }

      const previous       = h.currentValue;
      h.previousValue      = previous;
      h.currentValue       = current;
      h.lastCheckedAt      = Date.now();
      this.health.set(cfg.goalId, h);

      if (this.conditionMet(current, previous, cfg)) {
        h.triggerCount++;
        h.lastTriggeredAt = Date.now();
        h.status          = "TRIGGERED";
        this.health.set(cfg.goalId, h);

        const ctx: GoalTriggerContext = {
          goalId:       cfg.goalId,
          metricName:   cfg.metricName,
          currentValue: current,
          previousValue: previous,
          threshold:    cfg.threshold,
          thresholdLow: cfg.thresholdLow,
          direction:    cfg.direction,
          triggerCount: h.triggerCount,
          triggeredAt:  h.lastTriggeredAt,
        };

        try {
          await cfg.task(ctx);
        } catch (err) {
          console.error(`[GoalMonitor] Task for '${cfg.goalId}' failed:`, err);
        }

        if (cfg.mode === "ONE_SHOT") {
          h.status = "COMPLETED";
          this.health.set(cfg.goalId, h);
          return;
        }

        h.status = "WATCHING";
        this.health.set(cfg.goalId, h);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// HEALTH DASHBOARD FORMATTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a snapshot of all agent and goal health as a compact dashboard string.
 */
export function formatHeartbeatDashboard(
  heartbeat: AgentHeartbeat,
  monitor?:  GoalMonitor
): string {
  const now   = Date.now();
  const lines: string[] = [
    `═══ Sovereign Workforce Dashboard ═══  ${new Date(now).toISOString()}`,
    "",
    "── Agents ──────────────────────────────────────────────────────",
  ];

  for (const h of heartbeat.getAllHealth()) {
    const age = h.lastTickAt ? `${Math.round((now - h.lastTickAt) / 1000)}s ago` : "never";
    const err = h.consecutiveErrors > 0 ? `  ⚠ consec=${h.consecutiveErrors}` : "";
    lines.push(
      `  [${h.status.padEnd(12)}] ${h.agentId.padEnd(24)} role:${h.role.padEnd(8)} ticks:${h.tickCount}  last:${age}${err}`
    );
  }

  if (monitor) {
    lines.push("", "── Goal Monitors ─────────────────────────────────────────────");
    for (const h of monitor.getAllHealth()) {
      const val  = h.currentValue !== null ? h.currentValue.toFixed(3) : "—";
      const age  = h.lastCheckedAt ? `${Math.round((now - h.lastCheckedAt) / 1000)}s ago` : "never";
      lines.push(
        `  [${h.status.padEnd(10)}] ${h.goalId.padEnd(24)} metric=${h.metricName.padEnd(20)} val=${val}  checked:${age}  fired:${h.triggerCount}x`
      );
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS LIFECYCLE HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Register SIGTERM / SIGINT handlers for graceful container shutdown.
 * Call once at process startup.
 *
 * @param heartbeat  The AgentHeartbeat instance to shut down
 * @param monitor    Optional GoalMonitor to shut down
 * @param onShutdown Optional additional cleanup
 */
export function registerShutdownHandlers(
  heartbeat:  AgentHeartbeat,
  monitor?:   GoalMonitor,
  onShutdown?: () => Promise<void>
): void {
  const shutdown = async (signal: string) => {
    console.log(`[HeartBeat] Received ${signal} — shutting down gracefully…`);
    await Promise.all([
      heartbeat.stopAll(),
      monitor?.stopAll(),
    ]);
    await onShutdown?.();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM").catch(console.error));
  process.on("SIGINT",  () => shutdown("SIGINT").catch(console.error));
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

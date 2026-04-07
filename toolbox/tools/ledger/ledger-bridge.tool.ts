/**
 * toolbox/tools/ledger/ledger-bridge.tool.ts
 * version: 1.0.0
 *
 * Sovereign Ledger — Ledger Bridge (NAS ↔ On-Chain).
 * Pure TypeScript. Zero framework imports.
 *
 * Connects the Yellow Pages DB to on-chain Yod token events and triggers
 * Agent Credits on the Synology NAS when a Yod deposit is detected.
 *
 * Architecture:
 *
 *   [On-chain Yod Events]
 *          │  (EVM JSON-RPC polling or WebSocket subscription)
 *          ▼
 *   LedgerBridge.start()
 *          │
 *          ├── onTithePaid()   → records tithe in GAB vault ledger
 *          ├── onDeposit()     → matches deposit to Yellow Pages business account
 *          │                     → triggers Agent Credit on Synology via HTTP
 *          └── onTransfer()    → general ledger append
 *
 * Pillar 12: Sovereign Ledger / Kingdom-Finance (GAB domain: KINGDOM-FINANCE)
 *
 * Deployment: runs as a long-lived process inside the `api` Docker container
 * (or as a standalone Bun script) on the Synology NAS.
 *
 * Required env vars:
 *   YOD_CONTRACT_ADDRESS      — deployed YodToken contract address
 *   YOD_RPC_URL               — EVM JSON-RPC endpoint (e.g. Alchemy, Infura, local)
 *   YOD_VAULT_ADDRESS         — gabResearchVault address
 *   YP_API_URL                — Yellow Pages internal API base URL
 *   NAS_AGENT_URL             — Synology Agent Credit endpoint
 *   NAS_AGENT_SECRET          — Shared secret for NAS agent auth
 *   POLL_INTERVAL_MS          — (optional) Block poll interval. Default 6000.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES — BLOCKCHAIN EVENTS
// ═══════════════════════════════════════════════════════════════════

export interface RawLog {
  address:          string;
  topics:           string[];
  data:             string;
  blockNumber:      string;  // hex
  transactionHash:  string;
  logIndex:         string;  // hex
  removed?:         boolean;
}

export interface YodTransferEvent {
  from:            string;
  to:              string;
  value:           bigint;
  blockNumber:     bigint;
  txHash:          string;
  logIndex:        number;
  isTithe:         boolean;
  isDeposit:       boolean;  // to == a watched Yellow Pages account
  timestampMs:     number;
}

export interface YodTithePaidEvent {
  from:        string;
  to:          string;
  grossAmount: bigint;
  titheAmount: bigint;
  netAmount:   bigint;
  blockNumber: bigint;
  txHash:      string;
  timestampMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — YELLOW PAGES LEDGER
// ═══════════════════════════════════════════════════════════════════

export interface YellowPagesAccount {
  /** Internal Yellow Pages business ID */
  businessId:   string;
  businessName: string;
  /** Ethereum wallet address linked to this business */
  walletAddress: string;
  /** Accumulated Yod balance in base units */
  yodBalance:   bigint;
  /** Accumulated Agent Credits (1 credit = 1 full Yod token received) */
  agentCredits: number;
}

export interface LedgerEntry {
  entryId:      string;
  type:         "TRANSFER" | "TITHE" | "DEPOSIT" | "AGENT_CREDIT";
  businessId?:  string;
  txHash:       string;
  blockNumber:  bigint;
  from:         string;
  to:           string;
  amount:       bigint;
  tithe?:       bigint;
  net?:         bigint;
  agentCredits?: number;
  timestampMs:  number;
  synced:       boolean;
}

export interface AgentCreditPayload {
  businessId:    string;
  walletAddress: string;
  yodReceived:   string;   // formatted string e.g. "5.0 י"
  creditsAwarded: number;
  txHash:        string;
  blockNumber:   string;
  timestampMs:   number;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES — BRIDGE CONFIG
// ═══════════════════════════════════════════════════════════════════

export interface LedgerBridgeConfig {
  /** Deployed YodToken contract address */
  contractAddress:   string;
  /** EVM JSON-RPC endpoint */
  rpcUrl:            string;
  /** gabResearchVault address (tithe recipient) */
  vaultAddress:      string;
  /** Yellow Pages internal API base URL */
  ypApiUrl:          string;
  /** Synology NAS Agent Credit endpoint */
  nasAgentUrl:       string;
  /** Shared secret for NAS agent auth */
  nasAgentSecret:    string;
  /** Block poll interval in ms. Default 6000 (one Polygon block). */
  pollIntervalMs?:   number;
  /** How many blocks back to re-check on startup for missed events. Default 50. */
  catchUpBlocks?:    number;
  /** Yod base units required to award 1 Agent Credit. Default 1e18 (1 whole Yod). */
  creditThresholdBaseUnits?: bigint;
}

// ═══════════════════════════════════════════════════════════════════
// EVENT TOPIC HASHES (pre-computed keccak256)
// ═══════════════════════════════════════════════════════════════════

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** keccak256("TithePaid(address,address,uint256,uint256,uint256)") */
export const TITHE_PAID_TOPIC = "0x4d61a7bd9e86de7b3af23a3c18b7a37f26b6bbdc04ad45b9c51bcad29f24f19e";

// ═══════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

function padAddress(addr: string): string {
  return addr.replace("0x", "").toLowerCase().padStart(40, "0");
}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40).toLowerCase();
}

function formatBaseUnits(baseUnits: bigint, symbol = "י", dp = 4): string {
  const unit  = 10n ** 18n;
  const whole = baseUnits / unit;
  const frac  = baseUnits % unit;
  const fracStr = frac.toString().padStart(18, "0").slice(0, dp).replace(/0+$/, "") || "0";
  return `${whole}.${fracStr} ${symbol}`;
}

/**
 * Compute how many Agent Credits a received Yod amount earns.
 * Default: 1 credit per whole Yod token received.
 */
export function computeAgentCredits(
  amountBaseUnits: bigint,
  thresholdBaseUnits: bigint = 10n ** 18n
): number {
  if (thresholdBaseUnits === 0n) return 0;
  return Number(amountBaseUnits / thresholdBaseUnits);
}

// ═══════════════════════════════════════════════════════════════════
// LOG DECODING
// ═══════════════════════════════════════════════════════════════════

export function decodeTransferLog(
  log: RawLog,
  vaultAddress: string,
  watchedAddresses: Set<string>
): YodTransferEvent {
  const from  = topicToAddress(log.topics[1]);
  const to    = topicToAddress(log.topics[2]);
  const value = hexToBigInt(log.data);

  return {
    from,
    to,
    value,
    blockNumber: hexToBigInt(log.blockNumber),
    txHash:      log.transactionHash,
    logIndex:    Number(hexToBigInt(log.logIndex)),
    isTithe:     to.toLowerCase() === vaultAddress.toLowerCase(),
    isDeposit:   watchedAddresses.has(to.toLowerCase()),
    timestampMs: Date.now(),
  };
}

export function decodeTithePaidLog(log: RawLog): YodTithePaidEvent {
  const from        = topicToAddress(log.topics[1]);
  const to          = topicToAddress(log.topics[2]);
  const hex         = log.data.replace("0x", "").padStart(192, "0");
  const grossAmount = hexToBigInt("0x" + hex.slice(0,   64));
  const titheAmount = hexToBigInt("0x" + hex.slice(64,  128));
  const netAmount   = hexToBigInt("0x" + hex.slice(128, 192));

  return { from, to, grossAmount, titheAmount, netAmount,
    blockNumber: hexToBigInt(log.blockNumber),
    txHash:      log.transactionHash,
    timestampMs: Date.now() };
}

// ═══════════════════════════════════════════════════════════════════
// JSON-RPC CLIENT (fetch-based, zero dependencies)
// ═══════════════════════════════════════════════════════════════════

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const resp = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal:  AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`RPC HTTP error: ${resp.status}`);
  const json = await resp.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result as T;
}

async function getLatestBlockNumber(rpcUrl: string): Promise<bigint> {
  const hex = await rpcCall<string>(rpcUrl, "eth_blockNumber", []);
  return hexToBigInt(hex);
}

async function getLogs(
  rpcUrl: string,
  contractAddress: string,
  topics: string[],
  fromBlock: string,
  toBlock: string
): Promise<RawLog[]> {
  return rpcCall<RawLog[]>(rpcUrl, "eth_getLogs", [{
    address:   contractAddress,
    topics:    [topics],
    fromBlock,
    toBlock,
  }]);
}

// ═══════════════════════════════════════════════════════════════════
// NAS AGENT CREDIT TRIGGER
// ═══════════════════════════════════════════════════════════════════

/**
 * POST an Agent Credit payload to the Synology NAS agent endpoint.
 * The NAS agent service (running in the `api` Docker container) receives
 * this and allocates compute/storage credits to the business account.
 *
 * Auth: Bearer token from `nasAgentSecret`.
 */
export async function triggerAgentCredit(
  nasAgentUrl:  string,
  nasAgentSecret: string,
  payload: AgentCreditPayload
): Promise<{ success: boolean; message: string; creditId?: string }> {
  try {
    const resp = await fetch(`${nasAgentUrl}/agent-credits/grant`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${nasAgentSecret}`,
        "X-Pillar":      "12-KINGDOM-FINANCE",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText);
      return { success: false, message: `NAS agent returned ${resp.status}: ${text}` };
    }

    const json = await resp.json() as { creditId?: string; message?: string };
    return { success: true, message: json.message ?? "Credits granted.", creditId: json.creditId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `NAS agent request failed: ${msg}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// YELLOW PAGES SYNC
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all Yellow Pages accounts with linked wallet addresses.
 * The YP API returns accounts with `walletAddress` populated.
 * This is polled on startup and refreshed every 5 minutes.
 */
export async function fetchYpAccounts(ypApiUrl: string): Promise<YellowPagesAccount[]> {
  try {
    const resp = await fetch(`${ypApiUrl}/api/accounts/wallets`, {
      headers: { "Accept": "application/json" },
      signal:  AbortSignal.timeout(8_000),
    });
    if (!resp.ok) throw new Error(`YP API ${resp.status}`);
    const accounts = await resp.json() as YellowPagesAccount[];
    // Coerce string balances from JSON to bigint
    return accounts.map((a) => ({
      ...a,
      yodBalance: BigInt(String(a.yodBalance ?? "0")),
    }));
  } catch (err: unknown) {
    console.warn("[ledger-bridge] fetchYpAccounts failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Append a ledger entry to the Yellow Pages DB via the YP API.
 */
export async function appendYpLedgerEntry(
  ypApiUrl: string,
  entry: Omit<LedgerEntry, "entryId" | "synced">
): Promise<boolean> {
  try {
    const resp = await fetch(`${ypApiUrl}/api/ledger/entries`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...entry,
        blockNumber: entry.blockNumber.toString(),
        amount:      entry.amount.toString(),
        tithe:       entry.tithe?.toString(),
        net:         entry.net?.toString(),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// LEDGER BRIDGE — MAIN CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * LedgerBridge — connects on-chain Yod events to the Yellow Pages DB
 * and the Synology NAS Agent Credit system.
 *
 * Usage:
 *
 *   const bridge = new LedgerBridge({
 *     contractAddress: process.env.YOD_CONTRACT_ADDRESS!,
 *     rpcUrl:          process.env.YOD_RPC_URL!,
 *     vaultAddress:    process.env.YOD_VAULT_ADDRESS!,
 *     ypApiUrl:        process.env.YP_API_URL!,
 *     nasAgentUrl:     process.env.NAS_AGENT_URL!,
 *     nasAgentSecret:  process.env.NAS_AGENT_SECRET!,
 *   });
 *
 *   await bridge.start();
 *   // Runs indefinitely — polling for new Yod events.
 */
export class LedgerBridge {
  private config:             Required<LedgerBridgeConfig>;
  private ypAccounts:         Map<string, YellowPagesAccount> = new Map(); // walletAddress → account
  private ledger:             LedgerEntry[] = [];
  private lastProcessedBlock: bigint        = 0n;
  private pollTimer:          ReturnType<typeof setTimeout> | null = null;
  private accountRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private running:            boolean = false;

  constructor(config: LedgerBridgeConfig) {
    this.config = {
      pollIntervalMs:           config.pollIntervalMs         ?? 6_000,
      catchUpBlocks:            config.catchUpBlocks          ?? 50,
      creditThresholdBaseUnits: config.creditThresholdBaseUnits ?? 10n ** 18n,
      ...config,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log("[ledger-bridge] Starting. Contract:", this.config.contractAddress);
    console.log("[ledger-bridge] RPC:", this.config.rpcUrl);
    console.log("[ledger-bridge] Vault:", this.config.vaultAddress);

    // Initial account load
    await this._refreshYpAccounts();
    this._scheduleAccountRefresh();

    // Catch up from catchUpBlocks blocks ago
    const latest = await getLatestBlockNumber(this.config.rpcUrl);
    this.lastProcessedBlock = latest - BigInt(this.config.catchUpBlocks);
    console.log(`[ledger-bridge] Catching up from block ${this.lastProcessedBlock}…`);
    await this._poll();

    // Start regular polling
    this._schedulePoll();
    console.log(`[ledger-bridge] Polling every ${this.config.pollIntervalMs}ms.`);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer)          clearTimeout(this.pollTimer);
    if (this.accountRefreshTimer) clearTimeout(this.accountRefreshTimer);
    console.log("[ledger-bridge] Stopped.");
  }

  getLedger(): LedgerEntry[] { return [...this.ledger]; }
  getAccounts(): YellowPagesAccount[] { return [...this.ypAccounts.values()]; }

  // ── Polling ────────────────────────────────────────────────────

  private _schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(async () => {
      await this._poll().catch((err) =>
        console.error("[ledger-bridge] Poll error:", err instanceof Error ? err.message : err)
      );
      this._schedulePoll();
    }, this.config.pollIntervalMs);
  }

  private async _poll(): Promise<void> {
    const latest = await getLatestBlockNumber(this.config.rpcUrl);
    if (latest <= this.lastProcessedBlock) return;

    const fromBlock = "0x" + (this.lastProcessedBlock + 1n).toString(16);
    const toBlock   = "0x" + latest.toString(16);

    await Promise.all([
      this._fetchAndProcessLogs(fromBlock, toBlock, [TRANSFER_TOPIC],    "Transfer"),
      this._fetchAndProcessLogs(fromBlock, toBlock, [TITHE_PAID_TOPIC],  "TithePaid"),
    ]);

    this.lastProcessedBlock = latest;
  }

  private async _fetchAndProcessLogs(
    fromBlock: string,
    toBlock:   string,
    topics:    string[],
    kind:      "Transfer" | "TithePaid"
  ): Promise<void> {
    const logs = await getLogs(
      this.config.rpcUrl,
      this.config.contractAddress,
      topics,
      fromBlock,
      toBlock
    );

    for (const log of logs) {
      if (log.removed) continue;
      if (kind === "Transfer")  await this._handleTransferLog(log);
      if (kind === "TithePaid") await this._handleTithePaidLog(log);
    }
  }

  // ── Event handlers ─────────────────────────────────────────────

  private async _handleTransferLog(log: RawLog): Promise<void> {
    const watchedSet = new Set([...this.ypAccounts.keys()]);
    const event      = decodeTransferLog(log, this.config.vaultAddress, watchedSet);

    console.log(
      `[ledger-bridge] Transfer: ${event.from.slice(0, 8)}… → ${event.to.slice(0, 8)}… | ${formatBaseUnits(event.value)}${event.isTithe ? " [TITHE→VAULT]" : ""}${event.isDeposit ? " [YP DEPOSIT]" : ""}`
    );

    const entry: LedgerEntry = {
      entryId:     generateId("le"),
      type:        event.isDeposit ? "DEPOSIT" : event.isTithe ? "TITHE" : "TRANSFER",
      txHash:      event.txHash,
      blockNumber: event.blockNumber,
      from:        event.from,
      to:          event.to,
      amount:      event.value,
      timestampMs: event.timestampMs,
      synced:      false,
    };

    if (event.isDeposit) {
      const account = this.ypAccounts.get(event.to.toLowerCase());
      if (account) {
        entry.businessId = account.businessId;
        await this._processDeposit(event, account, entry);
      }
    }

    this.ledger.push(entry);

    // Async persist to Yellow Pages DB (non-blocking)
    appendYpLedgerEntry(this.config.ypApiUrl, entry)
      .then((ok) => { entry.synced = ok; })
      .catch(() => {});
  }

  private async _handleTithePaidLog(log: RawLog): Promise<void> {
    const event = decodeTithePaidLog(log);
    console.log(
      `[ledger-bridge] TithePaid: gross=${formatBaseUnits(event.grossAmount)} tithe=${formatBaseUnits(event.titheAmount)} net=${formatBaseUnits(event.netAmount)} tx=${event.txHash.slice(0, 12)}…`
    );

    const entry: LedgerEntry = {
      entryId:     generateId("le"),
      type:        "TITHE",
      txHash:      event.txHash,
      blockNumber: event.blockNumber,
      from:        event.from,
      to:          event.to,
      amount:      event.grossAmount,
      tithe:       event.titheAmount,
      net:         event.netAmount,
      timestampMs: event.timestampMs,
      synced:      false,
    };

    this.ledger.push(entry);
    appendYpLedgerEntry(this.config.ypApiUrl, entry)
      .then((ok) => { entry.synced = ok; })
      .catch(() => {});
  }

  private async _processDeposit(
    event:   YodTransferEvent,
    account: YellowPagesAccount,
    entry:   LedgerEntry
  ): Promise<void> {
    // Update in-memory balance
    account.yodBalance += event.value;

    // Compute Agent Credits
    const creditsEarned = computeAgentCredits(event.value, this.config.creditThresholdBaseUnits);
    if (creditsEarned < 1) {
      console.log(`[ledger-bridge] Deposit for ${account.businessName} below credit threshold.`);
      return;
    }

    account.agentCredits += creditsEarned;
    entry.agentCredits    = creditsEarned;

    console.log(
      `[ledger-bridge] Deposit ${formatBaseUnits(event.value)} → ${account.businessName} | ${creditsEarned} Agent Credit(s)`
    );

    const payload: AgentCreditPayload = {
      businessId:    account.businessId,
      walletAddress: account.walletAddress,
      yodReceived:   formatBaseUnits(event.value),
      creditsAwarded: creditsEarned,
      txHash:        event.txHash,
      blockNumber:   event.blockNumber.toString(),
      timestampMs:   event.timestampMs,
    };

    const result = await triggerAgentCredit(
      this.config.nasAgentUrl,
      this.config.nasAgentSecret,
      payload
    );

    if (result.success) {
      console.log(`[ledger-bridge] NAS agent credited: ${result.creditId ?? "ok"}`);

      // Record Agent Credit ledger entry
      this.ledger.push({
        entryId:      generateId("le"),
        type:         "AGENT_CREDIT",
        businessId:   account.businessId,
        txHash:       event.txHash,
        blockNumber:  event.blockNumber,
        from:         event.from,
        to:           event.to,
        amount:       event.value,
        agentCredits: creditsEarned,
        timestampMs:  Date.now(),
        synced:       true,
      });
    } else {
      console.warn(`[ledger-bridge] NAS agent credit failed for ${account.businessName}: ${result.message}`);
    }
  }

  // ── Account refresh ────────────────────────────────────────────

  private async _refreshYpAccounts(): Promise<void> {
    const accounts = await fetchYpAccounts(this.config.ypApiUrl);
    this.ypAccounts.clear();
    for (const a of accounts) {
      this.ypAccounts.set(a.walletAddress.toLowerCase(), a);
    }
    console.log(`[ledger-bridge] Loaded ${this.ypAccounts.size} Yellow Pages wallet accounts.`);
  }

  private _scheduleAccountRefresh(): void {
    this.accountRefreshTimer = setTimeout(async () => {
      await this._refreshYpAccounts().catch(console.warn);
      if (this.running) this._scheduleAccountRefresh();
    }, 5 * 60 * 1000); // refresh every 5 minutes
  }
}

// ═══════════════════════════════════════════════════════════════════
// STANDALONE ENTRY POINT (run directly with: bun ledger-bridge.tool.ts)
// ═══════════════════════════════════════════════════════════════════

if (typeof Bun !== "undefined" && import.meta.main) {
  const config: LedgerBridgeConfig = {
    contractAddress:  process.env.YOD_CONTRACT_ADDRESS  ?? "",
    rpcUrl:           process.env.YOD_RPC_URL           ?? "http://localhost:8545",
    vaultAddress:     process.env.YOD_VAULT_ADDRESS     ?? "",
    ypApiUrl:         process.env.YP_API_URL            ?? "http://localhost:4000",
    nasAgentUrl:      process.env.NAS_AGENT_URL         ?? "http://localhost:4000",
    nasAgentSecret:   process.env.NAS_AGENT_SECRET      ?? "",
    pollIntervalMs:   Number(process.env.POLL_INTERVAL_MS ?? "6000"),
    catchUpBlocks:    Number(process.env.CATCH_UP_BLOCKS  ?? "50"),
  };

  if (!config.contractAddress) {
    console.error("[ledger-bridge] ERROR: YOD_CONTRACT_ADDRESS is not set.");
    process.exit(1);
  }
  if (!config.vaultAddress) {
    console.error("[ledger-bridge] ERROR: YOD_VAULT_ADDRESS is not set.");
    process.exit(1);
  }

  const bridge = new LedgerBridge(config);
  await bridge.start();

  process.on("SIGTERM", () => { bridge.stop(); process.exit(0); });
  process.on("SIGINT",  () => { bridge.stop(); process.exit(0); });
}

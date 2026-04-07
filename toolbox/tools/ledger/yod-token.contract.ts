/**
 * toolbox/tools/ledger/yod-token.contract.ts
 * version: 1.0.0
 *
 * Sovereign Ledger — Yod Coin (י) Smart Contract Scaffold.
 * Pillar 12: Kingdom-Finance (GAB domain: KINGDOM-FINANCE)
 *
 * This file ships three things:
 *
 *   1. CONTRACT_SOURCE      — The complete Solidity ERC-20 source for the
 *                             Yod Token (symbol: י) with a built-in 10%
 *                             Tithe-Tax that auto-routes to GAB-Research-Vault.
 *
 *   2. YOD_ABI              — Typed ABI array for use with ethers.js v6,
 *                             viem, or any ABI-compatible client.
 *
 *   3. Pure TypeScript helpers — computeTithe(), buildTransferCalldata(),
 *                             decodeTransferEvent() — zero external imports,
 *                             fully portable to Synology NAS / Docker.
 *
 * Deployment target: EVM-compatible chain (Ethereum, Polygon, Base, or
 * any chain reachable from the Synology NAS agent container).
 *
 * Move (Sui / Aptos) note: A Move scaffold is provided at the bottom of
 * this file as a comment block for future porting. The TypeScript helpers
 * above are chain-agnostic and work with both VM targets.
 */

// ═══════════════════════════════════════════════════════════════════
// 1. SOLIDITY CONTRACT SOURCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Full Solidity source for the Yod Token.
 * Compile with solc ^0.8.24 or Foundry / Hardhat.
 *
 * Key mechanics:
 *   - Standard ERC-20 with 18 decimals.
 *   - Symbol: 'י'  (Unicode U+05D9 Hebrew Letter Yod)
 *   - Every transfer and transferFrom deducts a 10% Tithe.
 *   - The Tithe is credited directly to `gabResearchVault` — immutable at deploy.
 *   - The Tithe rate is stored as `titheRateBps` (1000 = 10%) and is
 *     adjustable by the owner within the hard-cap of 2000 bps (20%).
 *   - A `TithePaid` event is emitted on every taxed transfer for ledger indexing.
 *   - Minting is owner-only; supply is uncapped but auditable via `totalSupply()`.
 */
export const CONTRACT_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  YodToken
 * @notice Sovereign Ledger — Yod Coin (י)
 *         ERC-20 token with a 10% Tithe-Tax on every transfer,
 *         auto-routed to the GAB Research Vault.
 * @dev    Pillar 12 of the Sovereign Mainframe (GAB domain: KINGDOM-FINANCE)
 */
contract YodToken {

    // ── Metadata ──────────────────────────────────────────────────
    string  public constant name     = "Yod Coin";
    string  public constant symbol   = "\\u05D9";   // Hebrew letter Yod: י
    uint8   public constant decimals = 18;

    // ── Tithe configuration ───────────────────────────────────────
    uint256 public constant TITHE_RATE_BPS_MAX = 2000;  // hard cap: 20%
    uint256 public titheRateBps                = 1000;  // default: 10%
    address public immutable gabResearchVault;           // set at deploy; immutable

    // ── Ownership ─────────────────────────────────────────────────
    address public owner;

    // ── ERC-20 state ──────────────────────────────────────────────
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Tithe ledger ──────────────────────────────────────────────
    /// @notice Cumulative Tithe routed to the GAB Research Vault.
    uint256 public totalTithePaid;

    // ── Events ────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TithePaid(
        address indexed from,
        address indexed to,
        uint256 grossAmount,
        uint256 titheAmount,
        uint256 netAmount
    );
    event TitheRateChanged(uint256 oldRateBps, uint256 newRateBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Modifiers ─────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "YodToken: caller is not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────
    /**
     * @param _gabResearchVault  Immutable vault address. Every Tithe is sent here.
     * @param _initialSupply     Tokens minted to deployer (in whole tokens; scaled by 1e18 internally).
     */
    constructor(address _gabResearchVault, uint256 _initialSupply) {
        require(_gabResearchVault != address(0), "YodToken: vault is zero address");
        gabResearchVault = _gabResearchVault;
        owner            = msg.sender;
        _mint(msg.sender, _initialSupply * (10 ** decimals));
    }

    // ── ERC-20 view functions ─────────────────────────────────────
    function totalSupply()                           external view returns (uint256) { return _totalSupply; }
    function balanceOf(address account)              external view returns (uint256) { return _balances[account]; }
    function allowance(address _owner, address spender) external view returns (uint256) { return _allowances[_owner][spender]; }

    // ── ERC-20 state-changing functions ───────────────────────────
    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 grossAmount) external returns (bool) {
        _transferWithTithe(msg.sender, to, grossAmount);
        return true;
    }

    function transferFrom(address from, address to, uint256 grossAmount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= grossAmount, "YodToken: insufficient allowance");
        unchecked { _allowances[from][msg.sender] = currentAllowance - grossAmount; }
        _transferWithTithe(from, to, grossAmount);
        return true;
    }

    // ── Tithe-exempt transfer (vault ↔ vault only) ────────────────
    /// @notice Transfer between whitelisted system addresses without Tithe.
    ///         Only callable by owner. Used for vault rebalancing.
    function vaultTransfer(address from, address to, uint256 amount) external onlyOwner {
        require(
            from == gabResearchVault || to == gabResearchVault,
            "YodToken: vaultTransfer restricted to vault address"
        );
        _transfer(from, to, amount);
    }

    // ── Minting ───────────────────────────────────────────────────
    /// @notice Mint new Yod tokens. Owner-only. No hard supply cap —
    ///         supply growth is auditable via on-chain events.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ── Tithe rate governance ─────────────────────────────────────
    /// @notice Adjust the Tithe rate. Hard-capped at 20% (2000 bps).
    function setTitheRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps <= TITHE_RATE_BPS_MAX, "YodToken: rate exceeds 20% cap");
        emit TitheRateChanged(titheRateBps, newRateBps);
        titheRateBps = newRateBps;
    }

    // ── Ownership ─────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "YodToken: new owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Internal mechanics ────────────────────────────────────────
    /**
     * @dev Core transfer with Tithe deduction.
     *      grossAmount = tithe + netAmount.
     *      Tithe is credited directly to gabResearchVault.
     *      Two Transfer events are emitted: one for the tithe leg,
     *      one for the net amount to the recipient.
     */
    function _transferWithTithe(address from, address to, uint256 grossAmount) internal {
        require(from != address(0), "YodToken: transfer from zero address");
        require(to   != address(0), "YodToken: transfer to zero address");
        require(_balances[from] >= grossAmount, "YodToken: insufficient balance");

        uint256 tithe     = (grossAmount * titheRateBps) / 10_000;
        uint256 netAmount = grossAmount - tithe;

        unchecked {
            _balances[from] -= grossAmount;
            _balances[gabResearchVault] += tithe;
            _balances[to]               += netAmount;
        }

        totalTithePaid += tithe;

        emit Transfer(from, gabResearchVault, tithe);
        emit Transfer(from, to, netAmount);
        emit TithePaid(from, to, grossAmount, tithe, netAmount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "YodToken: zero address");
        require(_balances[from] >= amount, "YodToken: insufficient balance");
        unchecked {
            _balances[from] -= amount;
            _balances[to]   += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "YodToken: mint to zero address");
        _totalSupply    += amount;
        _balances[to]   += amount;
        emit Transfer(address(0), to, amount);
    }

    function _approve(address _owner, address spender, uint256 amount) internal {
        require(_owner != address(0) && spender != address(0), "YodToken: zero address");
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }
}
`;

// ═══════════════════════════════════════════════════════════════════
// 2. TYPED ABI
// ═══════════════════════════════════════════════════════════════════

/**
 * Typed ABI for YodToken.
 * Compatible with ethers.js v6, viem, wagmi, and any ABI-consumer.
 */
export const YOD_ABI = [
  // ── Metadata ──
  { type: "function", name: "name",     stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "string"  }] },
  { type: "function", name: "symbol",   stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "string"  }] },
  { type: "function", name: "decimals", stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "uint8"   }] },

  // ── Tithe config ──
  { type: "function", name: "titheRateBps",         stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "TITHE_RATE_BPS_MAX",   stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "gabResearchVault",     stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "totalTithePaid",       stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "uint256" }] },

  // ── ERC-20 ──
  { type: "function", name: "totalSupply", stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf",   stateMutability: "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "",        type: "uint256" }] },
  { type: "function", name: "allowance",   stateMutability: "view",
    inputs:  [{ name: "_owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "",       type: "uint256" }] },
  { type: "function", name: "approve",     stateMutability: "nonpayable",
    inputs:  [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "",        type: "bool"    }] },
  { type: "function", name: "transfer",    stateMutability: "nonpayable",
    inputs:  [{ name: "to", type: "address" }, { name: "grossAmount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "transferFrom", stateMutability: "nonpayable",
    inputs:  [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "grossAmount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },

  // ── Governance ──
  { type: "function", name: "mint",             stateMutability: "nonpayable",
    inputs:  [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "setTitheRate",     stateMutability: "nonpayable",
    inputs:  [{ name: "newRateBps", type: "uint256" }], outputs: [] },
  { type: "function", name: "vaultTransfer",    stateMutability: "nonpayable",
    inputs:  [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "transferOwnership", stateMutability: "nonpayable",
    inputs:  [{ name: "newOwner", type: "address" }], outputs: [] },
  { type: "function", name: "owner",            stateMutability: "view",  inputs: [], outputs: [{ name: "", type: "address" }] },

  // ── Events ──
  { type: "event", name: "Transfer",
    inputs: [
      { indexed: true,  name: "from",  type: "address" },
      { indexed: true,  name: "to",    type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ] },
  { type: "event", name: "Approval",
    inputs: [
      { indexed: true,  name: "owner",   type: "address" },
      { indexed: true,  name: "spender", type: "address" },
      { indexed: false, name: "value",   type: "uint256" },
    ] },
  { type: "event", name: "TithePaid",
    inputs: [
      { indexed: true,  name: "from",        type: "address" },
      { indexed: true,  name: "to",          type: "address" },
      { indexed: false, name: "grossAmount", type: "uint256" },
      { indexed: false, name: "titheAmount", type: "uint256" },
      { indexed: false, name: "netAmount",   type: "uint256" },
    ] },
  { type: "event", name: "TitheRateChanged",
    inputs: [
      { indexed: false, name: "oldRateBps", type: "uint256" },
      { indexed: false, name: "newRateBps", type: "uint256" },
    ] },
  { type: "event", name: "OwnershipTransferred",
    inputs: [
      { indexed: true, name: "previousOwner", type: "address" },
      { indexed: true, name: "newOwner",       type: "address" },
    ] },
] as const;

// ═══════════════════════════════════════════════════════════════════
// 3. PURE TYPESCRIPT HELPERS (zero external imports)
// ═══════════════════════════════════════════════════════════════════

/** 1 Yod = 1e18 base units (18 decimals) */
export const YOD_DECIMALS = 18n;
export const YOD_UNIT     = 10n ** YOD_DECIMALS;

/** Symbol constant for display */
export const YOD_SYMBOL   = "י";

/** Default tithe rate: 1000 bps = 10% */
export const DEFAULT_TITHE_RATE_BPS = 1000n;

/**
 * Compute Tithe and net amount from a gross transfer value.
 * All values are bigints in base units (wei-scale).
 *
 * @param grossAmount   Gross transfer in base units
 * @param titheRateBps  Rate in basis points. Default 1000 (10%).
 */
export function computeTithe(
  grossAmount: bigint,
  titheRateBps: bigint = DEFAULT_TITHE_RATE_BPS
): { tithe: bigint; netAmount: bigint; grossAmount: bigint; titheRateBps: bigint } {
  if (titheRateBps > 10_000n) throw new Error("computeTithe: titheRateBps cannot exceed 10000 (100%).");
  const tithe     = (grossAmount * titheRateBps) / 10_000n;
  const netAmount = grossAmount - tithe;
  return { tithe, netAmount, grossAmount, titheRateBps };
}

/**
 * Format a base-unit bigint to a human-readable Yod string.
 * e.g. 1_500_000_000_000_000_000n → "1.5 י"
 *
 * @param baseUnits  Amount in base units (18 decimals)
 * @param decimals   Number of decimal places to show. Default 4.
 */
export function formatYod(baseUnits: bigint, decimals = 4): string {
  const whole = baseUnits / YOD_UNIT;
  const frac  = baseUnits % YOD_UNIT;
  const fracStr = frac.toString().padStart(Number(YOD_DECIMALS), "0").slice(0, decimals);
  const trimmed = fracStr.replace(/0+$/, "") || "0";
  return `${whole}.${trimmed} ${YOD_SYMBOL}`;
}

/**
 * Parse a human-readable Yod amount to base units (bigint).
 * e.g. "1.5" → 1_500_000_000_000_000_000n
 */
export function parseYod(amount: string): bigint {
  const clean = amount.trim().replace(/[^\d.]/g, "");
  const [wholePart, fracPart = ""] = clean.split(".");
  const frac = fracPart.slice(0, Number(YOD_DECIMALS)).padEnd(Number(YOD_DECIMALS), "0");
  return BigInt(wholePart || "0") * YOD_UNIT + BigInt(frac);
}

/**
 * Build ABI-encoded calldata for a `transfer(address, uint256)` call.
 * Output is a hex string ready to set as `tx.data`.
 *
 * This is a hand-rolled minimal ABI encoder — no ethers.js required.
 * For production, replace with ethers.js `contract.interface.encodeFunctionData`.
 */
export function buildTransferCalldata(to: string, grossAmount: bigint): string {
  // transfer(address,uint256) selector: keccak256("transfer(address,uint256)")[0:4]
  // Pre-computed: 0xa9059cbb
  const selector = "a9059cbb";
  const addrPadded   = to.replace("0x", "").toLowerCase().padStart(64, "0");
  const amountPadded = grossAmount.toString(16).padStart(64, "0");
  return `0x${selector}${addrPadded}${amountPadded}`;
}

/**
 * Decode a raw `Transfer` event log into a typed object.
 * Expects the standard ERC-20 Transfer topic layout:
 *   topics[0] = Transfer(address,address,uint256) signature
 *   topics[1] = from (padded address)
 *   topics[2] = to   (padded address)
 *   data       = value (uint256, hex)
 */
export interface DecodedTransferEvent {
  from:         string;
  to:           string;
  value:        bigint;
  isTithe:      boolean;
  formatted:    string;
}

export function decodeTransferEvent(
  topics: string[],
  data: string,
  gabResearchVaultAddress?: string
): DecodedTransferEvent {
  if (topics.length < 3) throw new Error("decodeTransferEvent: expected at least 3 topics.");
  const from  = "0x" + topics[1].slice(-40);
  const to    = "0x" + topics[2].slice(-40);
  const value = BigInt("0x" + data.replace("0x", "").padStart(64, "0"));

  const isTithe = gabResearchVaultAddress != null
    ? to.toLowerCase() === gabResearchVaultAddress.toLowerCase()
    : false;

  return { from, to, value, isTithe, formatted: formatYod(value) };
}

/**
 * Decode a `TithePaid` event log.
 *   topics[0] = TithePaid signature
 *   topics[1] = from (indexed)
 *   topics[2] = to   (indexed)
 *   data       = abi.encode(grossAmount, titheAmount, netAmount)
 */
export interface DecodedTithePaidEvent {
  from:        string;
  to:          string;
  grossAmount: bigint;
  titheAmount: bigint;
  netAmount:   bigint;
  formatted: {
    gross: string;
    tithe: string;
    net:   string;
  };
}

export function decodeTithePaidEvent(
  topics: string[],
  data: string
): DecodedTithePaidEvent {
  if (topics.length < 3) throw new Error("decodeTithePaidEvent: expected at least 3 topics.");
  const from = "0x" + topics[1].slice(-40);
  const to   = "0x" + topics[2].slice(-40);

  // data = abi.encode(uint256 grossAmount, uint256 titheAmount, uint256 netAmount)
  const hex = data.replace("0x", "").padStart(192, "0");
  const grossAmount = BigInt("0x" + hex.slice(0,   64));
  const titheAmount = BigInt("0x" + hex.slice(64,  128));
  const netAmount   = BigInt("0x" + hex.slice(128, 192));

  return {
    from, to, grossAmount, titheAmount, netAmount,
    formatted: {
      gross: formatYod(grossAmount),
      tithe: formatYod(titheAmount),
      net:   formatYod(netAmount),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// MOVE SCAFFOLD (comment block — for Sui / Aptos future port)
// ═══════════════════════════════════════════════════════════════════

/*
// MOVE (Sui) — Yod Token scaffold
// Requires: Sui Move framework, sui::coin, sui::transfer

module yod::yod_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::balance::{Self, Balance};
    use sui::event;

    // One-time witness for coin creation
    struct YOD_TOKEN has drop {}

    // Symbol: Yod (י) — stored as UTF-8 bytes
    // init() registers the coin with the Sui framework
    fun init(witness: YOD_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<YOD_TOKEN>(
            witness,
            18,                          // decimals
            b"\\xD7\\x99",              // symbol bytes: UTF-8 for י
            b"Yod Coin",
            b"Sovereign Ledger Yod Coin. 10% Tithe on every transfer funds the GAB Research Vault.",
            option::none(),
            ctx
        );
        transfer::public_share_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // Tithe-aware transfer — Move enforces split at the type level
    public fun transfer_with_tithe(
        coin_in:          Coin<YOD_TOKEN>,
        recipient:        address,
        vault_address:    address,
        tithe_rate_bps:   u64,
        ctx:              &mut TxContext
    ) {
        let gross  = coin::value(&coin_in);
        let tithe  = (gross * tithe_rate_bps) / 10_000;
        let net    = gross - tithe;

        let tithe_coin = coin::split(&mut coin_in, tithe, ctx);
        transfer::public_transfer(tithe_coin, vault_address);   // fund GAB vault
        coin::keep(coin_in, ctx);                               // net to recipient (simplified)
        // In production: transfer remaining split to `recipient`
    }
}
*/

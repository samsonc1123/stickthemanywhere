# STICKERCANVAS ORCHESTRATION PROTOCOL

## 1. EXECUTION TREE
HEAD_AGENT (Orchestrator)
→ ARCHITECT (Schema / Contracts / Layering)
→ BUILDER (Implementation / Mutations / Queries / UI Wiring)
→ DEBUGGER (Runtime Analysis / Verification / Root Cause Isolation)
→ RESEARCHER (Docs / Platform Behavior / Best Practices)
→ REVIEWER (Validation / Veto / Rule Enforcement)

---

## 2. PERMANENT ARCHITECTURE RULES
- **Codes are Canonical:** Use codes in logic, never display labels.
- **Zero-Trust Filenames:** Filenames are metadata only; backend assigns canonical truth.
- **Convex is Source of Truth:** Taxonomy, linking, and code generation belong to Convex.
- **Layer Isolation:** Keep Convex logic separate from UI presentation and hooks.
- **No Frontend Taxonomy Hardcoding:** Frontend consumes taxonomy data; it does not define it.
- **Immediate Veto:** Any proposal involving hardcoded taxonomy, manual file surgery, or repeated user busywork must be rejected.

---

## 3. OPERATING STYLE (EXECUTION LOOP)
1. **Sync Reality**
   - Inspect the current file contents.
   - Verify current Convex schema.
   - Confirm actual runtime state before proposing changes.

2. **Define the Contract**
   - Establish the exact TypeScript / JSON shape first.
   - Clarify side effects before implementation.

3. **Execute**
   - Return exact files to change.
   - Return exact code blocks.
   - Return exact commands to run.

4. **Validate**
   - A task is only complete when command output, UI behavior, or test results match the expected outcome.

---

## 4. FAILURE ESCALATION (3-STRIKE RULE)
- **Attempt 1:** DEBUGGER isolates the root cause.
- **Attempt 2:** ARCHITECT pivots the system layer.
- **Attempt 3:** HEAD_AGENT proposes architectural redesign.
- **STRICT RULE:** Never repeat a failed solution path.

---

## 5. REPOSITORY MEMORY SYSTEM
Agents must update repository memory when meaningful changes occur.

Required files:
- `.ops/memory/PROJECT_STATE.md`
- `.ops/runbooks/DEV_COMMANDS.md`
- `.ops/agents/STACK.md`

If a system decision is made and not written into repo memory, it is not considered durable knowledge.

---

## 6. LAYER OWNERSHIP & COMMAND AUTHORITY

### ARCHITECT
Owns:
- `schema.ts`
- migrations
- contracts
- system layering

Allowed commands:
- `bunx convex deploy`
- migration commands
- schema inspection commands

### BUILDER
Owns:
- Convex mutations
- Convex queries
- frontend implementation
- integration wiring

Allowed commands:
- `bun run build`
- `bun run dev`
- `bunx convex codegen`

### DEBUGGER
Owns:
- runtime inspection
- logs
- root cause analysis
- failure verification

Allowed commands:
- `bun test`
- `bunx convex logs`
- diagnostic commands
- directory/file inspection commands

### RESEARCHER
Owns:
- documentation review
- platform verification
- implementation pattern comparison

Allowed actions:
- documentation lookup
- pattern verification
- compatibility checks

### REVIEWER
Owns:
- validation only
- rule enforcement
- architectural audit

Allowed commands:
- `bun run lint`
- validation queries
- read-only inspection commands

### HEAD_AGENT
Owns:
- orchestration only
- task serialization
- specialist assignment
- execution oversight

Allowed commands:
- none directly for implementation
- may issue instructions to specialists only

---

## 7. STATE VERIFICATION PROTOCOL
Before proposing changes, the responsible agent must verify:

1. Current file contents
2. Current Convex schema
3. Current runtime behavior
4. Correct layer classification:
   - Schema
   - Query
   - Mutation
   - UI
   - Deployment
   - Workflow

No changes may be proposed from assumption alone.

If state is ambiguous, DEBUGGER must first obtain verification output.

---

## 8. AGENT CONCURRENCY RULES
- No two agents may modify the same file simultaneously.
- No two agents may modify the same system layer simultaneously without serialization.
- If overlap exists, HEAD_AGENT must queue the work.

### Serialization Rule
If two tasks touch the same file, schema boundary, or deployment layer, HEAD_AGENT must serialize execution.

---

## 9. TRANSACTION & SIDE-EFFECT DISCIPLINE
- **Idempotency:** Mutations must be safe to retry without creating duplicates.
- **Isolation:** External side effects must not run inside mutations.
- **Atomic Batches:** Related writes (example: Sticker + StickerGroupLink) must happen in one logical transaction.
- **Unique Keys / Canonical Constraints:** Prevent duplicate creation with canonical identifiers and indexes.
- **Outbox Pattern:** External notifications or delayed side effects must be intent-based.

---

## 10. TRUTH-FIRST CORRECTION LOOP
If any specialist proposes a fix that violates protocol:

- REVIEWER must trigger an immediate veto.
- The veto must cite the violated rule.
- The task returns to ARCHITECT for contract correction.
- No invalid implementation proceeds just because it is convenient.

---

## 11. OUTPUT CONTRACT
Every implementation response must return:

### Objective
Short statement of what is being fixed or built.

### Side Effects
What data, schema, runtime behavior, or deployment path may be impacted.

### Contract
Exact TypeScript or JSON data shape.

### Files
Exact file paths to change.

### Changes
Exact code blocks with no placeholders.

### Commands
Exact commands to run.

### Validation
Expected output, expected UI behavior, or expected query result.

---

## 12. SYSTEM PRIORITIES
1. **System Correctness**
2. **Architecture Durability**
3. **Automation Potential**
4. **Runtime Efficiency**
5. **UX Polish**

Correctness first. Durability second. Automation third. Cosmetics last.
# AGENTS.md — Operating Manual for Coding Agents

This file is the authoritative guide for any AI coding agent working in this repository. Read it before making changes.

---

## Runtime & Package Manager

**Bun is the default runtime and package manager.** Do not use `npm`, `npx`, or `node` directly.

- Install packages: `bun add <package>` or `bun install`
- Run scripts: `bun run <script>`
- Run TypeScript files directly: `bun file.ts`
- Run binaries: `bunx <binary>`
- Bun runs TypeScript natively — no `tsx`, `ts-node`, or transpile step needed

If `tsx` is used in a script and Node is not available, replace `node_modules/.bin/tsx` with a Bun shim:
```sh
#!/bin/sh
exec bun "$@"
```

---

## Backend: Convex is the Source of Truth

**Convex is the primary backend.** All data queries, mutations, and file storage go through Convex. The Express server is legacy — do not add new functionality to it.

- Convex project files live in `convex/`
- Schema is defined in `convex/schema.ts`
- Deploy changes: `bunx convex deploy`
- Run in watch mode (from Shell, not bash sandbox): `bunx convex dev`
- Dev deployment: `groovy-pika-718.convex.cloud`
- Prod deployment: `gregarious-porpoise-625.convex.cloud`
- WebSocket-based Convex CLI commands must be run from the Replit Shell tab, not the bash sandbox

---

## Taxonomy Rules

**Taxonomy and canonical codes are backend-driven. Never derive them from filenames.**

- Canonical codes follow the format: `CATEGORY-SUBCAT00001` (uppercase, hyphen-delimited)
- Code generation lives in Convex mutations, not in the upload pipeline
- The subcategory selection in the UI is the sole source of truth for categorization
- Filenames are stored as display hints only — never parsed for category or subcategory inference
- Use `normalizeTaxonomyCode` for all code normalization (converts to uppercase with hyphens)
- Frontend must never hardcode taxonomy data (categories, subcategories, groups, or codes). All taxonomy must be fetched from Convex queries at runtime.

---

## Agent Behavior Rules

### Prefer system fixes over user workarounds
If something is broken, fix it at the root cause. Do not instruct the user to run manual commands as a substitute for a real fix unless the environment genuinely blocks the fix (e.g., locked config files).

### Pivot after two failed attempts
If the same fix fails twice at the same layer, stop and switch to a different layer. Examples:
- If fixing a package fails twice, fix the binary shim instead
- If fixing client code fails, fix the backend query instead
- Do not repeat the same failing approach a third time

### Deliverable format
Every response that changes code must include:
1. **Exact files changed** — relative paths from repo root
2. **Full copy-paste code** — no ellipses, no placeholders, no "fill this in"
3. **Exact commands to run** — copy-paste ready, in order

---

## Frontend Rules

- Framework: React 18 + TypeScript, built with Vite
- Routing: Wouter
- State: React hooks + localStorage for cart
- Data fetching: TanStack React Query (v5 object-form only)
- Do not hardcode taxonomy data in any component, page, or constant file
- All category, subcategory, and group data must come from Convex queries
- Environment variables must use `import.meta.env.VITE_*` prefix for frontend access
- Homepage layout and interface are frozen — do not alter the layout, sticker squares, title styling, or scroll behavior

---

## Runbook

```bash
# Install all dependencies (run from repo root AND from client/)
bun install
cd client && bun install

# Start the frontend dev server (Replit workflow)
cd client && bunx vite --port 5000 --host 0.0.0.0

# Start from repo root using package.json script
bun run dev

# Deploy Convex backend to production
bunx convex deploy

# Run Convex in watch mode (Shell tab only — requires WebSocket)
bunx convex dev

# Push database schema changes
bun run db:push

# Type-check the project
bun run check

# Fix broken tsx shim after bun install
rm node_modules/.bin/tsx
printf '#!/bin/sh\nexec bun "$@"\n' > node_modules/.bin/tsx
chmod +x node_modules/.bin/tsx
```

---

## Environment Secrets

Secrets are managed via Replit environment variables and the Convex Dashboard. Never hardcode secrets. Required secrets:

| Key | Where |
|-----|-------|
| `RESEND_API_KEY` | Replit + Convex Dashboard (both dev and prod) |
| `SUPABASE_URL` | Replit |
| `SUPABASE_SERVICE_ROLE_KEY` | Replit |
| `SUPABASE_BUCKET` | Replit |

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Convex schema | `convex/schema.ts` |
| Convex sticker queries | `convex/stickers.ts` |
| Convex seed data | `convex/seed.ts` |
| Admin uploader UI | `client/src/pages/AdminUploader.tsx` |
| Vite config | `client/vite.config.ts` |
| Project memory | `replit.md` |

# UNIVERSAL REPO BLUEPRINT

This document defines the standard structure for all Samson AI projects.

---------------------------------------

ROOT STRUCTURE

client/
Frontend UI (React / Vite)

server/
API routes and backend logic

convex/
Convex database schema, queries, mutations

shared/
Types shared between client and server

scripts/
Dev utilities, migrations, automation

docs/
Architecture documentation and project plans

---------------------------------------

FRONTEND STRUCTURE

client/src/

assets/        static images
components/    reusable UI components
pages/         full page screens
hooks/         react hooks
contexts/      global state providers
services/      API connectors
types/         TypeScript interfaces
utils/         helper functions

---------------------------------------

BACKEND STRUCTURE

server/

routes/
API endpoints

services/
business logic

middleware/
auth / validation

---------------------------------------

DATABASE STRUCTURE

convex/

schema.ts
queries.ts
mutations.ts
actions.ts

---------------------------------------

PROJECT RULES

1. Never mix multiple products in one repo
2. Each product = its own repository
3. Shared utilities go in shared/
4. UI must never contain database logic
5. Backend owns all database writes
6. Codes are canonical identifiers
7. Agent automation should read docs/

---------------------------------------

STANDARD REPO SET

Product repo
Example:
stickthemanywhere

Companion tool repo
Example:
redesign-ai

Infrastructure repo
Example:
samson-ai-tools
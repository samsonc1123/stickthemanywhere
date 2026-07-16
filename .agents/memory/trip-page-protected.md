---
name: Trip page protected
description: TripPage.tsx has a unique psychedelic design and a hidden admin backdoor — never touch it unless the user explicitly asks.
---

## Rule
**Never modify TripPage.tsx** (or any other page) unless the user explicitly names that page in their request.

## Why
The Trip page has:
- Special shifting color animations (`glow-psychedelic`, `animate-reality-shift`, `text-trip-morph`, `animate-slow-spin`, `text-trip-rainbow`, `animate-impossible-colors`)
- Morphing gradient subcategory buttons (`trip-gradient` keyframe animation)
- A **hidden triple-tap backdoor** on "Them" that navigates to `/admin`

Overwriting it while updating other category pages stripped all of this and cost the user credits to fix.

## How to apply
When given a batch task like "update all category pages to use live Convex data", explicitly **skip** TripPage (and any other page with custom/unique design) unless the user says to include it. Ask first if unsure.

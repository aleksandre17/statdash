---
name: canon-dod-incidents
description: THIS-repo concrete incidents behind the agnostic Definition-of-Done canon gate — the specifics that live locally, not in the kit
metadata:
  type: feedback
---
**Purpose:** the AGNOSTIC principle (Definition of Done — the canon gate, applied dynamically/proportionally; hard floor = no unverified canon-violation or false-green reaches the owner; rigor scales with risk × decision-density) lives in `kit/feedback/feedback_leadership_doctrine.md`. This file holds the THIS-repo CONCRETE incidents that motivated it — specifics belong in local memory, NOT the kit (owner correction, 2026-07-10).

**The four session slips that each reached the owner (the pattern: verified "it works", not "it's right / live / no false-green"):**
1. **False-green typecheck** — Wave 8 reported "root tsc 0" but root `tsc -b` was RED (TS2352 in `schema-completeness.fitness.test.ts`; vitest passes it via esbuild = no typecheck). Fixed `e6852a4`. → For packages/engine-touching work I now INDEPENDENTLY re-run root `tsc -b` myself; an agent's "root tsc 0" is not trusted on its word.
2. **Concept regression (only-active-shows)** — D7.1 nested-item editor shipped rendering ALL items EXPANDED at once; owner caught it as a canon violation ("only the active one's everything should show"). Fixed → D7.1b drill-in. → In live-verify I check "is it canonically RIGHT (contextual/only-active)", not just "does it function".
3. **Live-gap (test-green ≠ works)** — chrome fidelity fix (`a3faa1a`) passed its unit test but the canvas sidebar was still hollow / nav-linkless LIVE. Caught by my own Playwright live-verify. → substantive UI = live-verify, seen by me.
4. **Privileged hardcode** — `PAGE_ROOT_TYPE='inner-page'` privileged every page as inner-page (Law-1 + round-trip data-loss); the OWNER caught it, no hunt had run. Fixed foundation `24026ba` + `FF-NO-PRIVILEGED-PAGE-TYPE`. → a proactive system-wide anti-pattern/unguarded-law HUNT so the team finds rot, not the owner.

**Balance correction (owner 2026-07-10):** I first over-corrected into a RIGID 5-step protocol on every piece — waste of time/tokens + guideline-robot. Corrected to DYNAMIC/proportional: trivial → quick self-check; substantive UI → live+canon; concept/engine/cross-layer → full (independent whole-graph typecheck + senior canon-QC before owner + locking gate). Tactician, not protocol-executor.

**The self-policing gate rollout + the concrete gate backlog** (FF-GATE-BITES, FF-GROUP-FIELDS-RESOLVE, write-boundary/BUG-B, no-orphan-css, widen no-privileged-literal, single-adapter, harden chrome-token scan) live in `docs/architecture/ANTIPATTERN-HUNT.md`. Related: [[panel-live-boot-verification]], [[model-launch-ledger]].

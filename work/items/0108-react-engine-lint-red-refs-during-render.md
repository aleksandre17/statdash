---
id: "0108"
title: "Pre-existing lint RED — 20 errors in packages/react/src/engine/* (refs-during-render ×18 + rules-of-hooks ×2)"
status: backlog
class: G
priority: P2
owner: —
links:
  - work/items/0104-data-workspace-unification-and-capability-restoration.md   # surfaced during E0 panel gate
---
**Goal** — `pnpm lint` is RED on main independent of current work: 20 errors in `packages/react/src/engine/*` — "Cannot access refs during render" ×18 + rules-of-hooks ×2. These are correctness-class React rules (concurrent-rendering hazards), not style. Root-fix the ref-access pattern in the engine layer; do not suppress.

**DoD** — `pnpm lint` 0 errors repo-wide (with 0106 the only remaining known red anywhere, until it too closes); no rule disabled/suppressed without an argued exception; a green-gate note: lint joins the standard full-gate expectation honestly (today's "lint green" premise was inaccurate).

**Notes** — Surfaced 2026-07-22 by the E0 panel agent (confirmed not-theirs via changed-file diff). packages/react = app-agnostic layer (react-specialist territory; refs-during-render fixes may need careful useEffect/callback-ref restructuring — judgment, not mechanical).

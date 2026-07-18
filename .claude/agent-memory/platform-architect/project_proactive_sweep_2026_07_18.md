---
name: proactive-sweep-2026-07-18
description: I OWN docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md — 15-finding reference-class walk; top root = missing transient-failure grammar (429 kills portal+studio shells)
metadata:
  type: project
---

I own `docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md` (live Playwright walk, :3012+:3013; probes `work/probe-proactive-sweep.mjs` + `work/probe-sweep2.mjs`; shots `work/authoring-truth/sweep/`).

**Top-5:** (1) transient-failure grammar missing — per-element fetch fan-out trips own rate limiter; 429 → English whole-page dead-end on /ka + `[renderNode] shell crashed` in studio; fix = ONE store-layer query scheduler (dedupe/backoff/SWR) + `transient-retrying` honest state; (2) no Edit/Preview interaction mode — in-canvas page chrome live/ambiguous (4 locale + 3 theme controls in one viewport); (3) dead gestures: dblclick text, Ctrl+D, right-click all no-ops → Gesture→Command projection over ONE command registry; (4) URL-param port exists (perspective `mode`) but map/year/tab selections not URL-projected — generalize `urlKey` over ADR-041 Params (Law 9 permalink); (5) accessible-name integrity — 3 header links literally "[object Object]", English aria on ka, studio topbar English/Georgian mix.

6–15 incl. the novel stat-native concept: **publish-readiness gate** (EN-completeness + a11y + unbound-elements derived purely from config, on the PUBLISH button — Webflow-Audit class; distinct from AR-47). Also: per-element source citation = reader-side projection of 0090's passport SSOT; dark table headers measured 4.28:1 (AA fail); portal has no search; ⌘K insert-only.

**Why:** owner escalated «შენ უნდა მოიტანო იდეოლოგიები… უწყვეტ წყაროს გთხოვ» — I proactively hunt gaps before he stumbles.
**How to apply:** the LEAD cards these; before proposing any of them again, check the dossier + whether a card since exists. Verified-good list in the dossier prevents re-"fixing" healthy things (templates exist, badges exist, canvas keyboard-focusable). Related: [[benchmark-corpus]] [[grammar-of-interaction]] [[deep-authorability-completion]].

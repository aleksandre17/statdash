---
id: "0092"
title: "TRANSIENT-FAILURE GRAMMAR + the ONE query scheduler — 429 must degrade honestly, never kill a page (sweep #1, breaks-trust)"
status: QUEUED-HOT (2026-07-18, proactive sweep top-1 — our own rate-limit killed the portal to an English dead-end and crashed studio shells)
class: M-L
priority: P0
owner: lead → architect (scheduler seam, packages/core, arrow-clean) → build
implements: sweep dossier `docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md` finding 1 — ONE store-layer query scheduler (dedupe identical ObsQueries · concurrency cap · backoff honoring Retry-After · stale-while-revalidate) + `transient-retrying` as a DECLARED bilingual honest state (Law 11). The per-element fetch fan-out is the architectural smell (one-derivation economy violated at the store layer).
---

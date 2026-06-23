---
name: reference-roadmap-docs
description: Where the authoritative roadmap, gap analysis, and audit docs live for statdash-platform
metadata:
  type: reference
---

The team maintains evidence-grounded planning docs under `platform/docs/plan/`:

- `PLATFORM-GAP-ANALYSIS.md` — chief-engineer audit vs Grafana/Retool/Builder.io; N34–N44 move list + honest scorecard (~55% → ~75% after N34–36).
- `JSON-TARGET-GAPS.md` — architect audit of renderPageToJSON; gaps G1–G10 with file:line evidence.
- `IMPLEMENTATION-ROADMAP.md` — hosts both audits + "Shipped" logs (P1 batch 2026-06-17, Full Platform Audit Batch 2026-06-17). This is where completion is recorded.
- `N34/` (10 files) — async data lifecycle design (00-current-state … 09-risk-adr).
- `docs/audit/2026-06-15-law-violations.md` — law-violation audit.

**How to apply:** before authoring any board/roadmap, read these — they are the SSOT for what is planned vs shipped. The "Shipped —" sections of IMPLEMENTATION-ROADMAP.md record what is done; cross-check against code because docs can lag.

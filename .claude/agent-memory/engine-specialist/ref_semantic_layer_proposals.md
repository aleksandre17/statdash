---
name: ref-semantic-layer-proposals
description: Where the engine semantic-layer erosion catalog + AR-50 design studies live (proposals + ADR)
metadata:
  type: reference
---

The engine semantic-layer erosion catalog + AR-50 design rationale live at the
REPO ROOT (`national-accounts/docs/`, NOT `platform/docs/` — cwd is usually
`platform/`, so these are one level up):
- `docs/architecture/proposals/SPEC-data-semantic-worldclass.md`
- `docs/architecture/proposals/SPEC-data-semantic-worldclass-fable.md` — the
  "fable" study enumerates erosions by id (E1 = second expression dialect,
  E2 = three aggregation vocabularies, plus later Ex / G2 lineage).
- `docs/architecture/decisions/ADR-034-semantic-query-plane-and-measure-algebra.md`
  — the AR-50 decision record. (Related: ADR-025 semantic-relationships-grain-versioning.)

**How to apply:** consult these before starting any AR-50 convergence slice to get
the erosion id, its invariant, and the intended target shape. Verify against the
current tree (these are design-time docs; some erosions may already be retired —
see [[ar50-semantic-layer]] for E1/E2 status).

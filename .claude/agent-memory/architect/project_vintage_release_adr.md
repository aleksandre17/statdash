---
name: vintage-release-adr
description: Pointer to ADR-0025-vintage-release.md — SDMX-P0-2 vintage-as-release: release = publication-event aggregate stamped (via GUC/triggers) on observation + observation_revision; as-of reconstruction via pre-image overlay. Status: Accepted (design only).
metadata:
  type: project
---

**Decision record migrated to `docs/architecture/decisions/ADR-0025-vintage-release.md`** (SSOT reorg).

ADR-0025 (SDMX-P0-2): a real-time / vintage database. Release = a publication-event AGGREGATE (not 1:1 with a submission), stamped onto `observation.release_id` + `observation_revision` via a `SET LOCAL app.release_id` GUC read by triggers; the pre-image log (V8) becomes a release-keyed closed validity interval, so a vintage is reconstructed as-of date D. V25 additive + genesis backfill. Status: Accepted (design only).

Full context, decision, ≥2 rejected alternatives, consequences, and the verbatim design record now live in the ADR. This memory is only the pointer.

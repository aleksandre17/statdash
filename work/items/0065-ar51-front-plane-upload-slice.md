---
id: "0065"
title: "AR-51 first slice: front-plane raw-data UPLOAD in the Steward Model surface (upload → self-declared DSD review → publish → obs)"
status: ready
class: M
priority: P1
owner: —
implements: AR-51 / ADR-040 (agnostic ingestion port) — the platform's front-door, owner-emphasized
depends_on: []
links:
  - docs/architecture/decisions/ADR-040-agnostic-ingestion-port.md
  - docs/architecture/ARCHITECTURE-REGISTRY.md
  - platform/apps/api/src/routes/ingest/canonical.ts
  - platform/apps/panel/src/studio/surfaces/DataSurface.tsx
---
**Goal** — Bring raw-data upload to the FRONT (owner: *"everything starts with raw-data upload"*), grounded in ADR-040 (agnostic ingestion port + the Flatfile/Power-Query review-confirm pattern). A steward uploads a workbook → the source SELF-DECLARES its DSD → the steward REVIEWS/CONFIRMS the declaration → publish → obs live.

**Verified seam (research done 2026-07-12)**
- **Backend EXISTS:** `POST` canonical route accepts **raw `application/octet-stream` xlsx bytes** (dependency-free, no multipart), runs the bulkhead → `handleCanonicalUpload` → **202** with the staged submission (self-declared `CanonicalDsd`, FSM stage→publish). Reuse verbatim.
- **Mount = the STEWARD Model surface** (`ModelSurface`), NOT the author's `DataSurface` (Metric-Palette-only, `FF-AUTHOR-NO-QUERY`). Uploading raw data = DEFINING (steward), per the define-vs-curate role-lens (AR-49 M2). Consistent with 0064 (role gates depth; upload IS steward depth).

**Build (front-plane only — backend reused)**
1. An "Onboard data" affordance in `ModelSurface`: a dropzone/file-input → read bytes → `POST` the canonical route as `application/octet-stream`.
2. Render the returned staged **self-declared DSD** for REVIEW (datasetCode · name · dimensions[] · measure · codelists · meta) — the Flatfile/Power-Query confirm step (never a blind commit).
3. CONFIRM → drive the FSM publish → obs; surface the result (rows ingested) + fail-soft on partial failure (the FSM already handles it).
4. (Next) a self-declaring **adapter registry** so CSV/SDMX-JSON join xlsx behind ONE agnostic port (Law-5 generalized) — `FF-INGEST-PORT-AGNOSTIC`, `FF-ADAPTER-EMITS-DSD` (ADR-040).

**DoD (VERIFIED live on :3013 — my discipline)**
- [ ] On :3013 (steward Model mode): upload a canonical workbook → see the self-declared DSD → confirm → obs appear (the strip/charts populate).
- [ ] Reuses the existing canonical route (no backend rebuild); the panel never parses the format (agnostic — the DSD comes from the adapter/route).
- [ ] Playwright real-boot proves upload → DSD-review → confirm; `tsc -b apps/panel` + root `tsc -b --force` EXIT 0; gate green (parse the log).

**Notes** — The front-door of the ONE declaration-driven engine: a data source is a self-declaring node, exactly like a UI element (unifies with the BE line + ADR-038/039). Depth-over-breadth: drive THIS vertical to VERIFIED-live before spreading. Reuse `CanonicalDsd` + the canonical route + the FSM — surface, don't rebuild.

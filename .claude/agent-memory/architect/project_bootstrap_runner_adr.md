---
name: bootstrap-runner-adr
description: Pointer to ADR-0026-bootstrap-runner.md — turn apps/geostat into a generic content-agnostic SDUI "runner" booting any site from GET /api/bootstrap; geostat content becomes seed/provisioning data. Phase A; Phase B = ADR-018, Phase C = ADR-017.
metadata:
  type: project
---

**Decision record migrated to `docs/architecture/decisions/ADR-0026-bootstrap-runner.md`** (SSOT reorg).

ADR-0026 (Phase A): `apps/geostat` becomes a generic Server-Driven-UI runner — engine+react+plugins compiled-in (microkernel, fixed capability set), all CONTENT booted from ONE `GET /api/bootstrap` manifest (public, read-only sibling to guarded `config/*`). No `@geostat/runner` extraction yet (YAGNI). Store half already live. Status: Proposed. Phase B = ADR-018, Phase C = ADR-017.

Full context, decision, the SiteManifest contract, ≥2 rejected alternatives, consequences, and the verbatim design record now live in the ADR. This memory is only the pointer.

---
id: "0059"
title: "Dedup the accounts page to the canonical section-data pattern (kill the duplicated ~130-line pipe)"
status: backlog
class: G
priority: P2
owner: —
implements: Bounded-Element trunk applied to live config — chart↔table share ONE declared section data contract (invariant I-6, C7 dual-view)
depends_on: []
links:
  - platform/apps/api/provisioning/geostat.provisioning.json
  - work/items/0036-c7-viewrole.md
---
**Goal** — In `geostat.provisioning.json`, the `accounts` page's `sna-hero` AND `sna-hero-range` sections each carry the FULL ~130-line `data.pipe` TWICE — once on the `chart` child, once on the `table` child — byte-identical. Hoist the shared spec to the section's `data` and reduce the children to `view.role` only (the pattern the GDP page + C7 dual-view already use). One dataset, two views.

**Why** — This duplication is a SYMPTOM of nodes not sharing one declared data contract — the exact root the Bounded-Element trunk eliminates by construction. This card applies the trunk pattern to the live config, proving the class is closed (the owner's standing "dedup / one source of truth" priority).

**DoD**
- [ ] Both `accounts` sections carry `data` once at section level; chart + table are `view.role` views (no inline `data` on the children).
- [ ] **Render-parity Δ0** vs current output — verified via FF-DATA-PARITY / the geostat render suite (this is production render config: prove equivalence THROUGH the pipeline, never assume).
- [ ] No duplicated pipe survives on the page; `validateNodeConfig` + page-config schema still green.

**Notes** — Production provisioning (baked into the api image). Two-way door but render-affecting → the render-parity gate is mandatory before it's `done`. Discovered while grounding the object-model overhaul in the real corpus (~57 node contracts).

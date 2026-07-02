---
id: "0054"
title: "DATA-PARITY: extract static-era golden fixtures from git 191bc0e (the known-correct dataset)"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC.DELTA-new12 data-parity sweep (owner requirement); static-era-regression.md §(a)
depends_on: []
links:
  - platform/work/static-era-regression.md
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — Capture the static-era dataset (the pre-regression, known-correct values) as versioned test fixtures, so the parity sweep (0055) can assert that today's clean-architecture pipeline outputs the SAME data — "data must come out as it was". This is an EXPLICIT, standalone item and a prerequisite for the parity gates.

**Implements** — the owner's data-parity requirement + `static-era-regression.md` §(a). NOT a rollback: the static files are read once to mint fixtures; the running system stays on the config-driven pipeline.

**Source (read-only, from git history)** — commit `191bc0e` ("chore: initial commit — pre-platform migration snapshot"), the canonical static era. Per domain (`accounts`, `gdp`, `regional`) under `apps/geostat/src/data/<domain>/`:
- `raw.ts` — the AUTO-GENERATED hardcoded dataset from the source `.xlsx` (`REGIONAL_FACTS`, `REGIONAL_CLASSIFIERS`, `REGIONAL_DISPLAY`): inline `Observation[]` + codelists. This is the known-correct data.
- `adapter.ts` (`fromRegionalFacts()`) and `store.ts` (synchronous `ExternalStore`) — reference for how raw shaped into a DataBundle, so the fixture is captured at the same tidy-rows layer today's pipeline outputs.

**Files / modules touched (WRITE ONLY under test-fixture locations, not app/src)**
- Extract the `191bc0e` `raw.ts` datasets (+ codelists) into golden test fixtures (a fixtures directory the parity suite reads). Preserve source metadata for traceability (domain, indicator, dims).
- Record extraction provenance (source SHA `191bc0e`, files, date) alongside the fixtures so future readers know what "as it was" means.

**Dependencies** — none (pure git-history archaeology → fixture files). Prerequisite for 0055 and a strong cross-check for the bug fixes (0048–0050) and every element.

**Acceptance criteria**
- [ ] Golden fixtures extracted from `191bc0e` `apps/geostat/src/data/*/raw.ts` for all three domains (accounts, gdp, regional), at the tidy-rows/observation layer.
- [ ] Codelists (classifiers/display) captured so labels/units resolve.
- [ ] Extraction provenance recorded (source SHA, files).
- [ ] Fixtures are inert data (no logic/functions) and live under a test-fixture path (not app runtime).
- [ ] `npx tsc --noEmit` EXIT=0 (fixtures type-check).

**Standing DoD (applies) — data-parity variant** — correct data via clean/canonical architecture; the fixtures are the KNOWN-CORRECT reference, NEVER a target to hardcode the pipeline toward. No hardcode-to-golden; refine existing. No anti-patterns/DRY violations; SSOT; Strangler.

**Notes** — Two-way door (fixture extraction is additive; nothing in the running system changes). Explicit prerequisite the owner named: this IS the golden-fixture extraction item.

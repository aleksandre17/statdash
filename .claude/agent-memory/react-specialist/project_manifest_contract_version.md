---
name: manifest-contract-version
description: describeApp() AppManifest carries a SemVer contractVersion (CONTRACT_VERSION SSOT); the page-config JSON Schema derives its $id+version from it; constructor.fitness.test.ts locks the capability surface
metadata:
  type: project
---

SemVer'd the describeApp() capability manifest (ADR adr_config_and_render_vision, cohesion fitness F4). The manifest IS the renderer engine's published API, so a removed capability must be a conscious versioned break, not silent drift.

**SSOT:** `CONTRACT_VERSION = '1.0.0'` exported from packages/react/src/engine/constructor.ts; `AppManifest.contractVersion` + describeApp() emit it. Bump policy (documented on the constant): capability REMOVED / shape changed incompatibly = MAJOR; capability ADDED (new axis or new built-in id) = MINOR; doc/metadata-only = PATCH.

**Schema derivation (no parallel version):** generatePageConfigSchema() now emits `version: manifest.contractVersion` and a version-pinned `$id` (`https://statdash.dev/schema/<version>/page-config.schema.json`) via a local `schemaId(version)` helper. Both derived from the manifest — never a second literal. PageConfigSchema interface gained a `version` field.

**Fitness lock:** packages/react/src/engine/constructor.fitness.test.ts locks the STABLE surface only — (a) the SET of top-level axes (toEqual EXPECTED_AXES, symmetric so a dropped OR new-unlocked axis fails) + contractVersion present & SemVer-shaped; (b) built-in capability ids registered at IMPORT time via toContain: SPEC_CATALOG spec types, core transform ops, csv/sdmx-json export formats, chartTypes non-empty. DELIBERATELY NOT locked: values of app-boot-populated axes (palette/modes/datasourceKinds/metrics/filterControlTypes — empty in node env without setupRegistrations), and field-level contents. A removal → missing id → FAIL → forces a conscious MAJOR bump; a benign addition only needs extending the expected set + MINOR bump.

**Pre-existing breakage encountered (NOT mine):** a parallel node-dir agent renamed `georgraph`→`geograph` on disk but the emit script (packages/react/scripts/emit-page-config-schema.ts) + 4 plugin tests still import `../georgraph/default/meta`. This breaks `pnpm gen:schema`, `pnpm typecheck`, and the plugins page-config-schema.fitness "live==committed" test for everyone. Because I couldn't run gen:schema, I applied the exact generator delta to the committed artifact by hand (verified byte-identical to live generator output for $id+version). Once the rename drift is fixed, gen:schema reproduces the committed file.

See [[wire-contract-floor]].

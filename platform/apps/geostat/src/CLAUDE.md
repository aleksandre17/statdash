# src/ — Application Layer Orientation (PURE GENERIC RUNNER)

> ავტოლოადი apps/geostat/src/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — the MAP + the laws + where to go deeper.
> This app is a de-tenanted SDUI runner (ADR-0028): it carries **NO tenant content** (no pages, no datasets, no brand) — all content comes from the API at boot. `src/` = the **outermost** layer (knows everything); only here may app-tier (non-content) wiring live.

---

## The map — where each thing lives (find here, don't grep)

| folder / file | owns | look here for |
|---------------|------|---------------|
| **main.tsx** | entry point | bootstrap mount |
| **app/** | React app root | `App.tsx`, routing, providers |
| **data/** | data-layer wiring + **render-parity harness** | `DataStore` wiring, `fromSDMX` adapter boundary (Law 5), parity fixtures/tests |
| **extensions/** | app-tier extension contributions | contributions into the engine's extension points |
| **i18n/** | i18n machinery | catalog wiring, `feedback.ts` (en UI-chrome baseline) |
| **shared/** | app-shared utils | cross-cutting helpers |
| **bootRegistrations.ts** · **setupRegistrations.ts** | the registration wiring | which nodes/panels/chrome/controls/datasources register into the registries |
| **site-manifest.ts** | the boot seam | `GET /api/bootstrap` → manifest; `emptyManifest()` fallback |

> **Content is NOT here** — pages/nav/chrome/datasets live in `apps/api/provisioning/geostat.provisioning.json` (config) + `ops/seed-data/geostat/` (data). They were extracted here and deleted (ADR-0028). The runner renders whatever the manifest declares — generically.

---

## The laws (this layer)

- **Pure generic runner (Law 1 / ADR-0028)** — no tenant content compiled in; nothing tenant-specific in `src/`. A hardcoded page/dataset/brand here is a violation.
- **Boot fail-soft** — `site-manifest.ts`: primary = `GET /api/bootstrap` (+ `config.data_source` stores); fallback = `emptyManifest()` (brand-free "site unavailable"). The runner ALWAYS boots.
- **`emptyManifest()` stays tenant-agnostic + en-only** (Law 1); tenant locales arrive via the manifest i18n catalog at boot.
- **`fromSDMX` is the only adapter boundary** (Law 5) — data enters through it, nowhere else.

---

## Go deeper

Provisioning config (the pages/nav/chrome the owner authors) → `apps/api/provisioning/geostat.provisioning.json`. Seed data → `ops/seed-data/geostat/`. Engine/plugin layers + the dependency arrow → `packages/CLAUDE.md`. Architecture decisions → `docs/architecture/decisions/` (ADRs).

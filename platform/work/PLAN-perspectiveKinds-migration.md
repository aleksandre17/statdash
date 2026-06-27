# PLAN — MED-2: retire the `ManifestMode` / `site_config.modes` System-A island

> Design-only, awaiting greenlight. Ground-truth-verified against the live tree 2026-06-27 (NOT the planning docs).
> Tracking handle keeps the historical name `perspectiveKinds`; the verdict below is **DELETE-THE-ISLAND**, not rename — see §2.
> Source finding: `work/REVIEW-perspective-batch.md` MED-2. Vetted direction: `VISION-mode-as-perspective-axis.v3-FULLSTACK.md` §2.3/§4, `adr_mode_as_view_axis.md` (FULL-STACK EXTENSION).

---

## 1. Ground truth (verified in code, not docs)

The island spans four live sites + one DB row:

| Site | Reality (verified) |
|---|---|
| `packages/contracts/src/manifest.ts:27,70` | `interface ManifestMode { id; label; icon?; dataKey? }` + **required** `SiteManifestContract.modes: ManifestMode[]`. Structurally **identical** to engine `PerspectiveOption` (`packages/core/src/perspective/types.ts:19`). |
| `apps/api/src/routes/bootstrap/index.ts:35,94,103,269,302,310` | imports `ManifestMode`; `DEFAULT_MODES: ManifestMode[] = []`; `SITE_KEY.modes='modes'`; `const modes = pick(SITE_KEY.modes, DEFAULT_MODES, Array.isArray)`; emits `modes` in the manifest. |
| `apps/geostat/src/app/App.tsx:2,40` | `boot.manifest.modes.forEach((m) => perspectiveRegistry.register(m))` — the **only** consumer of `manifest.modes` in the codebase. |
| `apps/geostat/src/data/site-manifest.ts:39,52` + `:110` | runner refines `modes: PerspectiveOption[]`; `emptyManifest()` returns `modes: []`. |
| DB: `config.site_config` key `'modes'` | **Not** seeded by Flyway. V5 seeds only base config (`name`/`default_locale`/…). The `modes` row is written by `runProvisioning` → `upsertSiteConfig` from `apps/api/provisioning/geostat.provisioning.json:4124`, which holds **three** kinds: `year`, `range`, **`compare`**. |

**Three facts that decide everything (none derivable from the docs):**

1. **The channel is a write-with-no-read.** The geostat runner derives its perspective-bar from the authored `page.perspectives` axis (decision B / P5.2), **not** from `perspectiveRegistry`. The registry's only readers — `apps/panel/.../EnumRefField.tsx:64`, `features/visibility/VisibilityBuilder`, `constructor.ts:138` — are all in the **panel (Constructor)**, and the panel populates the registry via its **own hardcoded** `apps/panel/src/canvas/setupCanvasRegistry.ts:45-46` (`year`/`range`), **never** from `manifest.modes`. So `manifest.modes → perspectiveRegistry.register` in App.tsx writes a registry that nothing in the runner process ever reads, and the consumer that *does* read it ignores this channel.

2. **`compare` is rot.** `site_config.modes` lists a `compare` kind whose machinery (`ScopeOverride.compare`, `resolveCompareRows`, `RenderContext.compareRows/Label`) was fully grep-zero-deleted in this batch (REVIEW §"No stubs"). The site registry has drifted from reality — concrete evidence it is not load-bearing.

3. **`upsertSiteConfig` is upsert-only** (`apps/api/src/provisioning/upsert.ts`; never deletes keys absent from the artifact) and **provisioning runs on every api boot, AFTER Flyway** (DEPLOY.md:7). So (a) a prod `modes` row survives forever unless explicitly DELETEd, and (b) a Flyway DELETE alone is undone the same boot if the artifact still carries `modes`.

**DB head: V34** (`ops/postgres/migrations/V34__gdp_dsd_approach_align.sql`; prod compose comment confirms "V1→V34"). **Next forward-only number = V35.** (DEPLOY.md §3's "V1→V31" string is stale — note to fix, not load-bearing.)

---

## 2. Decision — DELETE-THE-ISLAND (not rename to `perspectiveKinds`)

**Recommendation: delete the field + the channel; let `page.perspectives` be the sole SSOT.** Open a named deferred door for the genuinely-future need.

### Why not the rename the docs planned

The FULLSTACK doc planned `modes → perspectiveKinds` to preserve "the registry half of the registry↔instance split." That split is a real, load-bearing pattern — but the **site-scoped delivery of it via `manifest.modes` is wired to the wrong consumer**:

- The runner (App.tsx) consumes the channel but **never reads** the registry it fills.
- The panel **reads** the registry but populates it from a **different** path (hardcoded `setupCanvasRegistry`), ignoring the channel.

A rename would faithfully preserve a pipe that delivers to a dead end, under a new name. That is exactly the "keep a privileged-vocab island alive because a doc once planned a rename" trap. Renaming polishes a write-with-no-read; it does not make it load-bearing.

### Why delete is clean (canon)

- **SSOT (Law 1 / no privileged vocab):** `page.perspectives` (PerspectiveAxis → PerspectiveDef, carrying `label`/`icon`/`scope`/`when` per page) already fully describes what the runner renders. The site `modes` list is redundant with it for every live runner read. Deleting removes the *second* source.
- **YAGNI / KISS:** don't keep (or rename-preserve) a site-scoped delivery channel until its real consumer exists. The panel — the only registry reader — doesn't use it today.
- **De-tenant-clean:** `year`/`range`/`compare` are tenant content; deleting `manifest.modes` removes a *redundant* tenant-delivery channel while the per-page channel (`page.perspectives`, correctly delivered per page) remains the SSOT. No tenant content leaks back into the runner.
- **Makes the claim honest:** this is the one survivor that made "grep-clean ALL System A" true only inside its declared grep scope. Deleting retires the `mode` *name* on the last live contract surface.
- **The registry capability is untouched:** deleting the manifest *channel* does not delete `perspectiveRegistry` (the singleton) — the panel's palette keeps working via `setupCanvasRegistry`.

### The deferred door (named, fitness-locked-shut)

**D-PERSPECTIVE-KINDS** — *a tenant-driven panel palette.* When the platform wants to de-tenant the panel's **hardcoded** `setupCanvasRegistry` year/range (REVIEW LOW-4), the correct design is a site-scoped kinds vocabulary sourced for the **panel** consumer (from the union of pages' authored perspectives, or a dedicated kinds read) — *not* the runner-targeted channel we are deleting. Trigger: a real second tenant whose panel palette must differ from year/range. Until then, this stays shut. (This is where the FULLSTACK `perspectiveKinds` idea correctly lands — re-homed from the dead runner channel to the live panel consumer.)

**Trade-off named (ISO 25010):** we trade a sliver of *extensibility* (a pre-built, unused tenant-kinds channel) for *maintainability + analysability* (no write-with-no-read, no `mode` vocabulary island, honest grep-zero) and *modifiability* (the future need gets a consumer-correct design, not an inherited misdirection). Reversible: the door re-opens additively when its real caller appears.

---

## 3. Expand-contract sequence (each step independently green + typecheck-safe)

Parallel-change: relax the contract first (two-way doors), drop consumers, then contract the type, then the data. No intermediate state is un-typecheckable, and bootstrap's `DEFAULT_MODES`/absent-key default makes every partial-deploy ordering harmless.

**S1 — Contract (expand/relax).** `packages/contracts/src/manifest.ts`: make `modes?: ManifestMode[]` **optional** (keep `ManifestMode` for now). Postel: api may stop sending it; the runner still compiles. Non-breaking, two-way door. *Green:* whole tree typechecks (every reader already array-guards).

**S2 — Runner consumer.** `apps/geostat/src/app/App.tsx`: delete the `boot.manifest.modes.forEach(register)` line + the `perspectiveRegistry` import if now unused. `apps/geostat/src/data/site-manifest.ts`: remove `modes` from the `Omit<…>` list and drop the `modes: PerspectiveOption[]` field; drop `modes: []` from `emptyManifest()`; remove the now-unused `PerspectiveOption` import. *Green:* runner neither reads nor declares `modes`; nothing in the runner render path regresses (it reads `page.perspectives`).

**S3 — api/bootstrap.** `apps/api/src/routes/bootstrap/index.ts`: remove the `ManifestMode` import, `DEFAULT_MODES`, `SITE_KEY.modes`, the `const modes = pick(…)` line, and `modes` from the `manifest` object literal. Bootstrap stops serving the field (absent key → simply not emitted). *Green:* api typechecks; `SiteManifestContract.modes` is optional so omission is legal.

**S4 — Tests + the locking fitness guard.**
- `apps/api/src/routes/bootstrap/bootstrap-parity.fitness.test.ts`: drop `['modes','modes']` from `blobKeys` and `modes` from the `BootstrapManifest` interface.
- `apps/geostat/.../site-manifest.test.ts:40`: drop the `modes` assertion.
- **NEW grep-zero fitness guard** (extend the P6 acceptance scope the review flagged): a source-scan test asserting **zero** occurrences of `ManifestMode`, `SiteManifestContract.modes` / `.modes:` on the contract, `DEFAULT_MODES`, and a `site_config` `'modes'` key — across `packages/contracts/**` + `apps/api/**` + `apps/geostat/**` (the tiers the original grep-zero excluded). Wire it into `ops/scripts/check-laws.sh` (already open in the working tree) so the name cannot silently return. *Green:* guard passes only once S1–S6 land.

**S5 — Contract (contract).** `packages/contracts/src/manifest.ts`: delete the `ManifestMode` interface and the `modes?` field from `SiteManifestContract` entirely. *Green:* no consumers remain (S2/S3 removed them); grep-zero true in contracts.

**S6 — Provisioning artifact (co-ships with S7 — mandatory).** `apps/api/provisioning/geostat.provisioning.json`: remove the `{ "key": "modes", "value": [...] }` siteConfig entry (lines ~4123-4145). **Required:** because `upsertSiteConfig` re-applies the artifact on every api boot *after* Flyway, leaving this entry would resurrect the row S7 deletes, on the same boot.

**S7 — Flyway migration (the one-way door).** NEW forward-only **`ops/postgres/migrations/V35__drop_site_config_modes.sql`**:

```sql
-- V35 — retire the System-A `modes` site_config vocabulary island (MED-2).
-- Forward-only, idempotent: DELETE of an absent row is a no-op. No schema change.
-- The kinds vocabulary is superseded by per-page `page.perspectives` (SSOT);
-- the surviving prod row is orphaned data (no live reader). Flyway-immutable:
-- never edit once applied — a correction is a new V-migration.
DELETE FROM config.site_config WHERE key = 'modes';
```

Carry the standard migration header (09 §B risk gate). No `COMMENT`/DDL — pure data cleanup. Honors **Flyway 10**: `clean` is disabled (`flyway/flyway:10-alpine`, `migrate`-only, `-locations=filesystem:/flyway/sql`, single default schema) — a forward DELETE is the *only* sanctioned removal in prod; no clean+reseed.

---

## 4. Risk + reversibility ledger

| Step | Door | Rollback |
|---|---|---|
| S1–S6 (code + artifact) | **Two-way** | `git revert`; rebuild image. No data touched. |
| S7 (V35 DELETE) | **One-way** (Flyway-immutable) | Cannot un-apply. But the deleted data is **trivially reconstructible** (3 static kinds, also in panel `setupCanvasRegistry` + artifact git history). Practical rollback = a new forward V36 re-inserting the row, or re-provision from an older artifact. Risk: **LOW**. |

**Why the one-way door is low-stakes:** bootstrap defaults `modes` to `[]` when the key is absent, and the runner does not read the registry it would fill. So even a *partial* deploy (V35 runs while old code is still live) is harmless: old runner serves `modes: []`, registers nothing, renders identically (bar comes from `page.perspectives`). There is no ordering in which deletion breaks a live surface.

**Must be true on the deploy server (builds from `main`) before V35 runs:**
1. **S6 (artifact edit) is in the deployed api image.** This is the hard precondition — Flyway runs before api provisioning on every boot; if the artifact still carries `modes`, `upsertSiteConfig` re-inserts the row immediately after V35 deletes it. S6 + S7 + the api image **must ship in the same release**.
2. S1–S5 merged to `main` and built into both app images (so no consumer expects the field).
3. Confirm `now at v35` after the Flyway step; confirm `GET /api/bootstrap` no longer emits `modes` and the site renders (the perspective-bar still toggles year/range from `page.perspectives`).

No prod data backfill, no downtime, no read-path dependency — V35 is a single idempotent row delete.

---

## 5. Recommendation + effort

**DO IT this release.** Delete-the-island (not rename). It closes the last System-A vocabulary survivor, removes a write-with-no-read, and makes the batch's "grep-clean ALL System A" claim literally true. The genuinely-future need (tenant-driven panel palette) is parked behind **D-PERSPECTIVE-KINDS**, to be designed for the panel consumer when a real second tenant demands it — a cleaner design than renaming a dead runner channel.

**Effort: ~1.5–2 h.** Net deletion. ~6 code files (contract, runner type, App.tsx, bootstrap index, 2 test edits) + 1 new ~10-line grep-fitness guard + 1 artifact edit + 1 new ~6-line V35. The only gated step is the DB-backed `bootstrap-parity.fitness.test.ts` (runs in CI with `DATABASE_URL`; `describe.skip` locally). Greenlight needed only for S7 (the one-way DB door) — S1–S6 are reversible and can land first.

---
name: i18n-label-completeness-gate
description: i18n labelCompleteness fitness (plugins authoring labels) + where bilingual authoring schemas may live (Law-4/no-tenant-content rules) + the gen:schema drift coupling
metadata:
  type: project
---

**labelCompleteness fitness (`plugins/__tests__/labelCompleteness.fitness.test.ts`, X-3/CON-14):** asserts every shipped authoring label (META.label, PropField.label, option.label, group.label, slot.label) is a COMPLETE LocaleString over active locales. Discovery SSOT = `plugins/authoring-metas.ts` (a PURE, COMPLETE roster importing every `default/meta.ts` directly). Do NOT reuse `catalog.ts`/`PALETTE_META`: catalog re-exports SHELL barrels (pulls React/Leaflet → "window is not defined" in node env) AND PALETTE_META omits layout + chrome metas (which carry offenders). Locale set is DERIVED (union of all object-form label locales) + a ≥2 bilingual floor — no hardcoded 'ka'/'en' in the gate. Offenders migrate from bare `'სათაური'` → `{ ka:'სათაური', en:'Title' }` (single-line inline `{ka,en}`).

**Law-4 placement of bilingual authoring schemas — three valid homes:**
- `packages/core/src/config/*-schemas.ts` (param/rowspec/visibility/perspective-scope/op): bilingual, but REQUIRE an ALLOW entry in BOTH `ops/scripts/check-laws.sh` (`LAW4_CATALOG_ALLOW`) AND `platform/tests/no-tenant-content.fitness.test.ts` (`ALLOW` set). `dataIntegritySchema.ts` (in plugins!) is also ALLOW-listed.
- `packages/plugins/**/meta.ts` and `**/*Node.ts`: AUTO-exempt from no-tenant-content TIER-2 (`isCatalogClass` matches `meta.ts$`/`Node.ts$`).
- `apps/**`: NOT scanned at all (no-tenant-content walks `packages/` only).

**Gotcha:** `check-laws.sh` (bash) exempts inline `{ka,en}` lines (has an `en:` sibling) but the vitest `no-tenant-content` TIER-2 flags ANY Georgian script in non-catalog-class `packages/` files regardless of `en:`. So a bare core file with bilingual labels passes bash but FAILS vitest. For a NEW authoring schema whose sole consumer is the panel Inspector, place it in `apps/panel` (co-located with its FieldControl) — keeps the runtime contract in core (type + resolver), avoids both ALLOW edits. This is how value-mappings is split (see [[value-mappings-architecture]]).

**gen:schema drift coupling:** changing any plugin node/panel PropField LABEL re-emits `packages/contracts/schema/page-config.schema.json` (the emitter resolves labels → JSON-schema `title`). `plugins/nodes/__tests__/page-config-schema.fitness.test.ts` asserts live==committed, so you MUST run `pnpm gen:schema` after label edits — even though the artifact is in `contracts/` (a GENERATED file, not hand-authored).

See also [[plugins-shell-test-harness]].

---
name: variant-style-spine
description: ADR shell-variant-style-spine P0+P1 — VariantDef/resolveVariants/variantAttrs seam; section hero+compact→emphasis enum data-attr; styleKeys SSOT; v3→v4 migrator; FF-NO-VARIANT-CLASS
metadata:
  type: project
---

The shell layer finished the data-attr spine for variants (it was the lone escapee from `resolveViewState`/PresentationProjector). A shell now writes ZERO inline variant→class logic and ZERO bare BEM-modifier strings.

**Why:** ADR adr_shell_variant_style_spine (architect). The canonical offender was `SectionShell.tsx:95-99` `[...].filter(Boolean).join(' ')` computing `section--hero`/`section--compact`. Reconception not relocation: a NEW variant = declare a VariantDef in meta + a CSS rule → zero shell code.

**How to apply (the seam, all reusing existing machinery):**
- `VariantDef`/`VariantSchema` live in `react/src/engine/variant-meta.ts` (NOT slice-meta.ts — that file is at its 400-line bloat ceiling; variant-meta re-exported through slice-meta + types/slice). `NodeSliceMeta.variants?: VariantSchema`. Authored values: `NodeBase.variants?: Record<string,string|boolean>` (generic bag, zero privileged keys, like `presentation`/`vars`).
- `resolveVariants(schema, authored) → Record<string,string>` lives in `@statdash/styles/resolvers/variant.ts` BESIDE `resolveViewState`. Styles is arrow-below-react so it owns STRUCTURAL `VariantSchemaShape` (engine's VariantSchema satisfies it by structure — same trick as ViewStateAttrs). flag→presence(''), enum→value, falsy/absent→omit.
- `defineShell({ variants, render })` resolves `variantAttrs = resolveVariants(config.variants, def.variants)` centrally (alongside vs/merged/placement) and passes it via `ShellProps.variantAttrs`. Shell spreads `{...variantAttrs}` on the block element; chooses WHICH element only.
- `variantPropSchema(meta.variants) → PropField[]` (mirrors presentationPropSchema): enum→string+options, flag→boolean, field `variants.<name>`. **`nodeSchemaWithVariants(base, variants)` is the ONE schema-folding SSOT** — registerSlice AND the emit-schema build tool (`react/scripts/emit-page-config-schema.ts`) AND `page-config-schema.fitness.test.ts` ALL route through it, else half-registration (F3). The emit tool registers `schema: m.schema` directly, NOT via registerSlice — easy to miss.
- Dot-path PropFields FLATTEN as top-level keys in generatePageConfigSchema (`"variants.emphasis"`, NOT nested) — `propSchemaToJsonSchema.ts` §17.

**Section exemplar (P1):** two booleans `ViewParams.hero`+`compact` collapsed into ONE `emphasis: 'hero'|'compact'` enum (illegal `hero&&compact` now unrepresentable). `ViewParams.hero`/`.compact` + VIEW_DEFAULTS.compact DELETED. `section.css` `.section--hero`→`.section[data-emphasis="hero"]` (same specificity class → byte-identical cascade with `--sc`/`[data-tenant]`/`[data-theme]`). `styleKeys.ts` (SECTION.block/body/view/drillLabel) is the typed static-class SSOT (ADR chose this over CSS Modules — hashing breaks byte-identity). sectionKeys.ts (accent/state-key helpers) is SEPARATE and stays.

**Migration:** CURRENT_SCHEMA_VERSION 3→4 in `core/src/config/migration.ts`; v3→v4 migrator rewrites section `view.hero:true`→`variants.emphasis:'hero'`, `view.compact:true`→'compact', recursive, hero wins, authored emphasis canonical. Provisioning `geostat.provisioning.json` accounts page (sna-hero, sna-hero-range) rewritten inline + schemaVersion bumped 2→4. Bumping a provisioning page's version means it must already be in that version's shape for ALL prior steps (no georgraph left anywhere, presentation.color already set). Tests hardcoding `schemaVersion).toBe(3)` across apps/api + core had to move to CURRENT_SCHEMA_VERSION.

**Fitness:** `section/default/variant.fitness.test.ts` — FF-NO-VARIANT-CLASS (no `--` modifier string / no `.filter(Boolean).join` in SectionShell.tsx; positive `{...variantAttrs}`), FF-VARIANT-DECLARED (strip CSS comments FIRST then every `[data-*]` selector ↔ a VariantDef.attr; allowlist data-view/height/aspect/hover/focus/active/print-hide as style-spine attrs), FF-VARIANT-SCHEMA-ROUNDTRIP (variants.emphasis enum reaches the section $def). `styles/resolvers/variant.test.ts` unit-tests the resolver. `core/config/migration.emphasis.test.ts` (split out — migration.test.ts at bloat ceiling).

Gates green: build:engine+geostat+panel, typecheck, lint(0 err/38 pre-existing react-refresh warns), gen:schema (artifact regenerated — variants.emphasis now in page-config.schema.json), test 1146 passed (was 1121). See [[presentation-registry]] [[registry-over-special-case]].

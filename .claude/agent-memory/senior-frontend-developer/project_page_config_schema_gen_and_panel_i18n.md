---
name: page-config-schema-gen-and-panel-i18n
description: Two panel gotchas — page-config.schema.json must be re-emitted (gen:schema) after ANY node/presentation-projector schema edit, and the panel's chrome-string i18n pattern (local {en,ka} map + t() + useActiveLocales).
metadata:
  type: project
---

## page-config.schema.json is a GENERATED artifact — re-emit after schema edits
`platform/packages/contracts/schema/page-config.schema.json` embeds EVERY node schema
(and presentation-projector schema) as `$defs`, generated from the live registry. Editing
a node's `Schema` (label/reorder/add field) OR a presentation projector's `schema()` makes
the committed artifact DRIFT. Guard: `page-config-schema.fitness.test.ts` "the live generator
output equals the committed artifact (no drift)" (`generatePageConfigSchema()` vs the file).

**Re-emit with `pnpm gen:schema`** (from `platform/`; runs `@statdash/react`'s
`tsx scripts/emit-page-config-schema.ts`) and commit the regenerated JSON. It bit me on a
grid-schema relabel (I only ran `grid.fitness`, not the schema-drift gate) — the drift only
surfaced when the presentation/page-config suite ran. `plane`/`concern` PropField tags are
inspector-only and do NOT appear in the JSON schema; `label`(→`title`), field order,
`default`, `options`(→`enum`) DO. See [[reference_panel_dev_notes]].

## Panel chrome-string i18n pattern (Law 4, no react-i18next in these layers)
The inspector-controls + studio-chrome layers have NO `useTranslation`/`t()` catalog. The
established Law-4-clean pattern (RightDock, FocusView, and now PageBrowser/StyleField/
PerspectivesPane):
- a module-local `const T = { key: { ka, en }, … } as const` + `const t = (k, locale) => T[k][locale] ?? T[k].en`, OR inline `{ ka:'…', en:'…' }[locale] ?? '…'` for one-offs;
- the active primary locale = `useActiveLocales()[0] ?? 'ka'` (driven by the SITE's
  `defaultLocale`/`activeLocales`, NOT i18next `lng`). `ka` is the platform base UI locale —
  every packages/plugins node schema label is bilingual `{ka,en}` (a lone en-only label, e.g.
  the old `colorProjector` "Page color", is the odd-one-out that leaks English into the ka dock).
- field controls read a `LocaleString` label via `readLocale(field.label as never, locale)`.

**Gotcha:** a MUI `<Tooltip title="X">` emits an aria-label "X" on its trigger; if the wrapped
`IconButton` also has `aria-label="X"`, `getByLabelText('X')` finds MULTIPLE. Make the button's
aria-label DISTINCT + more descriptive than the short tooltip (better for SR too).

## ColorControl is now ON the DTCG spine (updates [[project_panel_ui_kit_and_rail]])
The native `<input type=color>` (dishonest `#000000` default, unthemed) was replaced by a
themed `.insp-swatch` bound to GLOBAL `--color-*`/`--radius-*`/`--spacing-*` tokens (dark-safe):
empty = a "no-colour" checkerboard + bilingual "Not set", native OS picker opens from neutral
grey. The surrounding native inputs (`.insp-field__input/__select/__json`) still ride the
UNDEFINED `--insp-*` fallbacks — that erosion remains for a future inspector re-paint.

---
id: "0049"
title: "BI-B1: `[object Object]` map subtitle — localize codelist labels at the derive boundary (thread `locale` into DeriveContext)"
status: backlog
class: M
priority: P0
owner: —
implements: SPEC.DELTA-new12 §2 Bug 1, §3 axis-4 (I-7), §5 FF-DERIVE-LOCALIZES-LABELS / FF-NO-LOCALESTRING-TO-STRING
depends_on: ["0044"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — The Regional map panel subtitle must render the localized region name (not literal `[object Object]`) whenever a region is selected (img_9/10/11). Establish the localize-at-boundary law (I-7) across the derive layer.

**Implements** — SPEC.DELTA-new12 §2 Bug 1 + axis-4 (locale as a first-class axis, invariant I-7). Root-cause fix at the one seam that bypassed the LocaleString SSOT.

**Root cause** — `packages/core/src/config/filter-derive.ts:163`, the `join-labels` op:
```ts
.map((id) => { const r = src.find((x) => x[idKey] === id); return r ? String(r[lblKey] ?? id) : id })
```
The `label` field in the `geo` codelist is a `LocaleString` `{ka,en}`. `String(localeStringObj)` → `"[object Object]"`. The geograph `label` template is `{_regionTitle}` (prov. 3914–3917); `_regionTitle` is a `join-labels` var (prov. 4494–4504). `resolveTemplate` (template.ts:77–79) *would* resolve a substituted LocaleString — but join-labels has already `String()`-flattened it before it reaches the template, so the object-guard never fires. Same latent flaw in `breadcrumbs` (`filter-derive.ts:147`) and in `find`+`field` when the field is a LocaleString. In the all-regions state the label is empty (`""` fallback), which is why the earlier 6 shots looked fine.

**Files / modules touched**
- `packages/core/src/config/filter-derive.ts` — `join-labels` (line 163) and `breadcrumbs` (line 147): resolve each label with `resolveLocaleString(r[lblKey], locale, locale)` before joining. No `String()` on a `{ka,en}` bag. `find`+`field` on a LocaleString field: same guard.
- `packages/core/src/config/evalVarMap.ts:29-33` — thread `locale` into `DeriveContext` (today `scope.ctx` passes `classifiers/display/raw` but NOT `locale`); source from `SectionContext.locale`.
- Cross-check GAP-L (O-14 / 0044): if the EN data-category gap is render-boundary (not a seed gap), the legend/tile/cell path funnels through the same resolution.

**Dependencies** — 0044 (O-14: settles whether GAP-L is a render-boundary or seed cause; if render-boundary it folds into this sweep). Relates to I-7 (locale axis).

**Acceptance criteria (incl. fitness functions)**
- [ ] Region-selected map subtitle renders the localized name (KA and EN), never `[object Object]`.
- [ ] A single-select `join-labels` yields ONE localized string; a multi-select joins localized strings with the separator; `breadcrumbs` and `find+field` likewise localized.
- [ ] No `String(<codelist label>)` anywhere in the derive layer; `locale` present in `DeriveContext`.
- [ ] **FF-DERIVE-LOCALIZES-LABELS**: `join-labels`/`breadcrumbs`/`find+field` resolve a LocaleString label via `resolveLocaleString(locale)`.
- [ ] **FF-NO-LOCALESTRING-TO-STRING**: static + runtime — no `String(x)`/template-flatten where `x` may be a LocaleString, across engine+plugins (legend/tile/cell included).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — This is the localize-at-boundary law (I-7): every label — chrome, section, KPI, AND data-derived codelist-joined — funnels through `resolveLocaleString`. The derive ops were the one seam that bypassed it. Land after BI-B3, before BI-B2. Two-way door.

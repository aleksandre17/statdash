---
title: Element Config Schema Seam (per-slice, ISP-clean)
status: Proposed
date: 2026-06-23
authors: architect (Opus)
migrated_from: adr_element_config_schema_seam
---

# ADR-009 — Element Config Schema Seam

**Status:** Proposed.

## Context

Shared/base config types accumulate one element's props (e.g. `ChromeConfig.brandTitle`), bloating the base and forcing every element to carry fields it does not use — an ISP/OCP violation. There is no per-slice schema seam, so adding one element's concern widens a type everyone depends on.

## Decision

- **Kill shared-base bloat:** keep the base minimal; move element-specific fields to per-slice schemas consumed via `useSlotConfig`.
- **Enforce with a base-minimality fitness function** so a new element's props cannot leak into the shared base.
- Recorded verdicts for the controls slice and the KPI slice.

## Rejected Alternatives

1. **One shared base config carrying every element's props (status quo)** — REJECTED: violates ISP (elements depend on fields they don't use) and OCP (a new element widens the base); the base must stay thin.
2. **A single monolithic per-page config type** — REJECTED: couples unrelated slices; per-slice schemas keep each element's contract cohesive and independently evolvable.

## Consequences

- Positive: thin base, cohesive per-slice schemas, ISP/OCP restored; the Constructor inspector reads per-slice schemas cleanly.
- Negative / cost: a migration of existing base fields into slices; a fitness function must guard base minimality.
- Fitness function: base-minimality assertion.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# ADR — Per-Element Config Schema Seam (kill shared-base bloat)

Status: PROPOSED (2026-06-23). North star: one consistent authoring seam for ALL slice kinds (node/page/panel/chrome/control), enforced so the easy-path (a god-config) is structurally impossible.

Related: [[adr-constructor-phase2]] (the PropSchema/Inspector seam this extends to chrome), [[project_catalog_react_purity]] (palette already reads registry metas).

---

## Context — the trigger and what already exists (verified on disk 2026-06-23)

An agent added `brandTitle` + `sectionsLabel` to `platform/packages/react/src/context/ChromeConfig.ts` (lines 32-33). Grep proves they are read by EXACTLY ONE consumer: `inner-sidebar/default/InnerSidebarShell.tsx`. They sit on a type injected app-wide via `SiteProvider.chromeConfig` and read by every chrome shell through `useChromeConfig()`. So every chrome consumer's type now carries one element's private concern.

- **ISP violation**: `app-header`, `app-footer`, `locale-switcher` all depend on a `ChromeConfig` shape fattened with sidebar-only fields they never use.
- **OCP violation**: adding the next chrome element's content = editing the shared base again. The base grows without bound; "new element" is not "new code", it is "widen the shared type".
- **Inconsistency**: nodes and panels already declare their OWN config via `schema: PropSchema` in `meta.ts` (15/17 node metas do — e.g. `GeorgraphSchema`). Chrome having a god-config while nodes have per-slice schemas is the drift to eliminate.

**The seam already exists and is HALF-WIRED for chrome — this is a closing-the-seam task, not a build:**

1. `slice-meta.ts` already defines `ChromeSliceMeta` WITH an optional `schema?: PropSchema` field (line ~349). It is declared and never populated.
2. `chromeRegistry.register(slot, key, shell, meta)` already stores the full `meta` (incl. `schema`); `getMeta()` / `listMeta()` already expose it for the Inspector.
3. `ChromeSlotConfigContext` already exists: `useSlotConfig<T>()` reads per-instance config injected by `ChromeRegion`/`ChromeSlot` from `ChromeSlotConfig.config` (`Record<string,unknown>`), which is JSON-serializable and Constructor/JSONB-ready. `ChromeSlotConfig` is already a field on `ChromeEntry` in `SiteManifest.chrome` / page chrome.

So the storage path (per-slot `config` in the manifest), the read path (`useSlotConfig`), the schema declaration (`ChromeSliceMeta.schema`), and the Inspector source (`chromeRegistry.getMeta().schema`) ALL exist. `brandTitle`/`sectionsLabel` simply took the shortcut of riding the global `chromeConfig` instead of the per-slot `config`.

---

## Decision

### D1 — Per-element config lives on the element's own PropSchema + per-instance `config`, read via `useSlotConfig`

A chrome element that needs element-specific content declares it in its `meta.ts` as `schema: PropSchema` (identical mechanism to nodes/panels) and reads its OWN typed config via `useSlotConfig<T>()` — NOT via `useChromeConfig()`.

- `inner-sidebar/default/meta.ts` gains `schema: InnerSidebarSchema` declaring `brandTitle` (LocaleString, localized) + `sectionsLabel` (LocaleString, localized).
- `InnerSidebarShell` reads `const { brandTitle, sectionsLabel } = useSlotConfig<InnerSidebarConfig>()` instead of `useChromeConfig()` for those two fields.
- Stored in `SiteManifest.chrome.InnerSidebar = { variant: 'default', config: { brandTitle: {...}, sectionsLabel: {...} } }`.
- The Inspector renders these automatically: `chromeRegistry.getMeta('InnerSidebar', key).schema` → the SAME generic property-panel renderer that consumes `NodeRegistry.getSchema()` (the Inspector seam from [[adr-constructor-phase2]]). One Inspector, all slice kinds.

This is GRASP Protected Variations: the per-slice `schema` is the stable seam where "what this element needs" varies; the shared base and the Inspector never change when a new element is added.

### D2 — What stays on the THIN `ChromeConfig` base — only genuinely cross-cutting brand identity

Verified by grep of every chrome shell. Keep on the base ONLY what is shared site identity consumed across multiple shells, not one element's content:

KEEP (cross-cutting, site-level singletons — there is one logo, one copyright line, one locale-label map per site):
- `logoUrl`, `logoAlt` — read by `app-header` (and any future branded shell). Site identity.
- `copyright` — read by BOTH `app-footer` AND `inner-sidebar`. Genuinely shared → base is correct (moving it per-element would duplicate it).
- `localeLabels` — read by `locale-switcher`; conceptually site-wide i18n display map (one per site, not per switcher instance). Borderline; see D2-note.
- `socialLinks`, `footerLinks` — borderline (see D2-note).

MOVE OFF the base onto per-element schema:
- `brandTitle`, `sectionsLabel` → `inner-sidebar` schema (the trigger). Single consumer, element-private.

**D2-note (the discriminating rule):** a field stays on the base ONLY if it is (a) read by ≥2 distinct shells OR (b) a true site-level singleton that any future shell of that category would reuse (logo, copyright). A field read by exactly one element AND semantically that element's own content is element config. By this rule `socialLinks`/`footerLinks` are SUSPECT: each is read by exactly one shell (`app-header`, `app-footer` respectively) and is that element's content. They predate this ADR and ship today; the ADR's position is they SHOULD migrate to per-element schema in the same wave (Phase B), but they are lower-severity than the trigger because they are at least cohesive with a single element. `copyright` and `logo*` legitimately stay. This makes the base = pure cross-cutting site identity.

### D3 — Controls (ParamCascade/ParamRange) and KPI — apply the same lens, decide per case

The discriminating question is always: *is this prop on a type that is ALREADY the element's own per-element type, or on a SHARED base that multiple elements depend on?*

- `ParamCascade.allLabel`, `ParamRange.fromLabel`/`toLabel`, `ParamRange.unit` — **LEGITIMATE, no change.** These live on `ParamCascade` / `ParamRange`, which ARE the per-element (per-control-type) interfaces in the `ParamDef` discriminated union. They are NOT on the shared `ParamMeta` base. `allLabel` on `ParamCascade` is exactly the per-element pattern this ADR endorses — it is the cascade's own config type. Putting `allLabel` on `ParamMeta` (the shared base) WOULD be the violation; it correctly is not there. The discriminated union is the control equivalent of per-slice schema. This is the consistent answer: per-type config on the per-type interface is the GOOD pattern.
- `GeorgraphNode` schema `unit` — **LEGITIMATE, no change.** It is on `GeorgraphSchema` (the node's OWN PropSchema), the canonical target pattern.
- `KpiCard.trendLabels` — **LEGITIMATE, no change.** It is a React component PROP on `KpiCardProps` (a leaf presentational component), supplied by its parent shell from `useT('kpi-strip')`. It is element-private by construction (not on any shared config/context), with a WCAG-safe fallback. Correct.

So D3's verdict: the controls/KPI additions are the RIGHT pattern already — they put element-specific data on per-element types, not on a shared base. Only `ChromeConfig` took the shortcut of bloating a shared, app-wide-injected base. The fix makes chrome consistent with what controls/nodes already do.

### D4 — Enforcement: a fitness function that caps the shared base + ESLint guard

Make "element-specific props live on element schemas, never on a shared base" enforceable, not aspirational.

**F1 — ChromeConfig base-minimality fitness test** (`packages/react/src/context/ChromeConfig.fitness.test.ts`): asserts the `ChromeConfig` interface contains ONLY an allow-listed set of cross-cutting field names (the D2 KEEP list). Any new field added to `ChromeConfig` fails the build with a message pointing the author to "declare it on the element's `meta.ts` `schema` instead." The allow-list is the SSOT for "what is genuinely cross-cutting" — growing it is a deliberate, reviewed act (a one-way door made visible), not a silent shortcut. Parse the interface via the TS AST (ts-morph) or a tolerant regex over the field block, mirroring the existing `contracts.fitness.test.ts` style.

**F2 — chrome-element single-consumer fitness test**: for each field on `ChromeConfig`, grep the chrome shells; if a field is read by exactly ONE shell, fail (it belongs on that shell's schema). This catches the next `brandTitle` automatically and would flag `socialLinks`/`footerLinks` until Phase B migrates them (seed the test with a temporary, ADR-referenced waiver list that Phase B empties — make the debt visible and expiring).

**F3 — generalize: shared-base bloat guard** (the platform-level capability, skill §11 platform-thinking): a fitness test that, for each registered base/context config type (`ChromeConfig`, and extensible to other shared contexts), enforces the "≥2 consumers or site-singleton" rule. This is the reusable enforcement of the anti-pattern beyond chrome. Encode the rule as data (a registry of `{ type, allowlist }`) so a new shared type opts into the guard by one line.

ESLint complement (cheap, fast feedback): a `no-restricted-syntax` rule forbidding new optional properties on `ChromeConfig` outside the allow-list is possible but brittle; prefer the fitness test as the authoritative gate (it understands semantics), with the ESLint arrow-rule (`no-restricted-imports`) already guarding the dependency direction.

---

## Consequences

- ISP restored: each shell's type carries only its own concern. OCP restored: a new chrome element = a new `meta.ts` + schema, zero edits to `ChromeConfig` or the Inspector.
- One Inspector renders every slice kind (node/panel/chrome/control) from `schema` — the Constructor authoring flow for chrome comes "for free" by reusing the populated seam.
- The base becomes the documented home of TRUE site identity only; "is this cross-cutting?" has a test as its answer.
- Migration cost: small (2 fields + 2 borderline). Round-trip/locale-coverage fitness already exists and will validate the moved `LocaleString` fields.
- Trade-off (ISO 25010): +Maintainability (modifiability, modularity), +Analysability (the base now self-documents what is shared); small −Simplicity for the single-consumer case (a sidebar dev now writes a schema instead of one base field) — accepted, because consistency with nodes/controls and OCP outweigh the one-field convenience, and the Inspector payoff is large.

## Rejected alternatives

1. **Keep `brandTitle`/`sectionsLabel` on `ChromeConfig` (the status quo / easy path).** Rejected: ISP+OCP violation, diverges from the node/panel/control per-element pattern, unbounded base growth, no Constructor authoring path (the global `chromeConfig` is not per-slot-editable). This is the violation, not a fix.
2. **A `ChromeConfig.sidebar?: {...}` nested namespace per element.** Rejected: still on the shared base (every consumer's type still grows per element = OCP violation), still not the registry/schema seam, still no generic Inspector. It is the god-object with folders.
3. **A second parallel context `SidebarConfigContext` (and one per element).** Rejected: context proliferation, no discovery, no Inspector integration, reinvents `useSlotConfig` which already exists for exactly this. Violates SSOT (two config-injection mechanisms).
4. **Move EVERYTHING off the base (incl. logo/copyright) onto per-element schemas.** Rejected: `copyright` is read by 2 shells and `logo*` is site identity any branded shell reuses — forcing them per-element duplicates a site singleton (DRY/SSOT violation). The rule is "≥2 consumers or singleton stays", not "nothing shared".

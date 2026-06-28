# Styles Architecture — Canonical Placement, De-branding & Dead-code

> **Companion to `DESIGN-css-responsive-standard.md` (a985), not a competitor.** a985 owns the *responsive
> axis* (breakpoint SSOT→CSS, mobile-first, container-first, fitness fns, the decorative magic-literal
> sweep = its S2). **This doc owns the orthogonal *placement axis*** — WHERE each style canonically lives
> (ownership), brand-neutrality of the shared layers (de-brand), dead-code, duplication. Collisions named
> in §6. Reference-grounded: Material 3 / Open Props / GOV.UK (token tiers), shadcn / Grafana PanelChrome
> (co-location), Builder.io / SLDS (tenant theming via role tokens).
>
> **Read-only design.** Execution is sequenced AFTER a985's in-flight edits; every plan item is written
> against the *post-a985* tree.

---

## 0. Executive summary

**Canonical spine:** 4 layers by ownership — **L0 tokens** (brand-neutral SSOT; only home for raw
hex/px/font-family) → **L1 framework globals** (the data-attribute engine, reset, a11y/slot/region, keyframes
— "any node can wear it") → **L2 component-local** (each shell/node/panel owns its CSS + breakpoints,
co-located, imported by its TSX) → **L3 config-driven** (`ResponsiveVal` + layout-nodes in provisioning —
our edge). **Tenant brand lives ONLY in the app** (`[data-tenant]` / `manifest.theme`), as a flat Tier-2
role-*value* map. **Ownership rule:** *a style lives with the single component that emits its markup; it
rises to a central layer only as a token (L0) or a framework hook any node can wear (L1). "Depends on
tokens" is NOT a placement criterion — everything does.*

**Worst violations (evidence-backed):**
1. **Brand-font leak (headline).** `'Noto Serif Georgian'` / `'Noto Sans Georgian'` / `'BPG Arial'` are
   hardcoded in **9 shared plugin CSS files** (section, hero, stats-carousel, kpi-strip, page-header,
   filter-bar, data-table, landing, chart). The shared layers are **not brand-neutral** on the type axis —
   color/space tokenize + rebind correctly; typography leaked because **no `--font-family-display` role
   exists.** → add the role token, rebind under `[data-tenant]`.
2. **Dead app residue** (`apps/geostat/.../index.css`): the whole `@layer components` block
   (`.page-container`, `.section-card`, `.chart-card`, `.filter-btn*`, `.stat-number`) + `fadeInUp` /
   `.animate-fade-in-up` — **zero TSX consumers** (grep). Runner has no pages (ADR-0028). `.page-container`
   also a stale `1280` dup of fluid `--page-measure`.
3. **Dead duplicate** (`packages/styles/.../card.css`): `.sc` (~150 lines) ≈ `.panel`, **zero consumers**
   (only self-refs; shells use `.section`/`.panel`). Live `.panel` half mis-homed in L0, carries magic
   `#5A7A8A` + raw rgba shadows.
4. **Mis-homed ApexCharts overrides** in the geostat app (magic `#E0EBE8` + `!important`) — the chart
   *renderer's* chrome belongs to the chart plugin.
5. **Dual brand SSOT:** geostat brand exists twice — Tailwind palette (5 app TSX use `bg-primary` etc.) AND
   `[data-tenant]` CSS vars (plugins). `manifest.theme` injection wants role tokens only; Tailwind is a
   compile-time fork that can't be runtime-rebound. → platform-architect, not pre-demo.

**Verdicts:** `.sc` → DELETE · geostat `@layer components` + `fadeInUp` → DELETE · `.panel` →
CO-LOCATE to `packages/react` (owned by `PanelLayout.tsx`) · Apex overrides → CO-LOCATE to chart plugin ·
brand fonts → DE-BRAND to token + `[data-tenant]`. **Mostly SAFE** (dead-deletion = byte-identical to
runtime; font-indirection with the token default set to today's *rendered* stack = byte-identical). Two
**RISKY**: the Apex co-locate (Apex injects inline styles → browser-verify) and the font fallback-chain
*mapping*. Full split in §7.

---

## 1. The canonical spine

Dependency arrow governs CSS as TS: `…← styles ← react ← plugins ← apps`. CSS references *inward* only
(tokens, framework hooks); never imported by a more-inward layer.

- **L0 — Tokens** (`styles/src/css/tokens.css`): only home for raw primitives — hex ramps, px/rem scales,
  **font-family stacks**, shadows, radii, z, motion. 3 tiers (correct): primitive ramp → Tier-2 semantic
  role → component role. Shells consume roles only; dark/`[data-theme]`/`[data-tenant]` rebind Tier-2 values.
  **Gap: typography has `--font-family-base`/`-mono` but no display/heading role** → §3 leak.
- **L1 — Framework globals** ("any node can wear it", BEM-agnostic, zero tenant content). `styles/css/`:
  `node-styles.css` (the generated responsive/interaction/print engine — a985 owns codegen), `animations.css`.
  `react/src/styles/`: `a11y.css`, `slot.css`, `chrome-region.css`, `panel-layout.css` (the `.panel-row/col`
  grid). **L1 test:** keyed on a framework hook (`[data-*]`, `.panel-row`) any node can wear → L1; chrome of
  one component → L2.
- **L2 — Component-local** (in the node folder, imported by its TSX): structure + skin + its own
  `@media`/`@container`. Home of `.panel` (§2.1), the Apex overrides (§2.2), every `plugins/**/<block>.css`.
  Co-location is already ~done (a985 audit).
- **L3 — Config-driven** (`ResponsiveVal<T>` + `columns`/`grid`/`stack`/`wrap` + Constructor PropSchema):
  responsive **declared in config, not CSS** (Law 2). **Our edge** — only Builder.io is a peer; Material/SLDS/
  Grafana can't author responsive layout without a developer. Under-adopted (§5).

**Brand-neutrality invariant (this doc's law):** `styles`/`react`/`plugins` ship **zero** tenant brand — no
brand hex, no brand font name, no tenant string. All brand = a flat Tier-2 value-map at L-app (`[data-tenant]`
today = `manifest.theme` tomorrow, same seam). Enforced by a scan (§8 F1). **We are STRONGER than the leaders
at:** L3 config-authorable responsive, Law-1 generic dims, and the single-token `--page-measure` /
`--size-panel-height` rebind seams (a tenant re-measures the whole page in one declaration — OCP).

---

## 2. The two placement verdicts (decided)

**2.1 `.panel` card → CO-LOCATE to `packages/react`, owned by `PanelLayout.tsx`.** Evidence: `PanelLayout.tsx`
emits every `.panel*` class (`panel__head/accent/title/body/chevron/view-btn`, lines 84–147). Verdict: chrome
of ONE component → `packages/react/src/components/PanelLayout.css`, imported by `PanelLayout.tsx`; drop from
the styles bundle. The `card.css` header's "lives in L0 because it depends on tokens" rationale is wrong —
*every* component CSS depends on tokens; that can't decide placement. **Trade-off vs a985 §1.1** (which keeps
`card.css` central as a cross-node primitive): after deleting dead `.sc`, only `.panel` remains and it is not
a free utility — it is `PanelLayout`'s markup. Maintainability + analysability (ISO 25010) win →
co-location. A *refinement* to a985 §1.1, flagged §6.

**2.2 ApexCharts overrides → CO-LOCATE to the chart plugin.** Evidence: geostat index.css L118–128 globally
style `.apexcharts-tooltip`/`.apexcharts-menu`; the chart plugin has **no** Apex overrides → these are the
only such styling and are **live** (charts render). Not dead — mis-homed. Verdict: →
`plugins/panels/chart/default/chart.css`; tokenize `#E0EBE8`→`--color-chart-frame`, shadows→`--shadow-overlay`/
`--shadow-card`. `!important` is likely required (Apex inline styles) → keep, but this makes it browser-verify.

---

## 3. De-brand — typography (the one leaked axis)

**Root cause:** L0 tokenizes color/space/shadow but has no **font-family role**. Color didn't leak (the accent
*role* exists); typography did (no heading role) → 9 plugins hardcoded the tenant families. **Fix (same pattern
color uses):** (1) **L0** add `--font-family-display` (titles/hero/headings), neutral default (system stack);
keep `--font-family-base` (body). (2) **L2** plugins reference `var(--font-family-{display,base})`, never a
family name. (3) **L-app** rebind under `[data-tenant="geostat"]`, beside the accent rebind:
`--font-family-display: 'Noto Serif Georgian','Noto Sans Georgian',serif`;
`--font-family-base: 'BPG Arial','Noto Sans Georgian',system-ui,sans-serif`. The tenant also owns font
*loading* (Google-Fonts `<link>`; CSP already allows `fonts.gstatic.com`). **Byte-identical** because the
token's resolved value under geostat == today's exact stack — only the indirection changes (this is why
de-brand is SAFE). The *one* risk is mapping each plugin to the right role (serif-display vs sans-base) — §7 R-B.

---

## 4. File-by-file inventory

Legend — **Verdict**: KEEP · DELETE(dead) · CO-LOCATE→target · DE-BRAND · TOKENIZE. Decorative magic-literal
tokenize + breakpoint strategy = **a985-S2/S1** (not re-litigated). ★ = brand-font offender (§3).

**`packages/styles/src/css/` (L0+L1)**
- `tokens.css` — **KEEP** + **ADD** `--font-family-display` (§3). Brand-neutral SSOT.
- `node-styles.css` — **KEEP** (L1; a985 owns codegen). **FLAG:** `[data-height] .chart-wrap`/`.chart-ph`/
  `.data-table__wrap` couple the central engine to **plugin BEM names** — one-directional, documented. Clean
  long-term = a generic `[data-fill]` hook plugins opt into; **YAGNI now** (works). Platform-architect note.
- `card.css` — **SPLIT: DELETE `.sc`** (dead) + **CO-LOCATE `.panel` → `react/.../PanelLayout.css`** (§2.1) +
  **TOKENIZE** `#5A7A8A`, raw rgba shadows. Then **DELETE `card.css`** + its `@import` (styles `index.css`).
- `animations.css` — **KEEP** (L1). `index.css` — **KEEP**, drop `card.css` import after the move.

**`packages/react/src/styles/` + components (L1/L2)**
- `index.css` **KEEP** (drop stale `.sc`/`.panel` comment + card import). `a11y.css`/`slot.css`/
  `chrome-region.css`/`panel-layout.css` — **KEEP** (L1; `.panel-row/col` grid ≠ the `.panel` card).
- `components/PanelLayout.css` — **CREATE** (co-locate target, §2.1). `PropSchemaForm.css`,
  `feedback/feedback.css` — **KEEP** (L2 react-internal).

**`packages/plugins/**` (L2)** — all placement **KEEP** (co-located). Per-file = DE-BRAND + a985-S2.
- ★ `nodes/section/section.css` (L68), ★ `nodes/hero/hero.css` (L34), ★ `nodes/stats-carousel/…` (L80,166),
  ★ `nodes/page-header/…page-header.css` (L45,101), ★ `nodes/filter-bar/…` (L67,111),
  ★ `panels/table/…data-table.css` (L83), ★ `panels/kpi-strip/…kpi.css` (L156),
  ★ `pages/container-page/landing/landing.css` (L36) — **KEEP + DE-BRAND** the marked lines → role token.
- ★ `panels/chart/default/chart.css` — **KEEP + DE-BRAND** `.donut-legend 'BPG Arial'` (L43)→`--font-family-base`
  **+ RECEIVE** the Apex overrides (§2.2).
- `nodes/layout/layout.css` — **KEEP** (reference-quality L2; the L3 model). `nodes/perspective-bar`,
  `panels/{map,text,gauge}`, `pages/{inner-page,tab-page}`, `chrome/*` — **KEEP** (no brand font; a985 owns
  their literals + `1280`→`--page-measure` caps).

**`apps/geostat/src/shared/styles/` (L-app)**
- `index.css` `@tailwind` directives — **KEEP** (5 app TSX use utilities: App, PageLoader, SuspenseFallback,
  PreliminaryBadge, SharePermalinkButton). `[data-tenant]` block — **KEEP** + **ADD** font rebinds (§3).
  `@layer base` — **KEEP** (minor `#1A2332`→`--color-text-primary`). `@layer components` + `fadeInUp` —
  **DELETE (DEAD).** Apex overrides — **CO-LOCATE → chart plugin** (§2.2).
- `inner.css` — **KEEP** (genuinely app-shell-local header/sidebar height vars).

**`apps/panel/src/**`** — Constructor authoring UI, not tenant render. **KEEP** placement; out of de-brand scope.

---

## 5. Config-driven adoption (L3) — staged for platform-architect

Machinery is strong but provisioning barely uses it. Coordinated with a985 §9.1 (not duplicated):
1. **KPI count-ladder → a layout-node mode.** Lift a985's `data-kpi-count` container ladder into a
   `columns.count` `fit:'count-known'` discriminant → authors get orphan-free strips declaratively. OCP: new
   discriminant = new capability, interpreter unchanged.
2. **Panel `aspectRatio`/`"16:9"` → a `size` token in provisioning** (expand-contract): migrate config, then
   drop the deprecated alias rules + inert `--ar-*` resolver output in `node.ts`/`panel.ts`.
3. **Per-node value-breakpoints → `ResponsiveVal`** where authorable (padding/gap/columns the engine can
   carry → L3 config); structural reflow (header collapse) stays L2 `@container` (a985's axis).

All additive, post-demo, YAGNI-gated (each has a real second consumer).

---

## 6. Scope partition with a985 (collision map)

- Breakpoint SSOT/off-scale/mobile-first/container-first → **a985**; I don't touch.
- Decorative magic-literal tokenize (the "56" = S2) → **a985**. I tokenize only the **brand/placement**
  literals that ride my moves: `#5A7A8A` (card), Apex `#E0EBE8`.
- `1280` caps → `--page-measure` (S1) → **a985**; but I **DELETE** geostat `.page-container`, so it drops out
  of S1 — a985's S1 list to be trimmed after my deletion.
- **CONFLICT — `card.css` home:** a985 §1.1 keeps it central; I move it to `react` (§2.1). **This doc is the
  tie-break: co-location wins; a985 §1.1 to be amended.**
- Brand-font de-brand, dead-code, `.panel`/Apex co-locate, dual-SSOT flag → **this doc** (a985's audit didn't
  cover the brand axis). L3 adoption → **shared flag → platform-architect.**
- **Sequencing contract:** a985 lands → reconcile S1/S2 lists (my deletions shrink them) → this doc's plan.
  No file edited by both in one wave.

---

## 7. Execution plan (post-a985)

**(a) SAFE — byte-identical, one-line revert each**
- **P1** geostat `index.css`: DELETE `@layer components` + `fadeInUp`/`.animate-fade-in-up`. *(0 consumers —
  grep.)* Verify: re-grep 0 refs; 1 live-page screenshot.
- **P2** `card.css`: DELETE `.sc` (~L19–170). *(0 consumers — `rg "\bsc__|class.*\bsc\b"` = self only.)*
- **P3** MOVE `.panel*` → `react/src/components/PanelLayout.css`; `PanelLayout.tsx` imports it; delete empty
  `card.css` + its `@import`s. *(Same selectors + cascade order.)* Verify: panel screenshot.
- **P4** (during P3) TOKENIZE `#5A7A8A`→`--color-text-muted`, rgba shadows→`--shadow-card`. *(Token==literal.)*
- **P5** ADD `--font-family-display` (L0); 9 plugins → `var(--font-family-{display,base})`; `[data-tenant]`
  rebinds to today's exact stacks. *(Resolved family unchanged.)* Verify: screenshot each text node.
- **P6** ADD fitness scan rejecting brand-font-name / non-token hex in `packages/{styles,react,plugins}`
  (skipped→green after P5).

**(b) RISKY — real-browser before/after**
- **R-A** CO-LOCATE Apex overrides → chart plugin; tokenize hex; keep `!important`. *Risk:* Apex inline styles
  + sheet-order/specificity. *Verify:* hover tooltip + open menu — radius/border/shadow identical.
- **R-B** Font rebind **mapping** (serif-display vs sans-base per node). *Risk:* mis-map shifts glyphs.
  *Verify:* per-node screenshot diff (the gate that keeps P5 byte-identical).

**Sequencing:** a985 lands → reconcile lists → Wave 1 SAFE (P1→P2→P3→P4→P5→P6, each its own commit; P2 before
P3) → Wave 2 RISKY (R-A, R-B, ladder-verified) → platform-architect: §5 L3 + dual-SSOT retirement (migrate 5
Tailwind-utility files to CSS-var roles, drop the Tailwind brand palette → `manifest.theme` = single brand
SSOT) + the engine→plugin-BEM `[data-fill]` decoupling. All additive, trigger-gated.

---

## 8. Fitness functions (the placement-axis no-degradation law)
- **F1** brand-neutral shared layers: reject brand font names + non-token hex/rgba outside `tokens.css` in
  `packages/{styles,react,plugins}` (P6).
- **F2** no dead central class: a class defined centrally/in a plugin with 0 TSX consumers fails (would catch
  `.sc` + geostat `@layer components`).
- **F3** one brand SSOT: no brand color/font in *both* Tailwind config and `[data-tenant]`.
- **F4** component owns its CSS: a `.block*` set lives in the folder of the component that emits `.block`
  (would flag `.panel` in L0).

Complement to a985's responsive-axis I1–I7.

---

## 9. Key absolute paths
- `…\platform\packages\styles\src\css\tokens.css` (de-brand target) ·
  `…\packages\styles\src\css\card.css` (split/delete) ·
  `…\packages\react\src\components\PanelLayout.tsx` (`.panel` owner / co-locate dir) ·
  `…\packages\styles\src\css\node-styles.css` (KEEP; engine-BEM coupling flag) ·
  `…\apps\geostat\src\shared\styles\index.css` (dead residue + mis-homed Apex + brand theme) ·
  `…\packages\plugins\panels\chart\default\chart.css` (Apex co-locate + donut de-brand) ·
  a985 (don't collide): `…\work\DESIGN-css-responsive-standard.md`, `…\work\AUDIT-css-adherence.md`

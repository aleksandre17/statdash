---
name: perspective-axis-p52-blocker
description: P5.2 (migrate 3 surviving System-A surfaces onto perspective model) — migrations (2) KPI-when + (3) nav-order are byte-identical-CLEAN, but migration (1) perspective-bar TOGGLE has a hard byte-identical CONFLICT — live mode-bar renders manifest.modes labels+icons, NOT the authored PerspectiveDef.label. Spec's "label from PerspectiveDef" assertion is contradicted by ground truth. STOPPED before edits, ESCALATED. Builds on [[perspective-axis-p51]].
metadata:
  type: project
---

# Perspective-axis P5.2 — STOPPED on toggle-label byte-identity conflict (2026-06-27)

Task: migrate 3 surviving System-A surfaces onto perspective model (additive, byte-identical, fitness-locked) so P6 can grep-clean. Surveyed all 3; made NO edits because migration (1) cannot be byte-identical as the architect's spec directs.

## Ground truth (verified)
- **Live `mode-bar` toggle labels come from `modeRegistry` = `manifest.modes`** (App.tsx:40 registers them at boot). `ModeBarShell` renders `def.label` + `def.icon` from `ctx.mode.available` (ModeDef[]).
  - `manifest.modes` (geostat.provisioning.json:4076): `year → label "წლიური", icon "calendar"`; `range → label "დინამიკა", icon "calendar-range"`. `ModeDef.label` is a PLAIN string (ka-only) → both locales show "წლიური"/"დინამიკა".
- **Authored `PerspectiveDef.label` (P5) DIFFERS**: `year → {ka:"წელი", en:"Year"}`, `range → {ka:"შუალედი", en:"Range"}` (all 3 pages: accounts:1207, gdp:2241, regional). NO `icon` on PerspectiveDef.
- So: deriving the perspective-bar's labels from `PerspectiveDef.label` (architect's spec lines 166-167) renders "წელი"/"შუალედი" with NO icons → NOT byte-identical with the live "წლიური"/"დინამიკა" + calendar icons.

## The conflict (why STOP)
Architect spec (VISION v3-PLAN lines 166-167) directs: perspective-bar label = authored `PerspectiveDef.label`, and asserts "the same labels … which P5 set to the same {ka,en} the timeModes carried." Ground truth: the toggle source is `manifest.modes` (NOT `timeModes`), and P5's PerspectiveDef labels do NOT match it (+ icons missing). Task says "If anything isn't byte-identical, STOP + report." Both true → stopped before edits.

## Migrations (2) + (3) are CLEAN (no conflict)
- **(2) KpiSpec.mode → when:perspective-is**: pure engine logic, no labels. perspectiveState seeded from same URL `mode` param → kpiVisible byte-identical at both interpretKpis:221 + extractKpiRequirements:309. Factor shared `kpiVisible(spec,ctx)` SSOT. Config: mode:"year"→when:{op:perspective-is,perspective:"year"}, range likewise, "both"→drop. Ready.
- **(3) modeOrder → perspectives[].id order**: `perspectives[]` order = [year,range] === modeOrder [year,range]. navUtils._extract takes ordered id list already; SiteRenderer passes `axis.perspectives.map(p=>p.id)` instead of page.modeOrder. Ready.

## Resolution options for the architect (migration 1 label/icon source)
- **(A) Toggle keeps modeRegistry labels+icons; axis supplies only ids+order+active.** SiteRenderer builds `available` triad by merging axis perspective ids/order with EXISTING modeRegistry label+icon resolution. Byte-identical (labels/icons from same source as today) AND satisfies FF-PERSPECTIVE-BAR-FROM-AXIS (ids+order from axis). BUT contradicts spec's "label from PerspectiveDef" — keeps modeRegistry load-bearing for labels into P5.2 (P6 then must move labels onto PerspectiveDef as a deliberate visual change). RECOMMENDED for byte-identity.
- **(B) Author PerspectiveDef.label = manifest.modes labels + add PerspectiveDef.icon.** Set label:{ka:"წლიური",en:"წლიური"} etc + icon:"calendar"/"calendar-range" on all 3 pages, derive toggle from PerspectiveDef per spec. Byte-identical toggle, but: en locale loses the en variant (was ka-only anyway, so still byte-identical with TODAY), AND requires adding `icon?` to PerspectiveDef/contract type (new field). Matches spec's "label from PerspectiveDef" intent.
- **(C) Accept a deliberate visual change** (labels become "წელი"/"შუალედი", icons drop) — orchestrator visually verifies. VIOLATES the byte-identical mandate. Rejected unless architect re-scopes.

## NOT done: zero edits. Awaiting architect ruling on (A)/(B)/(C) for migration (1) before implementing (1); (2)+(3) ready to implement immediately on nod.

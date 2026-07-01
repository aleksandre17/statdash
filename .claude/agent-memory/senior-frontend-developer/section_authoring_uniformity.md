---
name: section-authoring-uniformity
description: Owner's #1 section complaint fix — every section in geostat.provisioning.json is composed through a `columns` layout node (pairs count:2, singles count:1); FF-UNIFORM-SECTION-AUTHORING guards it; gdp was already canonical
metadata:
  type: project
---

Closed the owner's "არაერთგვაროვანი" (non-uniform section handwriting) complaint at the
CONFIG level — the deeper fix the layout lane ([[responsive_audit_systemic_roots]] / P5
InnerPageShell-as-stack) deliberately skipped as "redundant".

**The inconsistency (was):** in `apps/api/provisioning/geostat.provisioning.json`, `gdp`
composed EVERY section group through a `columns` node (even single sections, count:1),
while `accounts` (sna-hero, the `repeat`, sna-hero-range) and `regional` (regions-bar,
sector-history) dumped sections as DIRECT children of the page body.

**Canonical form chosen (one handwriting):** ONE composition primitive — `columns` — for
every section group. Pairs → `count:{default:2,md:1,sm:1}`; singles → `count:{default:1,md:1,sm:1}`.
The group-level perspective gate (`view.visibleWhen {op:perspective-is}`) lives on the
`columns` WRAPPER, never on the inner single section. This is byte-shape identical to what
gdp already did, so **gdp was left untouched** (preserves the verified work) and accounts/
regional converged to it.

**Why `columns count:1` for singles (not `stack`):** (1) it's the established verified
convention already in the file (Chesterton's fence — propagate the existing handwriting,
don't invent a 2nd); (2) ONE primitive = strongest uniformity claim (columns+stack = two
shapes to the owner's eye); (3) a single→pair change is a one-field flip (count 1→2), not a
node-type swap (OCP). `stack`-for-singles deferred until the page-body-as-stack (P5) makes
singles sit in the body stack without a grid wrapper.

**Load-bearing (don't regress):**
- Wrapping a `repeat` in `columns count:1` is NAV-SAFE. `navUtils._extract` descends EXACTLY
  ONE level into a `nav-transparent` container ([[layout_node_composition]]). `repeat` is NOT
  nav-transparent, so its emitted sections never reached the nav extractor before OR after —
  columns→(1 level)→repeat stops. Byte-identical nav.
- Moving `visibleWhen` off the section onto the columns is nav-identical: `getNavMode` only
  fires on `{op:'eq', param:perspectiveKey}`, NOT on `perspective-is` → navMode was `undefined`
  before and after.
- `columns` carries `caps:['nav-transparent']` (absorbed from retired `row`); required or
  nested sections vanish from nav.

**Fitness guard:** `apps/api/src/provisioning/config-uniform-section-authoring.fitness.test.ts`
(no-DB, reads committed artifact). THE INVARIANT: every inner-page `section`/`geograph` has a
layout-container ancestor (columns|grid|stack) — one check subsumes direct-child AND
top-level-repeat violations. Plus: no section/geograph/repeat is a direct child of the page
body; no single-section wrapper's inner section carries a redundant perspective gate.
LAYOUT_CONTAINERS set is a literal (apps/api can't import the packages/react registry per the
arrow) mirroring the nav-transparent cap roster — keep both in sync.

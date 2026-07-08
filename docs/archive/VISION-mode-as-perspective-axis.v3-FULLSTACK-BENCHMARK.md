# VISION #3 FULL-STACK — Competitor benchmark + foresight

> Sibling of `VISION-mode-as-perspective-axis.v3-FULLSTACK.md` (§7 extracted here as a distinct concern: competitive analysis + deferred-door foresight, not the design itself). Design-only — zero code changed.

---

## 1. Where the full-stack perspective model meets/beats the competition

| Capability | Power BI | Tableau | Looker | Superset | Grafana | Retool | **statdash (perspective axis)** |
|---|---|---|---|---|---|---|---|
| Named view state, ordered, with default | Bookmarks ✓ (captured) | Parameters ✓ | — | Tabs ~ | Variables ✓ | States ~ | **✓ `PerspectiveAxis`, derived (not captured)** |
| View carries its DATA scope declaratively | ~ (via interactions) | ~ (calc fields) | ✓ (LookML, code) | ✗ | ~ (panel decides) | ✗ (JS) | **✓ `scope.timeBinding`+`metric`, one object, no code** |
| Non-coder authorable (no formulas/JS) | ✓ | ~ (calc syntax) | ✗ (code) | ✓ | ✓ | ✗ (JS) | **✓ pick-don't-type, sandboxed `VisibilityExpr`** |
| View = pure f(state) (no stale snapshot) | ✗ (re-capture) | ✓ | ✓ | ✓ | ✓ | ✓ | **✓ Harel orthogonal regions, FF-locked** |
| URL = lossless permalink, generated | ~ | ~ | ✓ | ~ | ✓ (var in URL) | ✗ | **✓ permalink-from-registry, SERVED guarantee (Law 9)** |
| Server-side contract validation on save | ✗ (desktop) | ✗ | ✓ (LookML validator) | ~ | ✗ | ✗ | **✓ FF-PERSPECTIVE-REFS-EXIST + config↔cube** |
| One axis = zero machinery (N=1 free) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ FF-ONE-VIEW-NO-MACHINERY (unique)** |
| Same model scales to N orthogonal axes | ✗ | ~ (N params) | ✗ | ✗ | ~ (N vars) | ✗ | **✓ `perspectiveState: Record` (deferred, shape-free)** |

**The meet-and-exceed, stated plainly:** every competitor has *some* named-state mechanism; **none** unifies (derived-not-captured) + (declarative data scope in one object) + (non-coder authorable) + (generated/served permalink) + (server-side contract validation) + (N=1 free) + (registry↔instance site/page split) in one model. Power BI is closest on UX (the docked pane) but loses on capture-vs-derive and code-vs-declarative. Looker is closest on validation but loses on non-coder authorability. **statdash's full-stack perspective axis is the union of their strengths without their weaknesses** — because it is one declarative contract authored/validated/served/rendered through one SSOT.

---

## 2. Authoring-UX lineage (what each builder contributes to the Perspectives pane)

| Product | Authoring model | Steal | Improve on |
|---|---|---|---|
| **Power BI — Bookmark pane** | dockable named-list pane; each captures visibility/filter/selection; "Update" re-captures; reorder; drives buttons. | the dockable named-list-with-reorder IA + the active-preview click. | captured snapshots are brittle (re-capture on any change); ours are derived (`f(state)`) — nothing to re-capture. |
| **Tableau — Parameters + Actions** | typed named value (list/range); show/hide + field-swaps via calc fields + actions. | parameter = named axis; the value-list editor. | logic scattered across calc fields + actions; ours co-locates timeBinding+metric+when in one `scope`. |
| **Grafana — Dashboard variables** | variables editor (name/type/options/default/multi/include-all); panels ref `$var`; repeat-by-variable = trellis. | the variables-list editor UX (closest analogue) + repeat-by-variable = our `facet` door. | untyped-effect (panel decides meaning); ours carries its effect declaratively. |
| **Superset — Native filters + Tabs** | filter-bar with per-chart scoping; tabs partition. | filter-scoping → our deferred `filters[]`; tabs ≈ a `when`-gated node set. | no single "view = filters+panels+measure" object; ours is one axis. |
| **Looker — Explores/Models** | LookML explores/measures in code. | measure-as-first-class → our `scope.metric` (MetricDef). | LookML is code; ours is a pick from registered MetricDefs. |
| **Retool / Appsmith** | component `Hidden` = JS expression; named states. | the show-when condition builder (mirrored by our `VisibilityBuilder`). | raw JS, not non-coder-safe; ours is sandboxed declarative `VisibilityExpr`. |
| **Framer / Webflow — Variants** | named component variants; switching restyles; interaction triggers a variant. | the named-variant chip-row UX for the active-perspective preview. | variants are presentation-only; ours bind data scope. |

**Convergent best-in-class primitive:** a named, ordered list of states with a default, each carrying its declarative effect, edited in a dockable pane, with a live preview of the active one. Power BI's pane IA + Grafana's variables editor + Tableau's typed parameter + Looker's first-class measure — **none unifies all four.** `PerspectiveAxis` does, and `perspective = f(state)` makes the preview always-live (beating Power BI's capture model).

---

## 3. Foresight — the deferred doors compose with ZERO rework

Each deferred capability is an **additive optional `scope.*` key** (or a sibling axis), so it lands in all three surfaces without reshaping any of them:

| Door | Trigger | Engine | API | Panel | Rework? |
|---|---|---|---|---|---|
| **`scope.metric`** (DONE-as-design) | range = CAGR | scope step reads metric | validates ref | MetricDef picker | none |
| **`facet`** (trellis / small-multiples) | small-multiples need | scope step loops axis values | schema `$ref` gains `facet` | `perspectiveSchemaSource` surfaces it (was allowlisted) | **none — additive key** |
| **`scope.store`** (multi-store) | a perspective reads another cube | scope step routes store (buildStoreManifest already routes by key) | validates store key exists | store picker (pick-don't-type) | **none — multistore-D1 shipped the routing spine** |
| **`scope.blend`** (compare perspective) | benchmark/compare view | scope step adds a `blend` resolve (D3 seam) | validates secondary store/query | blend sub-form (the B0 `blend` PropSchema) | **none — D3 ships `blend`; perspective just references it** |
| **2nd axis** (`compare`/`navMode` live) | a real 2nd orthogonal axis | another `perspectiveState` key; its `when` ops read its param | `perspectiveAxes` (plural) in config + schema | the Perspectives pane lists N axes (already generic) | **none — `Record` container + plural axes, shape-free today** |

**The single thing that would make a future capability expensive — and how it's pre-empted:** if `perspectiveState` had been a *named field* (`ctx.timeMode`) instead of a generic `Record`, every new axis would be a new privileged field across all three surfaces (the exact Law-1 debt we're removing). Because P1 lands the **generic `Record` container** (Harel orthogonal regions) and the **registry↔instance split**, the cost of the Nth axis is one registry entry + one config key + one auto-surfaced pane field — **constant, not linear.** Future-proofing encoded structurally, not hoped for.

**One flagged foresight caveat (honest):** the `'all-perspectives'` snapshot unions *every* perspective's requirements server-side. With N axes the union is the *cross-product* of axis values — fine for the bulletin/PDF export (a handful of perspectives), but it would not scale to a high-cardinality faceting axis (hundreds of values). **Mitigation, designed-in-now:** `snapshot` is per-axis-value-bounded — the faceting door, when opened, gets its own pagination/streaming policy and does not silently inherit `'all-perspectives'`. Flagged so the faceting implementer sizes the export cost explicitly rather than discovering a cross-product blowup.

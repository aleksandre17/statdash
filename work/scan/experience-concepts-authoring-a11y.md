# Experience Concepts — §2 Citizen-grade authoring/render · §3 Accessibility leaders

> Cards EXP-06..10. Index + grounding + ranking: `experience-concepts.md`. Analysis only.

---

### [EXP-CONCEPT-06] Value mappings — value → {text, color, icon} (Grafana)
- **What it is** — Grafana value mappings: declarative rules mapping a value/range to display text + color +
  icon (`0→"No data"·gray`, `>100→"High"·red`, `"GE"→"Georgia"`). Status-aware, config-only, reused across panels.
- **Does it strengthen US? — STRENGTHEN.** KPI/table/gauge/status presentation hardcodes formatting per
  shell; a declarative value-map is the citizen-grade way to author "good/warning/critical" semantics and
  human labels for codes — high reuse, fully serializable, Constructor-perfect.
- **Fit** — rides the neutral `ChartOutput`/KPI/table render path + the **semantic-token spine** (a mapping's
  color is a token, not a literal — Law: no hardcoded values) + the `$cl`/`$d` classifier display pipe
  (`codelist.ts`, already does code→label; value-mapping generalizes it to value→{label,token,icon}). The
  Inspector renders the rule list generically (like the visibility builder).
- **FULL-adoption plan** — core: a `ValueMapping[]` carrier on data-bearing node defs + a pure
  `applyValueMap(value, mappings) → {text, tokenRef, icon}` resolver (Strategy by match-kind:
  exact/range/regex/special-null). react/charts: KPI/table/gauge/status shells consume it; color resolves
  through `cssVar()` (the shipped chart-fill util) → themeable + tenant-overridable. panel: a value-mapping
  editor (rule list via generic Inspector; color from token-palette enum-ref — pick-don't-type). **Fitness:**
  "every value-mapping color resolves to a registered semantic token (no literal hex)"; a11y: mapped color
  paired with mapped text (no color-only signal).
- **Effort M · two-way · Class G · P2.**
- **Raises-the-bar** — Grafana value-map colors are literals; ours bind to the **tenant-overridable token
  spine**, so a mapping re-themes per tenant for free and can't fail contrast silently if the gate checks
  token pairs.

---

### [EXP-CONCEPT-07] Library / reusable components — "instances" (Grafana library panels · Figma components · Webflow symbols · Plasmic)
- **What it is** — save a node subtree as a **named, governed, reusable component**; instance it across pages;
  **edit-once-update-everywhere** (with optional per-instance overrides). We have *node types* (registered
  shells) but no *author-defined reusable instance* (a configured "Standard GDP KPI strip" reused on 10 pages).
- **Does it strengthen US? — STRENGTHEN** (net-new; strong governance fit). A statistical agency publishes
  *consistent* components (standard methodology footer, standard regional map, house KPI strip) across dozens
  of pages — a reusable-instance model enforces that consistency and is a real multi-tenant governance asset.
- **Fit** — rides the flat node store + byte-identical round-trip (a library item is a serialized subtree) +
  the insert path (`makeNode`/`insertNode` — an instance inserts a `ref` node) + the migration runner
  (CON-18) for versioned library items. **Net-new substrate**: a `LibraryItem` store + a `library-ref` node
  the renderer expands (Composite + a resolve step) + override-merge.
- **FULL-adoption plan** — contracts/core: `LibraryItem { id, version, node }` + a `library-ref` node the
  interpreter expands (shallow override merge); round-trip stays byte-identical through expansion. react:
  `renderNode` resolves `library-ref` (one new case, OCP). panel: a "Components" panel (save selection →
  library; drag an instance; "detach"; "edit master"); Outline shows instances distinctly.
  api/provisioning: library items persist alongside pages (`config.library` table; rides the publish FSM).
  **Fitness:** "a `library-ref` expands to a config that passes the save-guard"; "editing a master propagates
  to all instances unless overridden" (property test). YAGNI gate: build when the *second page* needs the
  *same* configured component — the agency use-case makes that real fast.
- **Effort L · one-way-ish (a new persisted artifact + schema) · Class G · P2 (escalate to architect: new
  persisted config artifact + node-API addition).**
- **Raises-the-bar** — Grafana library panels are opaque saved JSON; ours = **versioned, migration-aware,
  save-guard-validated, byte-identical** reusable config with per-instance override — a governed component
  system on a provably-correct substrate no BI tool has.

---

### [EXP-CONCEPT-08] Responsive per-breakpoint property overrides (Webflow · Framer · Builder.io)
- **What it is** — author property values *per breakpoint* (hide on mobile, span 2 cols on desktop / 1 on
  mobile, smaller title on phone). Table-stakes in Webflow/Framer/Builder. We have **container-query
  responsive layout** (render adapts) but no *authorable per-breakpoint overrides* and no device-frame preview
  (CON-05/CON-17 flagged the preview gap).
- **Does it strengthen US? — STRENGTHEN (marginal-to-solid).** Honest separation: our container-query model
  is arguably *more correct* than breakpoint soup (intrinsic, not viewport-coupled) — so we do NOT adopt
  viewport-pixel-breakpoint authoring wholesale. What we lack and should adopt is the **authored responsive
  override** as a thin declarative layer + device-frame preview. Mobile-first is our named canon; a public
  stats portal is heavily mobile-read.
- **Fit** — rides the variant spine (a breakpoint override is a conditional prop projection, runtime-zero
  data-attr/CSS-var) + container-query layout (override *at container sizes*, not raw viewport — keeps our
  better model) + the Inspector (a per-field "responsive" toggle). Device-frame preview rides the canvas.
- **FULL-adoption plan** — styles/react: a `responsive?: Record<sizeClass, Partial<props>>` carrier resolved
  via container-query size-classes (not viewport px), runtime-zero. panel: a breakpoint switcher in the
  canvas toolbar (size classes compact/regular/wide) + per-field override affordance + device-frame preview.
  **Fitness:** "a responsive override only sets keys that exist on the base schema"; "preview at each
  size-class renders without error." CWV/a11y: reduced-motion + no layout-shift (CLS) on size-class change.
- **Effort M/L · two-way · Class G · P2/P3.**
- **Raises-the-bar** — overrides keyed to **container size-classes**, not device pixels — intrinsically
  responsive authoring that composes with embedding (Webflow/Framer are viewport-coupled).

---

### [EXP-CONCEPT-09] APG interaction-pattern registry + reduced-motion token (W3C APG · Adobe React Spectrum · GOV.UK)
- **What it is** — W3C **APG** defines, per widget (tabs, listbox, toolbar, tree, menu, slider), the full
  *keyboard interaction model* (roving tabindex, arrow semantics, Home/End, type-ahead, focus management).
  React Spectrum/React Aria ship these as reusable behavior hooks; GOV.UK mandates them. Our shells are
  keyboard-incomplete: perspective-bar lacks roving-tabindex/arrow keys (RX-21, a blanket WCAG 2.1.1 fail),
  no `prefers-reduced-motion` anywhere (RX-23), real shells have zero axe gates (RX-22).
- **Does it strengthen US? — STRENGTHEN-MOST (integrity).** The largest *integrity* gap for a Law-9
  public-sector platform; "green CI ≠ accessible." Beyond remediation, the **concept** to adopt is
  architectural: an **interaction-pattern registry** where each shell *declares* its APG pattern, and a
  fitness walks the real plugin registry asserting the keyboard contract — a11y from per-component bolt-on to
  registry-enforced guarantee (mirrors the coverage gate philosophy).
- **Fit** — rides the plugin shell registry + the RX-24 engine a11y discovery-gate *pattern* (clone it into
  `packages/plugins` where importing real shells is allowed, per Law 3) + the semantic-token spine (a
  `--motion-*` reduced-motion token tier). Net-new only as a small `a11yPattern` declaration + the
  plugin-side gate.
- **FULL-adoption plan** — react/plugins: a tiny `useApgPattern(kind)` behavior set (roving tabindex + arrow
  semantics) applied to perspective-bar, tabs, accordion, toolbar, tree (Outline); each shell declares
  `a11yPattern: 'toolbar'|'tablist'|...`. styles: a reduced-motion token tier
  (`@media (prefers-reduced-motion: reduce)` rebasing `--motion-duration` to 0) consumed by every transition
  (Apex + scroll + canvas). panel: keyboard-operable DnD (CON-10) reuses the same patterns. **Fitness:** clone
  RX-24 into plugins — enumerate `nodeRegistry.list()`, run axe on each real shell, AND a keyboard-interaction
  test per declared `a11yPattern` (axe can't see missing key handlers). A `noRawMotion` lint: no transition
  outside the motion token.
- **Effort L (aggregate) · two-way · Class G · P1.**
- **Raises-the-bar** — a11y as a **registry-enforced fitness over the real shells** (every registered node
  proves its keyboard contract), not per-component hope — Grafana/Tableau/Power BI all fail keyboard
  authoring; none make this structural.

---

### [EXP-CONCEPT-10] Smart-narrative / auto-summary twin (Power BI smart narratives)
- **What it is** — Power BI **smart narratives**: an auto-generated NL summary of a visual ("GDP rose 4.2%,
  led by Services"). For us its highest value is the **a11y + data-integrity synergy**: a structured textual
  summary derived from the same neutral interpretation that draws the chart.
- **Does it strengthen US? — STRENGTHEN (marginal as BI, strong as a11y).** It composes with the board's
  proposed **neutral-output a11y twin** (RX net-new): the same neutral `ChartOutput` that produces the
  accessible data table can produce a templated narrative — one neutral source, three projections (pixels,
  table, prose). Honest verdict: adopt the **templated/deterministic** form (config-driven templates over the
  neutral output), NOT an LLM in the render path (non-deterministic, ungovernable for official statistics).
- **Fit** — rides neutral `ChartOutput` + `renderPageToJSON` walker (structured already) + LocaleString
  (narrative template localized) + methodology badges (narrative cites preliminary/last-updated).
- **FULL-adoption plan** — charts/react: an optional `narrative(output, ctx) → LocaleString` registry hook
  (mirrors the a11y-twin/`skeletonRegistry` pattern); deterministic templates ("{measure} {direction} {delta}
  {period}") filled from the neutral output. panel: author the template / toggle per node. api: the JSON
  target carries the narrative (export/embed). **Fitness:** "a narrative renders from neutral output alone (no
  extra fetch)"; locale-complete; no unsourced claim (every number traces to a row — pairs with
  pixel-to-observation lineage, INNOV-2).
- **Effort M · two-way · Class M · P3** (after the a11y twin floor).
- **Raises-the-bar** — a *deterministic, sourced, localized* narrative from the neutral source = governable
  official-statistics prose (Power BI's is a black box you can't cite); strengthens screen-reader UX and data
  integrity at once.

# DESIGN — Data-integrity badge consolidation (AR-38)

> Consolidate the per-panel "Preliminary" badges into ONE canonical, space-efficient,
> localized section-level indicator (Law 9 preserved). Rides the i18n seam of
> `DESIGN-i18n-full-sync-and-integrity-badges.md` (AR-37) for its labels.
> Owner ask (2026-07-03): "Prelim. badges repeat per-element, waste space — one logical place."
> **Status: DESIGNED (design-only; no code touched).**

---

## 1. The defect + the standard

Today `PANEL_TITLE_BADGE` contributes a **PreliminaryBadge to every panel title** — chart, table,
gauge, kpi-strip, geograph each call `usePanelTitleBadge` (or inline it,
`packages/react/src/engine/usePanelTitleBadge.tsx` + `resolvePreliminary.ts`). On a page whose 4–6
panels share one provisional dataset, the "Prelim." pill repeats 4–6× — visual noise, wasted space,
and it says the same thing each time.

**How reference statistical platforms surface provenance (benchmark):**
- **Eurostat** — per-cell **flags** (`p` provisional, `e` estimate, `b` break) with ONE flag/
  special-value **legend** per table, plus **dataset-level metadata** ("Last update", "Source") in a
  header strip. Not a per-chart pill.
- **ONS** — dataset-level "Last updated" + status + footnotes; per-figure status only where a
  specific figure differs.
- **IMF** — provenance/vintage at the table/dataset level.

**The canon:** provenance is a property of the **dataset/section**, surfaced ONCE at that scope;
per-**datum** precision stays as inline OBS_STATUS cell flags backed by a single legend. Repeating an
aggregate pill per panel is the anti-pattern.

---

## 2. Canonical model — activate the seam `SectionShell` already reserved

`packages/plugins/nodes/section/default/SectionShell.tsx` explicitly documents a **Protected-
Variations seam** (Option D → *"if a real aggregate-status consumer appears, introduce a
`NodeStatusContext`: panels publish NodeStatus, the section subscribes and aggregates here"*).
**AR-38 IS that second consumer** — so we open the fence for the reason it was left, not
speculatively (YAGNI satisfied; the section already owns methodology at this scope).

**Design:**
1. **`NodeStatusContext` (section-scoped publish/subscribe).** A section provides a collector; each
   child data panel PUBLISHES its resolved data-integrity status
   (`{ preliminary: resolvePreliminary(def,ctx), status?: ObsStatus }`) via a `useReportNodeStatus`
   hook. Panels compute exactly what they compute today (`resolvePreliminary` — they hold `ctx.rows`,
   the precise per-slice signal); they report it upward instead of each rendering a pill.
2. **The section aggregates + renders ONE indicator.** The section subscribes, OR-folds children's
   `preliminary`, and renders a SINGLE compact affordance in the **section header** — folded with the
   existing methodology info control: one dot/pill + info icon. Clicking opens the existing
   `SectionMethodology` panel (now the canonical home for preliminary note + source + last-updated +
   methodology link). The section is the **information expert (GRASP)** for its panels' aggregate
   provenance; the data/structure boundary stays honest (panels own rows; the section receives a
   *reported status*, it never reads child `ctx.rows`).
3. **Per-panel pill retires; standalone panels degrade gracefully (Postel).** A panel inside a
   section publishes and renders NO local pill. A panel with NO `NodeStatusContext` above it
   (standalone / outside a section) falls back to rendering its own badge locally — nothing lost
   outside the page anatomy.
4. **Per-cell OBS_STATUS flags stay** (Eurostat per-datum precision) backed by the single table
   footer legend (`packages/plugins/panels/table/default/components/_footer.ts`) — untouched.
5. **Author override composes.** A section may explicitly declare integrity (extend the section
   `methodology` / a `dataIntegrity` block) as signal #1 — mirroring `resolvePreliminary`'s own
   OR-of-signals design, now at section scope.

---

## 3. Placement · space · a11y (Law 9 preserved, not weakened)

- ONE indicator per section, in the header actions cluster beside the methodology info toggle (or
  merged into it — a single affordance: dot = "contains provisional data," icon opens detail).
- **Reachability preserved:** preliminary + last-updated + source + methodology all remain reachable
  via the disclosure — consolidated, not removed. WCAG 2.1 AA: not color-only (dot + text label +
  icon), keyboard-reachable (existing `useDisclosure`), `aria-label`/`aria-expanded` on the toggle.
- **Localized via AR-37:** the indicator label + `OBS_STATUS_LABELS` + methodology
  `source`/`lastUpdated` (now `LocaleString` per AR-37 P1) all resolve through the ONE locale seam.

---

## 4. Fitness gates

| ID | Asserts | Where |
|---|---|---|
| **FF-ONE-INTEGRITY-INDICATOR** | a section with N preliminary panels renders exactly ONE section-level indicator and ZERO per-panel pills; a standalone panel (no provider) still renders its own | new `packages/plugins/nodes/section/**/data-integrity.fitness.test.tsx` |
| **FF-INTEGRITY-REACHABLE** | preliminary + last-updated + source + methodology reachable via the section disclosure; indicator not color-only (Law 9) | same file |

---

## 5. Trade-offs + rejected alternatives (ADR-style)

- **Decision: section-scoped `NodeStatusContext` publish/subscribe; section = information expert.**
  Trade-off: a little cross-cutting coupling for ONE canonical, per-datum-accurate integrity signal +
  space. Justified now — the second consumer is real (seam pre-reserved).
  - *Rejected: section re-derives preliminary from child rows.* Violates the section's structural role
    (Option D) — it would read child `ctx.rows`, breaking the data/structure boundary.
  - *Rejected: author-declared section flag only (no auto-detect).* Loses the automatic per-slice
    precision `resolvePreliminary` computes. Kept as optional OR-signal #1, not the sole mechanism.
  - *Rejected: keep per-panel pills, restyle smaller.* Doesn't deliver "one logical place"; still
    repeats the same statement N times.

---

## 6. Dependency + sequencing (combined with AR-37)

AR-38 **depends on AR-37 P0+P1** (labels must localize through the completed seam). Critically, AR-38
edits the SAME panel shells as AR-37 P1/P4 (each `*Shell.tsx` converts pill→publish AND completes any
residual resolve) — so **bundle them per shell** to touch each shell once (anti-shotgun-surgery).

**In-flight branches:** `feat/chart-lowcardinality-render` (chart shells),
`fix/datatable-scroll` (table shells), pending **#3 directional-crossfilter + NaN fix**.

**Combined build order (minimizes rebase pain):**
1. **NOW — AR-37 P0** (html lang/dir + i18next sync). Zero collision; unblocks all; land immediately.
2. **Land the in-flight branches** (chart, table, #3) before touching their shells — rebasing ONE
   cross-cutting change onto the feature branches is cheaper than the reverse.
3. **AR-37 P2** (provisioning backfill + gate) after **#3** lands (shared JSON).
4. **AR-37 P1 + AR-38, bundled per shell, after the chart & table branches land.** Introduce
   `NodeStatusContext` + the section indicator first (`packages/react` + section), then sweep each
   panel shell: pill→publish + complete residual resolve, in one pass per shell.
5. **AR-37 P3** (map locale-version) — independent, any time after P0.
6. **AR-37 P4** (Constructor parity + render leak gate) — last; gates the whole + verifies the
   bundled shell edits.

**One-line rule:** *P0 now; every panel-shell edit waits for that shell's feature branch, then i18n-
coverage + badge-consolidation land together per shell.*

---

## 7. Acceptance
Exactly ONE consolidated data-integrity indicator per section (zero per-panel preliminary pills);
per-cell OBS_STATUS flags + legend retained; preliminary/last-updated/source/methodology all reachable
(Law 9) and localized both directions. `FF-ONE-INTEGRITY-INDICATOR` + `FF-INTEGRITY-REACHABLE` green.
No regression to AR-15/27/34/35 table work or the section methodology affordance. Real-browser verified.

_Design 2026-07-03 (architect). Registered AR-38 in `ARCHITECTURE-REGISTRY.md`._

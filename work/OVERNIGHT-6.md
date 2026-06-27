# 🌙 Overnight #6 — Perspective refactor: validated, hardened, System-A fully retired

## Headline
You lost the editor session mid-day. **Nothing was lost** — the whole day's plan (the `mode → generic
perspective` axis refactor) was already committed + pushed. Overnight I **validated it, hardened it to
best-in-class, and finished retiring the last System-A survivor.** All green, all pushed.

**Branch `feat/tenant-agnostic-platform`, HEAD `1b95ba8`, origin in sync.**
Gate: build · geostat-tsc · **panel-tsc** · lint · check-laws · test — all 0, **1799 tests pass**.

## What the night produced (commits, oldest→newest)
| Commit | What |
|---|---|
| `e01bcbd` | check-laws Law-4 catalog twin sync (closed today's last loose end) |
| `4ccd042` | **engine canon-hardening** — delete orphaned `effects`/`applyEffects` (dead no-op footgun) + 2 retirement guards; de-privilege hardcoded `'mode'` literals → SSOT (Law 1); unify `kpiVisible` context (warm===render) |
| `d934d76` | i18n — bilingualize perspective-bar authoring labels (Law 4) |
| `7c23350` | test — full render-path validation fitness (3 pages × year/range × ka/en, 19 assertions) |
| `f610fc0` | docs — the night's analysis artifacts |
| `1b95ba8` | **retire the last System-A island** — the site-scoped `modes` registry (write-with-no-read dead pipe); "grep-clean ALL System A" is now *literally* true |

## The three verification pillars (all independent Opus agents)
1. **Quality audit (chief-engineer):** SHIP-READY — **0 HIGH**, 2 MED, 5 LOW. Verified against code (not docs):
   Law 1/2/3/9 clean, `warm===render` structurally held, `ScopeOverride.compare` fully gone. The 2 MEDs
   were the two retirement-hygiene items I then fixed (`effects` + the `modes` island).
2. **Render validation (plugins-specialist):** **PASS** — toggle / KpiSpec.when / filter visibleWhen /
   permalink / Constructor preview all correct, **12/12 combos × 3 pages × 2 locales, by reading the real DOM**
   (not "no-throw"). Added a durable fitness test. *Caveat: data VALUES not re-checked — no Docker/DB here;
   the refactor doesn't change values (already proven Overnight #5). Close the loop with a seeded stack.*
3. **Roadmap reconstruction (project-manager):** the planned roadmap is **essentially all shipped** — the
   platform is at its planned best-in-class. No large designed + direction-free initiative remains. So the
   honest overnight move was canon-hardening, not new scope. (I did not manufacture busywork.)

## One defect I caught and fixed (worth knowing)
Two parallel agents were each green in their own scope but their **combination** broke the panel typecheck:
an i18n change put a `{ka,en}` LocaleString into `PerspectiveOption.label`, which is intentionally a plain
resolved `string`. `pnpm typecheck` is geostat-only and missed it; only `tsc -b apps/panel` caught it.
Reverted the 2 lines; recorded a standing rule so the gate always runs panel-tsc now.

## ⛔ Needs your call in the morning (I deliberately did NOT do these)
1. **MED-2 S7 — the DB migration.** `V35__drop_site_config_modes.sql` is committed but **UNAPPLIED**. It is a
   forward-only `DELETE FROM config.site_config WHERE key='modes'`. It runs when flyway runs on a **deploy from
   main** — that deploy is the greenlight. It must ship in the **same release** as commit `1b95ba8` (the S6
   artifact edit), else `upsertSiteConfig` re-inserts the row on the next boot. Blast radius: one row, flat
   key/value table, no FK/trigger. → **Greenlight = merge to main + deploy.**
2. **`PerspectiveOption.label` i18n architecture** — should perspective labels be a `LocaleString` resolved at
   render, or stay a resolved `string` localized at the boundary? This decides the panel palette's ka-only
   labels properly. Architect call.
3. **Systemic i18n** — ~20 node `*Node.ts` PropSchema labels are single-locale (Law-4 latent, pre-existing,
   not caught by check-laws which scans only `packages/core/src`). Platform-wide normalization + extend the
   guard. Architect call (it's a broad diff; I refused to fold it in blindly).
4. **perspective-bar a11y** — it carries a partial ARIA-tabs pattern byte-identically (parity, not a regression).
   Upgrading to full WCAG tabs changes user-facing semantics → its own validation.
5. **Value-loop** — re-verify the actual numbers (104 598 / CAGR 10.6% …) on a seeded stack
   (`work/stg-render-probe.js`). Needs Docker/DB, which wasn't available here.
6. **Semantic-layer adoption** (roadmap #2) — register MetricDefs + migrate raw measure refs. Additive, but
   *which* measures + *what* units/provenance is a content/direction call.

## Reading order for the morning
`work/REVIEW-perspective-batch.md` (audit) · `work/VALIDATE-perspective-render.md` (render proof) ·
`work/ROADMAP-next.md` (menu) · `platform/work/PLAN-perspectiveKinds-migration.md` (the MED-2 / V35 plan).

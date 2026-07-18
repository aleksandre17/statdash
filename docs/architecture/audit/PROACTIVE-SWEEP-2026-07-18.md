# PROACTIVE SWEEP — 2026-07-18 (platform-architect, reference-class walk)

> **Method.** Live Playwright walk of :3013 studio (`/studio/insert?page=regional`, `/studio`, gestures: select · Esc · right-click · double-click · Ctrl+Z/D/K · `?` · Tab · 1280px) and :3012 portal (`/ka`, `/ka/gdp`, `/ka/regional`, `/ka/accounts`, `/en/*`, dark mode, 390/768px, keyboard trail, map-click permalink test). Probes: `work/probe-proactive-sweep.mjs` (+ pass 2). Screenshots: `work/authoring-truth/sweep/`. Zero product-code changes.
> **Already-carded work NOT re-reported** (checked against `work/items/0087–0091`, `CAPABILITY-INJECTION-BACKLOG.md` R1–R5, 0082 log): filter-mode parity, sources page + classifiers, cross-cube store routing, facet essentials, metric passport, honest-null (Wave B), DQ-on-ingest, versioning/history/rollback (AR-47), manipulate-on-canvas (W4/ADR-042), DQ expectations, time-relative metrics, dataset JSON-LD.

---

## Executive summary (≤10 lines, owner language)

1. ყველაზე მტკივნეული: საკუთარმა rate-limit-მა (429) პორტალი მთლიანად ჩააქრო — ინგლისური «dashboard is not configured» შავი ეკრანი /ka-ზე, სტუდიოში კი ელემენტის shell «crashed». ერთი query-განრიგი (dedupe + backoff) და 429 = პატიოსანი, დროებითი მდგომარეობა — არა სიკვდილი.
2. სტუდიოს ტილოზე გვერდის საკუთარი ღილაკები (ენა/თემა/სოციალური) ცოცხალია და სტუდიოს ღილაკებს ერევა — Edit/Preview რეჟიმი გვაკლია, რომელიც ყველა კლასის ლიდერს აქვს.
3. პირველი ინსტინქტის ჟესტები მკვდარია: ტექსტზე double-click არაფერს შვება, დუბლირება არ არსებობს, right-click მენიუ არ არის.
4. URL-პორტი უკვე გვაქვს (perspective `mode`), მაგრამ რუკის არჩევანი/წელი/ტაბები URL-ში არ ჩანს — გაზიარებული ბმული ფილტრებს კარგავს (კანონი 9!).
5. წვდომადობის სახელები გატეხილია: სამი ბმული სახელად «[object Object]», aria-label-ები ინგლისურად ქართულ გვერდზე; სტუდიოს თავზე PAGES/HISTORY/SAVE DRAFT ინგლისურად ქართული რიგის გვერდით.
6. სტატ-ოფისის ნატიური კონცეფცია, რომელიც არავის უთხოვია: publish-readiness პანელი — EN-სისრულის მზომი + a11y + უბმო ელემენტები ერთ ჭკვიან PUBLISH-კარიბჭეში (Webflow Audit-ის კლასი).
7. დანარჩენი: ელემენტზე «წყარო» arm არსად ჩანს, ექსპორტი მხოლოდ ზოგ ბარათს აქვს, მუქი თემის ცხრილის სათაურები AA-ს აგებს (4.28:1), skip-link არ არის, პორტალს ძებნა არ აქვს, ⌘K მხოლოდ ჩასმაა, Save/undo მდგომარეობა უჩინარია, მალსახმობების ცხრილი არ არსებობს, ხატულა ნედლი ტოკენით იწერება.

---

## TOP-5 — «he would hit these in his next hour of clicking»

### 1. Transient-failure grammar missing — a 429 kills the whole product ⛔ breaks-trust
- **What/where.** During a normal walk the API rate-limiter fires and: (a) `/ka` home shows an English **"Retry"** button inside the KPI slider; (b) `/ka/regional` at 390px renders **nothing but** "This dashboard is not configured, or the data service is currently unavailable. Please try again later." — English, on the KA locale, whole page gone (`work/authoring-truth/sweep/portal-regional-mobile.png`); (c) studio console: `[renderNode] shell crashed {type: featured-slider … HTTP 429}`. Reproduces by simply browsing (each element fetches independently; the page's own fan-out trips its own limiter).
- **Root cause.** Per-element fetch fan-out with no shared scheduler; no dedupe of identical ObsQueries; no backoff honoring `Retry-After`; page-spec fetch failure conflated with "not configured"; transient failure is not a declared `Cell` state.
- **Reference anchor.** Grafana query scheduler (per-datasource concurrency + retry), Superset dashboard-scoped chart-data batching, SWR stale-while-revalidate; Google SRE retry-with-jitter.
- **Concept (decided).** ONE request scheduler in the store layer — dedupe identical queries across elements, concurrency cap, exponential backoff honoring `Retry-After`, stale-while-revalidate cache — and `transient-retrying` joins the honest-state grammar (bilingual, per-element, auto-recovering; page spec fetch degrades to cached/last-good, never a wholesale English dead-end). Adjacent to Wave B but NOT carded there: Wave B declares *null* states; this is the *transient* class + the fetch architecture.
- **Effort.** M–L (store layer + state grammar entry; apps unaffected by design).

### 2. No Edit/Preview interaction mode — in-canvas page chrome is live and ambiguous ⚠ confuses
- **What/where.** `/studio/insert?page=regional`: the canvas faithfully renders the page's own header — social icons, its own KA/EN switch, its own ☀/☾ — directly under the studio topbar's **KA|EN** toggle and the canvas toolbar's **☀ნათელი/☾მუქი**, and the app-header's ქარ/ENG + theme switcher (four locale controls, three theme controls in one viewport — `studio-insert.png`; DOM: `studio-topbar` vs `canvas-toolbar__modes` vs in-canvas `app-header__actions`). What a click on in-canvas chrome does is undefined to the author.
- **Reference anchor.** Builder.io / Webflow / Framer: an explicit **Edit ↔ Preview** switch — in Edit, every canvas click selects and interactive parts are inert; in Preview, the page behaves for real.
- **Concept (decided).** One interaction-mode toggle in the canvas toolbar (joins ცოცხალი მონაცემები/სტრუქტურა as a third declared axis: *interaction*). Edit = select-only with inert overlay over interactive parts; Preview = real behavior, inspector read-only. Studio controls and page-chrome controls get visually distinct planes (the studio's own chrome never styled like page chrome).
- **Effort.** M (renderer already distinguishes chrome parts; this is a mode gate, not new grammar).

### 3. Dead first-instinct gestures: double-click, duplicate, right-click ⚠ confuses / lag-vs-class
- **What/where.** Canvas, any node: **double-click on text** → nothing (no `contenteditable`, focus stays on body); **Ctrl+D** → no-op (16 nodes before/after, no toast); **right-click** → browser menu only (0 app menus). The commands that DO exist (add, move up/down, delete, bind) live only as inspector buttons.
- **Reference anchor.** Double-click-to-edit text: Builder.io/Webflow/Framer/Figma — the single most universal builder gesture. Duplicate + context menu: every member of the class.
- **Concept (decided).** A **Gesture→Command projection**: one command registry (the operations already exist in the inspector) projected to (a) right-click context menu, (b) shortcuts (Ctrl+D duplicate, Del delete — with toast feedback), (c) double-click on a text Part opens inline editing that writes through the SAME i18n content contract as the inspector field. No new per-type wiring — commands derive from the Part/node contract (ADR-038/041). Inline-edit and any *placement* gestures feed W4/ADR-042, they do not fork it.
- **Effort.** S (menu + duplicate + shortcuts) · M (inline text edit).

### 4. The URL-param port exists but only perspectives use it — reader state is unshareable ⛔ breaks-trust (Law 9)
- **What/where.** `/ka/regional`: clicking a map region (verified), changing year, წლიური/დინამიკა tabs, რუქა/ცხრილი toggle — page state changes, URL stays `…/ka/regional` (no params). Yet the perspective tab-bar already declares **«URL პარამეტრი: mode»** in the inspector (`studio-insert.png`, right dock) — the port is built, just not general.
- **Reference anchor.** Superset permalink state · Metabase · ONS/Eurostat explore URLs · Vega-Lite params. For a stat office, a shared link that silently drops the filter is a trust failure.
- **Concept (decided).** Generalize the existing URL-param declaration to ALL Param/Selection primitives of the Grammar of Interaction (ADR-041): every declared interaction param carries an optional `urlKey` (default: on for reader-facing selections), projected bidirectionally (URL → initial state, state → replaceState). One declaration, both directions, no per-element code.
- **Effort.** M (a projection of the interaction store; the pattern is already proven by `mode`).

### 5. Accessible-name + chrome-locale integrity: "[object Object]" and English aria on KA ⛔ breaks-trust (AT users) / coherence
- **What/where.** Portal header (`/ka`, every page): **three links whose accessible name is literally "[object Object]"** (keyboard/AT trail, both probes); aria-labels in English on the KA locale — "Light theme", "Dark theme", "Year" (regional year select), "Retry". Studio: topbar **PAGES · HISTORY · SAVE DRAFT · PUBLISH · ⌘K** in English beside the Georgian rail (მონაცემები/დამატება/შრეები…); mixed strings "Open საჩვენებელი ბარები →", "not set", "Page color".
- **Reference anchor.** WCAG 2.1 AA (4.1.2 name/role/value; 3.1.2 language of parts); gov.uk localization discipline; the project's own AR-26/AR-37 i18n content contract.
- **Concept (decided).** Accessible names and ALL chrome strings route through the same i18n content contract as body copy — plus a fitness function: a Playwright/axe scan asserting (a) no accessible name matches `\[object Object\]`, (b) no English-catalog string in the a11y tree of `ka` pages, (c) studio chrome strings come from the message catalog (lint: no hardcoded-English literals in shell components).
- **Effort.** S (the [object Object] is a plain interpolation bug — fix-on-sight class; the catalog sweep is mechanical).

---

## The rest of the dossier (6–15)

### 6. Export/share per section is inconsistent — lag-vs-class (Law 9 partial)
Chart cards on `/ka/regional` carry link+download icons; the KPI strip, the map card, tables, and the home slider carry none; `/ka` home has zero share/export. Law 9 says *export per section*. **Anchor:** Grafana panel menu on every panel; ONS "Download this chart/data". **Concept:** export/share = a projection of the data-bearing Part contract — declared once, derived for every element type (bounded-element law; a per-type hand-wired button is the anti-pattern). **Effort:** S–M.

### 7. Per-element source citation absent — stat-native gap
"წყარო" appears **0 times** on any portal page (only a footer geostat link + page-level «დამატებითი ინფორმაცია»). A national-accounts chart without its source line fails the ONS/OWID/Eurostat bar. **Anchor:** OWID per-chart source line; SDMX provenance. **Concept:** the reader-facing source line is the SECOND projection of the same declaration 0090 (metric passport) surfaces studio-side — metric → declared home/cube → rendered citation. Explicitly ride 0090's SSOT; never a hand-typed string. **Effort:** S once 0090 lands (card as its reader-projection sibling).

### 8. Dark-mode table headers fail WCAG AA — measured
`/ka/regional` dark: header/label text `rgb(124,130,145)` on `rgb(30,30,42)` = **4.28:1** (< 4.5:1 for small text). **Anchor:** WCAG 1.4.3. **Concept:** token-pair contrast fitness function — compute every declared fg/bg token pair in both themes in CI; a failing pair blocks. **Effort:** S (one token nudge + the gate).

### 9. No skip-link on the portal — WCAG 2.4.1
First Tab lands on the logo; keyboard users traverse the whole header per page. **Concept:** standard bypass block, rendered by the portal shell. **Effort:** S.

### 10. The portal has no search — lag-vs-class (reader journey)
`hasSearch: false` on every portal page. For a stat portal, "find the number" is the #1 entry gesture. **Anchor:** ONS/Eurostat/OWID site search. **Concept:** search over the governed catalog — metrics, pages, dimensions are already declarations (0082's governed nouns); search is a *projection of the semantic layer*, not a text crawler. **Effort:** M (admit on the public-launch trigger; pairs with backlog #4 JSON-LD).

### 11. ⌘K is insert-only — the command surface is narrower than the class
The palette (nice: bilingual labels, type hints) lists only insertable elements; no navigate (pages/model), no actions (theme, save, publish), and the "დამატება" side panel has no search box. **Anchor:** Grafana/Figma/Superset multi-domain palettes. **Concept:** palette sections = projections of the same command registry as finding 3 (insert · navigate · act) — declare a command once, gain palette + menu + shortcut + cheat-sheet. **Effort:** S–M.

### 12. Save/undo state is invisible — authoring-status honesty
SAVE DRAFT is always enabled (no dirty tracking visible); no "saved · when" indicator; no autosave signal; Ctrl+Z gives zero feedback and no undo/redo buttons exist; PUBLISH sits disabled with no explanation why. **Anchor:** Figma "Saved" + autosave; Builder.io autosave/history. **Concept:** an always-visible authoring-status strip (dirty→saving→saved·time · undo/redo buttons · why-disabled tooltip on PUBLISH) — the *visible projection* of AR-47's editorial FSM, carded as its first slice, NOT a second versioning system. **Effort:** S.

### 13. No shortcut discoverability
`?` opens nothing; shortcuts are undocumented in-product. **Anchor:** Figma/Grafana/Superset `?` cheat-sheet. **Concept:** the sheet is one more projection of the command registry (11/3). **Effort:** S.

### 14. Icon authored as a raw token — P-OFFER violation in the inspector
Perspective identity: «ხატულა» is a free-text input holding `calendar` — a plumbing token in the author plane (Law 11) where an icon *picker* over the declared icon set belongs (P-OFFER: offered, never typed). **Effort:** S.

### 15. Publish-readiness gate — the stat-native concept nobody asked for yet
Per-element KA/EN fields exist (good), but nothing tells the author *"this page is 80% EN-complete, a11y-clean, all bindings resolve"* before PUBLISH. For a bilingual official portal this IS the publish gate. **Anchor:** Webflow pre-publish Audit panel · Contentful/Sanity locale-completeness · gov.uk a11y discipline. **Concept:** a publish-readiness checklist derived PURELY from the config tree + catalogs (empty-EN i18n fields · unbound/no-data elements · contrast/axe result · unresolved bindings · missing source citations), surfaced on the PUBLISH button and blocking on declared-critical rules. Pure derivation — no new authoring surface, no stored state. **Effort:** M. *(Checked: not in 0087–0091, not in the injection backlog, not AR-47 — AR-47 versions what was published; this gates what is publishable.)*

---

## Verified-good along the way (so nobody "fixes" them)
Canvas nodes keyboard-focusable 16/16 · Esc deselects cleanly · palette shows honest "accepts no children" state · pages dialog already has «შაბლონიდან | ცარიელი გვერდი» (templates exist — do not re-card) · updated/preliminary badges DO render (EN: "Prelim. · Updated: 2025") · map regions are `role=button` + tabindex (keyboard-reachable) · no horizontal overflow at 390/768 · studio fits 1280px · zero console errors on portal pages under normal load.

## Evidence
- Probes: `work/probe-proactive-sweep.mjs` (pass 1) · pass-2 script preserved as `work/probe-sweep2.mjs`.
- Screenshots: `work/authoring-truth/sweep/` — `portal-ka.png` (home) · `studio-insert.png` (chrome duplication + URL-param port + icon token) · `studio-selected.png` (mixed-locale inspector) · `studio-cmdk.png` (palette) · `portal-regional-dark.png` (contrast) · `portal-regional-mobile.png` (**the 429 dead-end**) · `portal-en.png`, `studio-pages.png`, `studio-rightclick.png`, `studio-1280.png`, `portal-regional-tablet.png`.

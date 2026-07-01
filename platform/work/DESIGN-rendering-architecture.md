# DESIGN — Rendering Architecture North-Star (CSR · SSR · SSG/ISR · Hybrid)

> **Decision doc for the owner.** Triggered by observed differences between client-side soft-nav and hard-refresh ("is hard-refresh the fix? are we building an SSR platform?"). Scope: the *rendering topology* of the public statistical-dashboard runner (`apps/geostat`). Read-only assessment; no code changed by this doc.
> _Author: platform-architect (Opus). Date: 2026-07-01._

---

## 0. TL;DR (the headline)

**The soft-nav issues are BUGS, not a property of CSR. SSR is not the remedy — do not buy SSR to fix a scroll/chart-resize bug. Stay CSR-SPA now and fix the bugs as bugs.**

**The genuine prize for a *public national-statistics* platform — SEO/crawlability, fast first paint, no-JS/low-bandwidth resilience — is delivered by *publish-time pre-rendering (SSG/ISR)*, NOT by per-request SSR.** And critically: **SSG keeps the static-nginx runner north-star (ADR-0026/0028) intact** — pre-rendered HTML is still static assets; the charts/map hydrate client-side regardless (ApexCharts/Leaflet are client-only). This is the Our-World-in-Data / Datawrapper model, and it fits our architecture because `render(config) → UI` is already pure and deterministic.

**Recommendation:** `(a)` now (fix bugs, stay CSR + static runner) **+** a designed `(c) SSG/prerender` north-star, activated only when SEO/discoverability becomes a stated mission requirement. **Full per-request SSR `(b)` is YAGNI** for a published stats platform. Keep the renderer pure + isomorphic-ready as a **fitness function** so the SSG door stays cheap to open later (seam-preservation, exactly as multi-tenancy is deferred-but-seamed).

---

## 1. Current state (verified in code)

| Fact | Evidence |
|---|---|
| **CSR SPA** — `<BrowserRouter>`, client render, no server render | `apps/geostat/src/main.tsx` (`ReactDOM.createRoot(...).render(<BrowserRouter>…)`) |
| **Served as static assets by nginx** | `index.html` CSP note ("nginx serves the SPA and proxies /api/"); ADR-0026/0028 static runner |
| **Server-Driven-UI**: content = JSON manifest fetched at boot | `site-manifest.ts` `bootstrapSite()` → `GET /api/bootstrap` (Grafana `bootData` / Retool `fetchAppManifest` pattern) |
| **Data fetched client-side** too | `fetchStores()` → `config.data_source` rows → `buildStoreManifest` (client) |
| **Charts = ApexCharts (client-only SVG)**, **map = Leaflet (client-only)** | `RendererSurface.tsx` header; `vite.config.ts` codeSplitting groups `apexcharts`/`leaflet` |
| **Heavy renderer graph is code-split** behind `React.lazy` | `App.tsx` `lazy(() => import('./RendererSurface'))`; eager shell = bootstrap + `AppSkeleton` only |
| **Soft-nav scroll parity already handled** in-engine (client-side) | `RendererSurface.tsx` `<RouteScrollManager/>` ("soft-nav resets to top like a hard load") |
| **Fail-soft**: unreachable API → brand-free empty page | `emptyManifest()` (ADR-0028 D4) |
| **North-star = static, content-agnostic runner** | ADR-0026 (generic SDUI runner) + ADR-0028 (de-tenanting → pure runner, content from API) |

The architecture is already a clean **Interpreter + Registry + SDUI** platform: `render(manifest) → UI` is deterministic and side-effect-free (Law 2). That purity is the single most important fact in this whole assessment — it is what makes *any* alternate rendering mode cheap to add later.

---

## 2. Diagnosis: are the soft-nav issues inherent to CSR, or bugs?

**They are bugs. Say it plainly to the owner: a correct SPA renders a soft-nav route identically to a hard load.** Hard-refresh "fixing" a symptom is the tell that state/layout is being reset by the full reload rather than by correct client logic — that is a defect to fix, not a rendering paradigm to adopt.

- **Scroll on soft-nav** — already fixed in-engine by `RouteScrollManager` (client-side). This *proves the point*: the fix was a small client component, not SSR.
- **Chart crispness / sizing on soft-nav** — this is the classic **ApexCharts/Leaflet resize-on-mount** bug: the chart measures its container *before* the new route's layout has settled (or the old chart instance isn't disposed/re-measured), so it renders at a stale/zero size and looks blurry or mis-scaled until a resize event. The remedy is a client fix — dispose + re-init on route change, `ResizeObserver`-driven remeasure, or a mount `key` keyed to the route (the same `useThemeVersion` remount seam AR-14 already uses for theme flips is the exact pattern). **A hard refresh masks it because a full reload guarantees a fresh mount at final layout — that is coincidence, not architecture.**

> **Do not sell SSR as a bug-fix.** SSR would *also* mask these (fresh mount per navigation), but at the cost of a Node render tier — using a sledgehammer to reset a client-state bug. Fix the client bug; keep the option of SSR/SSG for the reasons in §3, which are real and separate.

---

## 3. The genuine case FOR server rendering (weighted for a PUBLIC national-stats platform)

This platform is unusual: it is **two products in one shell** — an *interactive dashboard* (Grafana-class, behind exploration) **and** a *public statistical publication* (ONS/OWID-class, meant to be found and cited). The publication half is where server rendering earns its keep.

| Benefit | Weight (public NSO) | Reality check |
|---|---|---|
| **SEO / crawlability** — indicator pages should be discoverable & rank in Google/Bing, citable by aggregators & LLM crawlers | **HIGH (mission)** | Today crawlers hit an empty `<div id="root">` until JS runs. Googlebot *can* render JS (deferred second wave), but Bing/social/most LLM & data-aggregator crawlers often don't. For a national stats office, **findability of published data is a mission outcome**, not a nice-to-have. This is the strongest argument. |
| **No-JS / low-bandwidth resilience** — tables & text readable without/before JS | **MODERATE–HIGH** | Gov digital-service standards + WCAG favour progressive enhancement. Server-rendered **tables/text/metadata degrade gracefully**; **charts/map do NOT** (client-only). So the win is real *for the tabular/textual content*, which for a stats site is most of the value. |
| **First-paint speed on large dashboards** | **MODERATE** | The ~540 kB Apex chunk means a near-blank paint until the lazy renderer lands. A server-rendered shell paints layout+text+tables sooner — **but not chart pixels** (Apex/Leaflet hydrate client-side regardless). SSR gives you a faster *meaningful* paint, not a faster *chart*. |
| **Correctness-by-construction** — fresh server render per request | **LOW** | The SPA is *already* a deterministic `render(config)`. Per-request freshness matters only for highly dynamic/personalized content. A published stats page changes on a **release schedule**, not per request — so this argues for *pre-render-on-publish*, not per-request SSR. |

**The decisive nuance:** SEO + no-JS + first-paint are served **almost entirely by pre-rendering the published content** (titles, indicator descriptions, data tables, methodology, structured data) — **not by a per-request Node render loop.** National-accounts data is *published, cacheable content* (indicators revise on a known cadence, governed by the existing publish FSM `page_version.is_published`). That is the textbook profile for **SSG/ISR (pre-render + revalidate on publish)**, which the config store's publish lifecycle maps onto perfectly: *page published/revised → re-render that page.*

---

## 4. The case AGAINST / the true cost

| Cost | Detail |
|---|---|
| **Full SSR breaks the static-runner north-star** | ADR-0026/0028 deliberately made the runner **static nginx**. Per-request SSR introduces a **live Node render tier** — a stateful process to deploy, scale, monitor, and keep warm. This is the single biggest architectural cost and it directly contradicts a committed decision. |
| **Charts/map are client-only — SSR gives a *shell*, not chart pixels** | ApexCharts and Leaflet render SVG/canvas in the browser. **No rendering mode changes this.** Even "full SSR" is really *hybrid* here: SSR the shell + table + layout, hydrate the visualisations. Anyone promising server-rendered charts is wrong about our stack. |
| **Hydration complexity + mismatch bugs** | Isomorphic code (no `window`/`document` at module load), server/client markup parity, hydration mismatches, double-render pitfalls. A new class of bugs the current CSR app simply doesn't have. |
| **Config-driven per-tenant bootstrap dilutes SSR caching** | The SSR cache key multiplies across tenant × locale × permalink/perspective state. Per-request SSR of a highly-parameterised SDUI page has a **low cache hit rate** unless you constrain to canonical pages — at which point you've reinvented SSG. |
| **Migration cost from the static SPA** | Universal bundle, data-fetch moved to a loader/router boundary, the bespoke `vite.config.ts` source-alias graph re-tooled for an SSR build, an SSR entry + server. Non-trivial (see §7). |
| **Deep-interactive states can't all be pre-rendered anyway** | The Perspective-Lattice permalinks (AR-31: 2^N views) are unbounded — you pre-render the *canonical* page and let deep states hydrate/CSR. Crawlers only need the canonical set. |

---

## 5. How reference platforms render (grounding)

| Platform | Mode | Why | Relevance to us |
|---|---|---|---|
| **Grafana, Superset, Metabase, Tableau, Redash** | **CSR SPA** | Interactive, behind auth, no SEO need, heavy client interactivity | Matches our **interactive-dashboard half** — validates CSR for the exploration surface |
| **Our World in Data** | **SSG/SSR pages + client-hydrated charts** | Public statistical content; SEO + fast first paint + no-JS text, then hydrate D3/Grapher | **The sharpest analog** — a public stats site with interactive charts. Exactly the hybrid we'd target |
| **Datawrapper** | **Pre-rendered/SSG embeds; server-rendered fallback images** | Charts must load fast, be embeddable, degrade to an image | Confirms: pre-render the shell, ship a static/degraded fallback; interactivity hydrates |
| **ONS / Eurostat / OECD public pages** | **Server-rendered content, SEO-first** | National/international stats publications must be indexable & citable | Confirms SEO is a first-class requirement for an NSO surface |
| **News graphics (NYT/FT/Guardian)** | **SSG/prerender + progressive enhancement** | Fast, resilient, indexable; interactivity layered on | Confirms progressive enhancement as the public-content default |
| **Next.js / Remix** | **Hybrid (SSR/SSG/ISR per route)** | Route-level choice of render mode | The *mechanism* if we ever go hybrid — render mode per route, not per app |

**Conclusion from the field:** dashboard tools that live behind auth are CSR; public statistical/content platforms are SSG/SSR with client-hydrated charts. **We are both** — so the right answer is not "pick one mode for the whole app," it's "render the *published, public* surface statically (SSG) and let the *interactive* surface hydrate/CSR." Our pure `render(config)` engine is what makes serving both from one config tree possible.

---

## 6. The four options — comparison matrix

Legend: ✅ strong · 🟡 partial · ❌ weak/absent · 💥 breaks a committed decision.

| Criterion | (a) CSR-SPA *(current)* | (b) Full SSR *(Node render tier)* | (c) SSG/ISR *(pre-render on publish)* | (d) Hybrid *(SSR shell + hydrated charts)* |
|---|---|---|---|---|
| **SEO / crawlability** | ❌ empty root till JS | ✅ | ✅ (canonical pages) | ✅ |
| **First meaningful paint** | 🟡 (blank till chunk) | ✅ shell (not charts) | ✅ shell (not charts) | ✅ shell (not charts) |
| **No-JS / low-bandwidth** | ❌ (blank) | 🟡 text/table only | 🟡 text/table only | 🟡 text/table only |
| **Chart/map pixels** | client-only | client-only | client-only | client-only |
| **Correctness / freshness** | ✅ deterministic | ✅ per-request | ✅ per-publish (ISR) | ✅ per-request |
| **Ops complexity** | ✅ static nginx | ❌ live Node tier | ✅ static output (+build/publish hook) | ❌ live Node tier |
| **Static-runner north-star (ADR-0026/0028)** | ✅ preserved | 💥 broken | ✅ **preserved** (static HTML) | 💥 broken |
| **Multi-tenant / config-driven fit** | ✅ boot-per-manifest | 🟡 cache key explosion | ✅ pre-render per published site | 🟡 cache key explosion |
| **Migration cost from today** | — none | ❌ high | 🟡 moderate (prerender step) | ❌ high |
| **Fixes the soft-nav bugs** | ✅ *(fix as bugs)* | (masks, wrong tool) | (masks, wrong tool) | (masks, wrong tool) |

**Reading the matrix:** `(c) SSG/ISR` is the only option that delivers the public-platform prizes (SEO, first-paint, no-JS) **without breaking the static-runner north-star** and **without a live Node tier**. `(b)` and `(d)` add per-request SSR value that a *published* stats site does not need — their extra power over `(c)` is per-request freshness/personalization, which is YAGNI here.

---

## 7. Recommendation

### 7.1 NOW (do this)
1. **Fix the soft-nav bugs as bugs.** Scroll is already fixed (`RouteScrollManager`). For chart crispness/sizing: dispose+remount charts on route change (route-keyed mount, mirroring AR-14's `useThemeVersion` remount seam) and/or `ResizeObserver` remeasure. **No SSR.**
2. **Stay CSR-SPA + static nginx runner.** This preserves ADR-0026/0028 and costs nothing.
3. **Harden the renderer's isomorphic-readiness now** (cheap, high-leverage seam preservation — see §8). This keeps the SSG door a *door*, not a wall.

### 7.2 NORTH-STAR (design now, build on trigger) — `(c) SSG/ISR`, the OWID model
When SEO/discoverability becomes a **stated mission requirement** (owner decision, or a measured discoverability gap), add a **publish-time pre-render** of the canonical published pages:
- Server-render each published page's config to HTML (`renderToString`/`renderToPipeableStream`) using the *same* pure engine — **no engine changes**, only a new app-shell entry.
- Emit **static HTML per canonical page**, served by the **same nginx** (static-runner north-star intact). Charts/map/interactive perspective states **hydrate client-side** (OWID/Datawrapper reality).
- Wire the render to the **existing publish FSM** (`page_version.is_published`): publish/revise → re-render that page (on-demand ISR). This is a natural fit — the config store already knows *when content changed*.
- Add the cheap SEO scaffolding regardless: per-page `<title>`/`<meta>`/OpenGraph, **schema.org `Dataset`/`StatisticalDataset` JSON-LD**, a generated `sitemap.xml`, canonical URLs (permalink = canonical, Law 9).

**Why SSG not full SSR:** national-accounts content is published on a release cadence, not per-request — pre-render-on-publish gives every SEO/first-paint/no-JS benefit with **static output, best caching, and zero live render tier**. Full per-request SSR only adds value under per-request variability (auth-personalization, host-based MT with always-fresh HTML), which is not this platform's profile.

### 7.3 YAGNI (do NOT build now)
- **Full per-request SSR `(b)` / hybrid Node tier `(d)`** — reject until a real trigger: host-based multi-tenant serving *with per-request-fresh HTML*, personalization, or real-time data in the initial HTML. None exist today (MT is itself deferred, AR-30). Building the Node tier now is speculative complexity that contradicts a committed north-star.

---

## 8. Fitness functions (make the seam a test, not a hope)

The whole strategy hinges on the renderer staying **pure and server-renderable** so `(c)` stays cheap. Encode it:

1. **`FF-RENDERER-ISOMORPHIC`** — `renderToString(<NodePageRenderer config=… stores=…/>)` succeeds in a Node/jsdom test with **no `window`/`document` access at module load**. Guards against a plugin sneaking a browser-only import into the render path (the one thing that would silently weld the SSG door shut). *This is the single highest-value fitness function in this doc.*
2. **`FF-RENDER-DETERMINISTIC`** — `render(config)` is referentially transparent: same config ⇒ same DOM, no `Date.now()`/`Math.random()` in the render path (Law 2 already forbids logic in config; this guards the renderer side). Prerequisite for hydration-mismatch-free SSG.
3. **`FF-DATA-BEHIND-PORT`** — data access stays behind the `DataStore` port (already true), so a future SSG/loader can fetch server-side by swapping the port, not rewriting the tree.
4. **(when `(c)` builds) `FF-CANONICAL-PRERENDERED`** — every published page id in the manifest has a corresponding pre-rendered HTML artifact; a published page can never ship un-indexable.

These mirror how multi-tenancy is *deferred but seamed* (AR-30): the capability isn't built, but the invariant that keeps it cheap is enforced continuously.

---

## 9. Migration path (only if §7.2 is triggered) — additive, Strangler-Fig, reversible

The engine does **not** change. This is an app-shell capability added beside the CSR entry.

- **Phase R0 — Seam hardening (do now, standalone value):** land `FF-RENDERER-ISOMORPHIC` + `FF-RENDER-DETERMINISTIC`. Audit plugins for module-load browser access; move any to effect-time. *Gate: both FFs green. No behaviour change.*
- **Phase R1 — SEO scaffolding (cheap, no render tier):** per-page meta/OG/JSON-LD (`schema.org/Dataset`), `sitemap.xml`, canonical URLs. Ships on the current CSR app; immediate crawlability lift for the pages Googlebot *does* render. *Gate: valid structured-data + sitemap; Lighthouse SEO ≥ target.*
- **Phase R2 — Pre-render canonical pages (SSG):** new `entry-server.tsx` renders each published page's config via the pure engine to static HTML at publish time; nginx serves it; client hydrates. Charts/map/deep-perspective states hydrate/CSR. *Gate: `FF-CANONICAL-PRERENDERED`; hydration-mismatch-free; static-runner (nginx) unchanged.*
- **Phase R3 — On-demand ISR (publish-hook revalidation):** wire the publish FSM to re-render changed pages. *Gate: publish a revision → new HTML within SLA, no full rebuild.*
- **Phase R4 (only if a real per-request trigger appears) — promote to hybrid SSR:** stand up the Node render tier for the routes that genuinely need per-request HTML (host-MT-fresh, personalized). Everything else stays SSG. *Gate: a named, real requirement — never speculative.*

Every phase is reversible (flag/route-scoped) and additive; the CSR path remains the fallback throughout.

---

## 10. Rejected alternatives (ADR-style)

1. **Adopt SSR to fix the soft-nav differences** — REJECTED. The soft-nav issues are client bugs (scroll already fixed client-side by `RouteScrollManager`; chart sizing is a resize-on-mount bug). SSR would mask them at the cost of a Node render tier — a sledgehammer for a client-state reset. Root-cause the client bug (Law 6).
2. **Full per-request SSR `(b)` now** — REJECTED. Breaks the static-runner north-star (ADR-0026/0028), adds a live Node tier, and its only advantage over SSG (per-request freshness) is unused by a *published* stats site. Speculative complexity (YAGNI, Law 8).
3. **Hybrid SSR Node tier `(d)` now** — REJECTED (for now). Same Node-tier cost as `(b)`; justified only by per-request variability (host-MT-fresh, personalization) that doesn't exist yet. Kept as the R4 escalation *if* a real trigger appears.
4. **Stay pure CSR forever, do nothing for SEO** — REJECTED. Under-sells the real mission value: a national stats office's published data **must be discoverable and citable**. Leaving indicator pages behind an empty `#root` is a mission gap, not a neutral default.
5. **Hard-refresh on navigation as the "fix"** — REJECTED. Destroys SPA UX (full reload per nav), masks the bug instead of fixing it, and is astonishing to users (Principle of Least Astonishment). It is the *symptom* that revealed the bug, not a solution.

---

## 11. Alignment with project laws
- **Law 2 (declarative; logic in renderer):** the entire strategy rests on `render(config)` purity — hardened here into `FF-RENDERER-ISOMORPHIC`. SSG is literally "run the pure renderer on the server."
- **Law 4 (full benefit of standards):** adopts the OWID/Datawrapper public-stats pattern (SSG + hydrated charts) and schema.org `Dataset` — whole, in their best form.
- **Law 6 (root-cause):** soft-nav = fix the client bug, not paper over with SSR.
- **Law 7 (architecture leads):** SSG is *additive* to the target (pure engine unchanged); the app-shell grows a server entry — no engine bends to it.
- **Law 8 (platform thinking + YAGNI):** build the seam (isomorphic-readiness) now; build the capability (SSG) on a real trigger; refuse the Node tier until per-request need is real.
- **Law 9 (accessibility + permalink):** SSG advances no-JS resilience + WCAG progressive enhancement; canonical permalink = the pre-rendered URL.
- **ADR-0026/0028 (static runner):** **preserved** by SSG (static HTML on nginx); only `(b)`/`(d)` would break it — which is why they're deferred.
```

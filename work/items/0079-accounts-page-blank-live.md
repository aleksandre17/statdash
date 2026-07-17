# 0079 — /ka/accounts renders blank live (pre-existing, BOTH tiers)

**Observed (lead's live walk, 2026-07-16):** `/ka/accounts` mounts the page chrome (h1, filter bar, year select 2025) but ZERO apex canvases on **both** dev :3012 (post-batch) and prod :3002 (pre-batch) under headless Playwright (networkidle + full scroll + tall viewport). One run showed a red error strip with a **"Retry"** button (screenshot `work/portal-walk/06-accounts.png`); later runs: no visible error, no console errors, no HTTP ≥400 — silently empty.

**NOT a portal-review-batch regression** (identical on the pre-batch prod image). Ranked P1: it is one of the portal's three pages, and it blocks live verification of review note P15 (negative-axis floor lives on this page's dynamics charts).

**Open questions for the diagnosis (debugger, read-only first):**
- Is it headless-only (works in a real browser?) or user-visible? The owner's review notes reference working accounts charts — dated 2026-07-10.
- What query does the accounts hero (`sna-hero-range`) issue, and does it fail/park under `year=2025` + "ყველა"?
- Why is failure SILENT (no error state, no console) — a canvas-never-lies (Law 11) violation regardless of the trigger.

**Network evidence (lead, dev :3012, 2026-07-16):** ALL api responses 200; the per-account section queries RETURN rows (397–654b bodies); yet zero apex canvases mount → **render-layer, not data-layer**, and the failure is silent. One smell: `observations?...&filter={"measure":"*"}` → 11b `{"data":[]}` — a literal `*` wildcard shipped to the wire as an equality filter (wire-inexpressible operator leaking? cf. `applyClientFilter` in `store-api.ts`). May or may not be the trigger.

**Relation:** the accounts hero is also a `rangeSlider` chart — after the brush live-crash fix (card 0078 item P12) lands, re-walk this page first; the two defects may partially mask each other on dev.

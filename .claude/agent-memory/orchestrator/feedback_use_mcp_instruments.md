---
name: use-mcp-instruments
description: Owner directive 2026-07-16 — MCP/plugin adoption must be PRACTICED, not just written; check /mcp at session start, prefer playwright MCP over hand-rolled node -e probes
metadata:
  type: feedback
---

Owner (2026-07-16): "you're allowed any MCP/plugin that simplifies work, raises effectiveness, cuts tokens and time — if it's not written in the kit, write it; and adopt it IN PRACTICE."

**Why:** the doctrine already existed (`.claude/kit/feedback/feedback_instrument_selection.md`) and `.mcp.json` already carried playwright + chrome-devtools servers — yet the lead spent a whole session hand-writing `node -e` Playwright probes. Rule-on-paper without practice is exactly the "ship mechanism, defer adoption into invisibility" disease.

**How to apply:**
- At session start (or before the first live-browser/devtools task): check loaded MCP tools (`mcp__*` in the toolset). If `.mcp.json` servers aren't loaded, tell the owner once (approval may be pending) and fall back to the probe pattern.
- Live walks/screenshots/gestures → playwright MCP when loaded; hand-rolled `node -e` probes only as fallback (pattern: run from `platform/apps/panel` so `@playwright/test` resolves; routes are locale-prefixed `/ka/...`; carousel/lazy content needs explicit iteration).
- Before ANY repetitive manual toil, ask: is there an instrument that wins on quality·result·time·tokens? (kit rule, INDEX-mapped since 2026-07-16).
- Agents: name the winning instrument in briefs; new instrument finds come back in return packets → growth ladder.

**Wiring RESOLVED 2026-07-19:** `.mcp.json` declares `playwright` + `chrome-devtools` (owner `/mcp` confirmed BOTH connected — 23 + 29 tools; also claude.ai Google-Drive, 8 tools). The lead's own restricted surface can't call `mcp__*`, so browser-driving lives in the read-only VERIFIER role: granted `mcp__playwright, mcp__chrome-devtools` to **`explorer`** (live recon/verify) and **`chief-engineer`** (final review) frontmatter `tools:`. Build/edit agents deliberately DON'T get browser tools — single responsibility: build ≠ verify. Route live-UX verification to explorer (exploratory) / chief-engineer (review); keep committed probes for J-journey regression gates.

**The instrument rubric (quality × time × cost) — owner asked 2026-07-19 "calculate WHEN each is more efficient":**
- First-time / exploratory / craft-sweep live check (don't yet know what I'll find) → **Playwright MCP** (no script tax, adaptive, a11y-snapshot reasons better than pixel-match).
- console / network / perf forensics (our "0 console errors" DoD, 429 rate-limit diagnosis) → **chrome-devtools MCP** (purpose-built, structured).
- Deterministic, will-run-again regression gate (J1–J6 journeys) → **committed `.mjs` probe** (authored once, cheap to re-run, lives in repo as fitness-gate; MCP's N snapshot round-trips on a long walk cost MORE than one compiled probe).
- panel craft / UX polish → the installed **`frontend-design`** plugin (present, under-used).
Principle: MCP removes the SEARCH/script tax, not the THINKING — one-off live → MCP; permanent regression-gate → compiled probe. Related: [[cut-real-context-packets]], [[verification-fit-per-situation]].

**Live-run finding 2026-07-19 (first real MCP use, P1 verify):** `mcp__playwright__*` WORKS (drove :3013 login→studio→workbench, captured console + screenshots, PASS). `mcp__chrome-devtools__*` FAILED to launch — it needs a real Chrome "stable" channel installed on the box (absent); Playwright uses its own bundled Chromium. Workaround the agent used: stage Playwright's `ms-playwright/chromium-*/chrome-win64` into `%LOCALAPPDATA%\Google\Chrome\Application\` (a machine side-effect outside the repo). So until real Chrome is installed, route live verification to **Playwright MCP only**; chrome-devtools MCP (perf/network forensics) is unavailable. Playwright MCP's own console capture covered the "0 real JS errors" check fine.

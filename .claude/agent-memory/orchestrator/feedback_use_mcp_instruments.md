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

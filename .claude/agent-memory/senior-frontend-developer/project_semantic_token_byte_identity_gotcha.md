---
name: semantic-token-byte-identity-gotcha
description: The ADR §3 role→value "collapse" rows are NOT byte-identical — only the canonical token value of each role is. When tokenizing under a byte-identical mandate, map ONLY literals that exactly equal the resolved token value; report the ΔE<3 near-duplicates instead of collapsing them. Plus the SVG-presentation-attr var() limitation.
metadata:
  type: project
---

Tokenizing shells against the semantic spine ([[adr-semantic-token-theming-spine]], [[semantic-token-theming-spine-p0]]) under a **byte-identical** invariant has two systematic traps that the ADR's role→value table hides:

**1. ADR §3 "collapse" rows are intentionally ΔE<3 merges — NOT byte-identical.** Each role row lists several literals collapsing to ONE value, but only the FIRST (the canonical resolved token value) renders identically. The divergent near-duplicates (which a byte-identical pass MUST leave literal + report, not tokenize):
- text-secondary = `#4A5568` only. NOT `#2D3748`, `#445A66`.
- text-muted = `#6B7B8D` only. NOT `#5A7A8A`, `#718096`, `#6B8899`.
- text-faint = `#9AABB8` only. NOT `#94A3B8`, `#B0C4CC`.
- border-strong = `#C8D5D9` only. NOT `#CBD5E1`, `#CBD5E0`.
- border-interactive = `#B0C8D4` only. NOT `#B0C4CC`.
- surface-raised = `#FAFBFB` only. NOT `#F8FAFA`, `#F8FAFB`, `#F7FAFA`.
- accent-muted (geostat) = `#E6F3FA` only. NOT `#EAF4FB`, `#F0F8FF`.
- accent-secondary (geostat) = `#00A896` only. NOT `#2A9D8F`.
The "collapse" is only safe once Pfinal's pixel-diff gate accepts the ΔE trade (ADR escape-hatch). Until then: exact-match only.

**2. `var()` resolves in CSS contexts ONLY — not SVG presentation attributes.** Safe to tokenize: React inline `style={{ color: 'var(--x)' }}`, CSS custom-property values (`style={{ '--kc': 'var(--color-accent)' }}`), and ApexCharts `fill.colors`/`track.background` strings (the codebase already proved Apex resolves `var()`). NOT safe: JSX SVG presentation attributes (`<text fill="var(--x)">`, `<rect stroke=...>`) and JS-fed Leaflet `PathOptions` (`fillColor`) — `var()` is invalid as a presentation-attribute value → renders black/no-fill. Leave those literal; they belong to the chart-palette/`--chart-color-*` axis effort, not the neutral-token pass.

**3. Tier-3 per-element accent projectors** (`--sc`, `--kc` kpi-card, `--rc` region-chip, `--tc` tab, `--card-accent` hero-card): rebase their literal fallback `#0080BE` → `var(--color-accent)` exactly like `--sc` did in P0. `--rc`/`--tc` are never set in TSX (always fall through to fallback) so the rebase is pure win.

**4. Status tones diverge from `--status-*` tokens** — data-table OBS_STATUS badges (`#FFF3CD`/`#856404` etc.) and kpi preliminary badge do NOT equal `--status-warning-*` (`#fff6e5`/`#8a5a00`). ADR says "map to --status-*" but that breaks byte-identity → report, don't remap, until the status-token values are reconciled.

P3/P4/P5 status after this pass: nodes+panels+pages CSS + the var()-safe TSX inline styles are tokenized and green (1054 passed). Off-table literals deliberately left + reported (see the pass report): `#0d3b66`, `#f8f9fa`, `#CCE8F5`, `#F0F8FF`, `#D8E4E8`, `#E76F51`, status-badge/tfoot tones, chart-frame greys, SVG/Leaflet data fills. FF-TOKEN-ONLY stays `warn` (Pfinal flips it) — so these residuals don't fail CI yet.

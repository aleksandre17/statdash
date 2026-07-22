---
name: enc1-canonical-encoding
description: DESIGN-0113 ENC-1 — canonical encoding grammar; role channels kept (NOT VL x/y), VL per-channel record adopted whole; 5 legacy carriers become projections; E0 lands BEFORE the E2 encoding.edit editor
metadata:
  type: project
---

ENC-1 (card 0113, DESIGNED 2026-07-22): the canonical encoding grammar. SSOT =
`docs/architecture/proposals/DESIGN-0113-canonical-encoding-grammar.md`.

**Why:** owner observed EncodingSpec is a toy vs the canonical concept (Law 4).
Ground truth: the encoding law is forked across FIVE carriers — EncodingSpec
(core/data/encoding.ts:152), ChartDef axes/legend/palette (charts/types.ts:29),
FieldConfig (core/field/config.ts:59), the directional six-var record
(_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir, core/data/directional.ts:69),
and per-spec-kind implicit encodings (row-list/timeseries/growth/ratio-list/pivot)
— plus ad-hoc ChartOutput.emphasis and hand-enumerated authoring surfaces
(ENCODING_WELLS, EncodingEditor). Projection-missing disease on the encoding axis.

**The decided cut (surprising parts):**
- Channel NAMES stay role-based (label/value/series/color) — NOT renamed to VL
  x/y. Reasons: AR-36 mark rotation ({$ctx:_mark} donut⇄bar) rewrites no channel
  (ggplot coord-flip model = Law 4 "best form"); today's corpus is already the
  canonical degenerate subset (no rewrite); bare-string `color` (identity fill)
  would shape-collide with VL's scale-mapped color.
- ADOPT WHOLE: the VL per-channel field-def record — aggregate/bin/sort/scale/
  axis/legend/format/condition added to ChannelDef, all optional/additive; depth
  = what renderers realize today + open registry strings (scale.type, scheme).
- New channels: size/opacity/shape/text/detail/order/facet — declared, with
  honest `realized` state in a CHANNEL_REGISTRY (ChannelSchema) that describeApp
  exposes as `encodingChannels`; E2 editor + field wells render generically from
  it (ADR-049 pattern).
- Directional verdict: shadow encoding in OUTPUT vocabulary only — fix is typing
  (resolveDirectional returns typed EncodingPatch; projectAxisVars derives the
  six legacy vars byte-identically), not plumbing.
- Cascade law: def-level ChartDef/FieldConfig settings = channel DEFAULTS,
  channel-level wins; merged at the ONE useChartOutput adapter seam.

**How to apply:** E0 (types+registry+normalize+fitness, no consumer change) MUST
land before E2's encoding.edit editor. Fitness set: FF-ENCODING-CANON-BYTE (corpus
byte-identity), FF-ONE-ENCODING-GRAMMAR (ratchet, 5 frozen legacy carriers),
FF-DIRECTIONAL-PATCH-PARITY, FF-CHANNEL-SCHEMA-COMPLETE, FF-NO-HEX-IN-SCALE.
Rejected: VL-verbatim dependency · status quo · full-VL-surface-now (layer/concat
forbidden — Law 10, composition belongs to ADR-041) · contracts relocation.
Related: [[ar40-semantic-layer-featured-slider]], [[adr050-canonical-panel-ia]].

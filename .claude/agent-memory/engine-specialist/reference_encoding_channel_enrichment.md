---
name: encoding-channel-enrichment
description: EncodingChannel = string | ChannelDef{field,type?,key?} (ADR R2); bare string is byte-identical default; type default-derived, key refines DataRow.id identity
metadata:
  type: reference
---

# Encoding channel enrichment (ADR R2)

`data/encoding.ts`: field-bearing channels (`label`/`value`/`color`/`series`) are now
`EncodingChannel = string | ChannelDef` where `ChannelDef = { field, type?, key? }`.
Vega-Lite parity: `type` = `MeasurementType` (quantitative|ordinal|nominal|temporal),
`key` = D3 data-join key. Structural channels (`id`/`isTotal`/`isSeparator`/`level`/`parentId`)
stay bare `string` — R2 only enriched the 4 primary field channels.

**Byte-identity (FF-ENCODING-ADDITIVE):** a bare string === `{field}` with no type/key.
`applyEncoding` reads every channel through `channelField()` so a string resolves to itself.
- `type` is carried METADATA — `applyEncoding` does NOT consume it (no DataRow change). It's
  for downstream scale/axis/format refinement; `resolveMeasurementType(c, fieldType, role)`
  returns explicit type else `deriveMeasurementType` (time→temporal, measure/number→quantitative,
  else nominal; ordinal never auto-derived). Derivation mirrors `fieldSchema.ts` sniff signal.
- `key` wires into `DataRow.id`. Precedence: `enc.id` field > channel `key` field > positional
  `label::series` auto-id. No existing config declares key ⇒ byte-identical.

**Accessors (exported from core barrel + data barrel):** `channelField` / `channelType` /
`channelKey` / `deriveMeasurementType` / `resolveMeasurementType`. Types: `MeasurementType`,
`ChannelDef`, `EncodingChannel`.

**Consumers to update when widening a field channel:** `apps/panel/.../EncodingEditor.tsx`
reads channels into TextField values — must go through `channelField()` (string-only TextField).
`validation/pipeline.ts` uses `!spec.encoding?.label` truthiness (object is truthy — fine).
EncodingSpec is NOT in the emitted `page-config.schema.json` (gen:schema byte-identical).

Test oracle: `data/encoding.additive.test.ts` (12 tests). Full suite 1299→1311 green.

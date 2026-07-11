// ── rawJsonEscape — the dev-only escape hatch for the raw-JSON control ──────────
//
//  FF-NO-RAW-JSON-DEFAULT: rich/opaque values (DataSpec · ChartDef · opaque
//  object/array) NEVER render as a raw-JSON textarea in the default authoring path
//  — they render as a constant-weight SummaryCard (glance projection + Open editor).
//  `JsonControl` survives ONLY as a developer escape hatch, gated here.
//
//  The gate is OFF by default. It turns ON in two ways, both explicit and dev-only:
//    • a `?rawjson` URL param on the Studio (a developer inspecting a value's raw
//      shape in the browser — reversible, per-session, never the default);
//    • an explicit test/override via `setRawJsonEscape()` (fitness + unit seams).
//
//  Pure module state — no React, no store. Read at control-resolution time so a
//  toggle takes effect on the next render without a reload of the module graph.
//
let override: boolean | null = null

/** Force the escape on/off (tests + a future dev toggle). `null` → derive from URL. */
export function setRawJsonEscape(on: boolean | null): void {
  override = on
}

/** True when the raw-JSON escape hatch is enabled (dev-only). Default: false. */
export function isRawJsonEscapeEnabled(): boolean {
  if (override != null) return override
  try {
    return new URLSearchParams(window.location.search).has('rawjson')
  } catch {
    return false // no DOM (SSR/tests) → escape is off, SummaryCard is the default
  }
}

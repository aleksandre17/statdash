// ── cssVar (charts-local twin) — semantic token → literal, for the emit path ───
//
//  The SVG emitter writes colours as SVG PRESENTATION ATTRIBUTES
//  (`<rect fill="…">`, `<text fill="…">`, `<line stroke="…">`) where CSS
//  `var(--token)` is INVALID — a raw `var()` in an SVG attr renders as black /
//  no-fill. So every colour must reach the attribute as a resolved LITERAL.
//
//  This mirrors the platform's `cssVar` (packages/styles/src/utils/cssVar.ts),
//  but is a DELIBERATE charts-local copy, NOT an import: `charts` sits inside the
//  dependency arrow (contracts ← expr ← core ← charts ← react) and MUST NOT
//  import `@statdash/styles` (Law 3) — styles is a render-layer leaf, outside
//  the arrow for the pure interpretation layer. Each side of that boundary owns
//  its own token-resolution twin; the SSOT for the token VALUES stays single
//  (`@statdash/styles` tokens.css) — only the tiny resolver is duplicated.
//
//  Resolution is theme-aware WHERE a cascade exists (a browser export resolves
//  against the live [data-tenant]/[data-theme] cascade). The `fallback` — the
//  canonical light-mode value copied from tokens.css — is used when there is no
//  DOM, which is the emitter's PRIMARY mode (server-side SSR / thumbnail /
//  export). So a pure server emit stays deterministic (always the fallback) and
//  DOM-free, while a themed browser export re-themes for free — the OCP seam the
//  emitter documents, with zero call-site edits.
//
export function cssVar(name: `--${string}`, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

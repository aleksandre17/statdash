/// <reference types="vite/client" />

// ── Panel env vars (Vite import.meta.env) ─────────────────────────────────────
//
//  Augments Vite's ImportMetaEnv with the panel's own VITE_ variables so reads
//  are typed (not `any`). Merges with vite/client's base ImportMetaEnv; the
//  index signature it declares still covers any unlisted var.
interface ImportMetaEnv {
  /** API base URL (empty ⇒ same-origin). */
  readonly VITE_API_URL?: string
  /** Canonical-format documentation URL surfaced in the Excel upload panel. */
  readonly VITE_CANONICAL_FORMAT_DOC?: string
  /**
   * AR-49 Studio shell flag. 'true'/'1' mounts the StudioShell in place of the
   * 3-step wizard. Off by default (wizard stays the default surface until M1.3).
   */
  readonly VITE_STUDIO_SHELL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

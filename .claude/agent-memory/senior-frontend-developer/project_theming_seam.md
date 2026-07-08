---
name: project-theming-seam
description: How visual themes work on the platform — the data-theme attribute + semantic-token override seam in @statdash/styles, and how ctx.theme threads to it
metadata:
  type: project
---

The platform theming seam is **`data-theme` on the outermost element + semantic-token override in CSS**, NOT per-element styles. This is the single mechanism for dark mode and (N44) high-contrast.

**Mechanism (SSOT):** `packages/styles/src/css/tokens.css` defines all semantic tokens in `:root` (`--color-surface`, `--color-text-primary`, `--color-border`, `--color-accent`, status/chart tokens). A theme is a selector block (`[data-theme="dark"]`, `[data-theme="high-contrast"]`, `@media prefers-contrast`, `@media forced-colors`) that overrides ONLY those semantic tokens. Spacing/radii/type/motion stay theme-neutral. A new theme adds no new var — so the `tokens.parity.test.ts` fitness function (every `var(--*)` in `src/tokens/**` must have a `:root` def) keeps passing.

**Runtime threading (N44):** `RenderContext.theme?: 'default' | 'high-contrast'` (optional, additive) → `SiteRenderer.NodePageRenderer({ page, theme })` emits a `display:contents` wrapper `<div data-theme=...>` only when theme is set; `StaticRenderContext.theme` → `renderPageToHTML` sets `data-theme` on the `.geostat-snapshot` div. The real visual root `.app-shell` lives in `packages/plugins/chrome/AppChrome.tsx` (also carries `data-frame`) — packages/react cannot touch it (Law 3), hence the wrapper.

**Why:** WCAG 2.1 AA (Law 9). High-contrast palette = bg `#000`, text `#FFF`, borders/links/accent `#FFFF00` (white-on-black 21:1, yellow-on-black 19.6:1).

**How to apply:** To add/adjust a theme, edit only the token-override block in `tokens.css` — never add element selectors. To thread a new theme value, it flows ctx.theme → data-theme attribute; the field is optional so existing callers are unaffected. See [[feedback-engine-react-no-registerslice-in-tests]].

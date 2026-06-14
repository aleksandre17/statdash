# Styling Architecture

> Reference orgs: ONS Design System · shadcn/Radix · Grafana
> Pattern: CSS Custom Properties + CSS Modules + BEM

---

## Decision

**CSS Custom Properties + CSS Modules + BEM** — ONS/shadcn hybrid.

Zero JS runtime cost. Shell-owned styles. Constructor-ready token system.

---

## Why This Pattern

| Criterion | Decision |
|---|---|
| Open/Closed | Token names generic, values branded — any project overrides values, never names |
| Shell pattern | Shell owns its CSS — swap shell = swap styles |
| Constructor (Phase 2) | CSS vars set from DB → white-labeling without code |
| engine/react/ agnostic | DEFAULT_THEME = minimal functional CSS, zero brand |
| Runtime cost | Zero — no emotion/styled-components overhead |
| Semantics | BEM: readable, predictable, no collision |

---

## Layer Rules

```
engine/react/  → DEFAULT_THEME shells → *.css (layout only, zero brand color)
src/styles/      → tokens.css (--geostat-* variables — all brand decisions here)
src/components/  → GeostatXxxShell.module.css (brand styles, consume tokens)
```

**Rule:** engine/react/ CSS uses only layout properties (display, flex, gap, position).
**Rule:** Brand colors, typography, spacing → src/styles/tokens.css only.
**Rule:** Shell component owns its CSS file — no shared global stylesheets for components.

---

## Token File — src/styles/tokens.css

```css
:root {
  /* Color */
  --geostat-color-primary:    #0080BE;
  --geostat-color-secondary:  #00A878;
  --geostat-color-accent:     #E85D04;
  --geostat-color-surface:    #F8F9FA;
  --geostat-color-border:     #DEE2E6;
  --geostat-color-text:       #212529;
  --geostat-color-text-muted: #6C757D;

  /* Spacing */
  --geostat-spacing-xs:  4px;
  --geostat-spacing-sm:  8px;
  --geostat-spacing-md:  16px;
  --geostat-spacing-lg:  24px;
  --geostat-spacing-xl:  32px;

  /* Typography */
  --geostat-font-family: 'BPG Arial', system-ui, sans-serif;
  --geostat-font-size-sm:  13px;
  --geostat-font-size-md:  15px;
  --geostat-font-size-lg:  18px;
  --geostat-font-size-xl:  24px;

  /* Radius */
  --geostat-radius-sm: 4px;
  --geostat-radius-md: 8px;

  /* Shadow */
  --geostat-shadow-sm: 0 1px 3px rgba(0,0,0,.08);
  --geostat-shadow-md: 0 4px 12px rgba(0,0,0,.12);

  /* Z-index */
  --geostat-z-sticky:  100;
  --geostat-z-overlay: 200;
}
```

Phase 2 (Constructor white-labeling): override `:root` vars per tenant from DB.

---

## File Structure

```
src/
  styles/
    tokens.css              ← all brand decisions (import once in main.tsx)
    reset.css               ← minimal reset (optional)

  components/
    theme/
      GeostatSectionShell/
        index.tsx
        styles.module.css
      GeostatFilterBarShell/
        index.tsx
        styles.module.css
      GeostatChartShell/
        index.tsx
        styles.module.css
      GeostatAppHeader/
        index.tsx
        styles.module.css
      GeostatAppSidebar/
        index.tsx
        styles.module.css

engine/react/
  src/
    theme/
      defaults/
        DefaultSectionShell.tsx
        default-section.css     ← layout only, zero brand
        DefaultFilterBarShell.tsx
        default-filter-bar.css
```

---

## BEM Convention

```css
/* Block */
.filter-bar { }

/* Element */
.filter-bar__item { }
.filter-bar__errors { }

/* Modifier */
.filter-bar--sticky { }
.filter-bar__item--active { }
```

CSS Modules handle scoping — BEM provides readability within the module.

```tsx
import styles from './styles.module.css'

<div className={styles['filter-bar']}>
  <div className={`${styles['filter-bar__item']} ${isActive ? styles['filter-bar__item--active'] : ''}`}>
```

Or with a `clsx` utility:
```tsx
<div className={clsx(styles['filter-bar'], { [styles['filter-bar--sticky']]: isSticky })}>
```

---

## DEFAULT_THEME Shell CSS (engine/react/)

Minimal — layout only. No colors. No fonts. Just structure.

```css
/* default-section.css — engine/react/ */
.section {
  display:        flex;
  flex-direction: column;
  gap:            var(--section-gap, 16px);   /* falls back gracefully */
}

.section__header {
  display:     flex;
  align-items: center;
  gap:         8px;
}

.section__body {
  flex: 1;
}
```

No `--geostat-*` tokens here — packages/ doesn't know Geostat.
Uses generic fallback vars (`--section-gap`) that src/ can override.

**Generic fallback var naming convention (H-6):**

```css
/* engine/react/ ALLOWED generic vars — no --geostat- prefix: */
--section-gap        /* fallback: 16px */
--filter-bar-height  /* fallback: 56px */
--kpi-card-min-width /* fallback: 180px */
--chart-min-height   /* fallback: 300px */

/* src/styles/tokens.css OVERRIDES these via cascade: */
:root {
  --section-gap:        var(--geostat-spacing-lg);   /* 24px from token */
  --filter-bar-height:  64px;
  --kpi-card-min-width: 200px;
  --chart-min-height:   360px;
}
```

**Rule:** engine/react/ shells declare generic fallback vars.
src/styles/tokens.css maps them to `--geostat-*` tokens.
Shell code never changes — only token values change per project.

---

## GEOSTAT_THEME Shell CSS (src/)

Uses tokens. Adds brand.

```css
/* GeostatSectionShell/styles.module.css */
.section {
  background:    white;
  border-radius: var(--geostat-radius-md);
  box-shadow:    var(--geostat-shadow-sm);
  padding:       var(--geostat-spacing-lg);
}

.section__header {
  border-bottom: 1px solid var(--geostat-color-border);
  padding-bottom: var(--geostat-spacing-sm);
  margin-bottom:  var(--geostat-spacing-md);
}

.section__title {
  font-family: var(--geostat-font-family);
  font-size:   var(--geostat-font-size-lg);
  color:       var(--geostat-color-text);
}
```

---

## Anti-Patterns

```
❌  Global component classes (.filter-bar in global CSS) — collision risk
❌  Inline styles for brand decisions — Constructor cannot override
❌  Geostat tokens in engine/react/ CSS — packages/ is agnostic
❌  emotion/styled-components in packages/ — runtime cost, dependency
❌  Hardcoded hex colors in component CSS — use tokens
❌  One giant styles.css — no scoping, impossible to maintain
```

---

## Phase 2 — Constructor White-Labeling

```
Constructor DB → tenant_config { primaryColor, fontFamily, ... }
    ↓
GET /api/site-manifest → includes theme tokens
    ↓
<style>:root { --geostat-color-primary: ${tenant.primaryColor}; }</style>
    ↓
All shells pick up new values — zero code change
```

Same pattern as SiteManifest: data-driven, zero code for new tenants.

---

## Theme Folder Structure + Shell Variants

### რატომ გადაიხედა

პირველი მიდგომა (`'section:card'` ShellMap keys) = narrowing.
Variant names pre-registration-ი = closed. PRINCIPLES.md-ის დარღვევა.
Constructor-ს app layer **აქვს** — Constructor IS the app. False premise იყო.

### გადაწყვეტილება: Variant → CSS, არა multiple shells

```tsx
// ერთი shell, def.variant → CSS modifier class (Material UI / shadcn pattern)
// view: ResolvedViewParams — resolved by engine (step 4). Never read def.view (ExprVal).
// role toggle: generic — no hardcoded 'chart'/'table' (PRINCIPLES rule 1 + SOLID O)
function GeostatSectionShell({ def, children, view }: SectionShellProps) {
  const roles = [...new Set(
    children.defs.map(d => d.layout?.role).filter((r): r is string => !!r)
  )]
  const [activeRole, setActiveRole] = useState<string | undefined>(roles[0])

  return (
    <div className={clsx(styles.section, def.variant && styles[`section--${def.variant}`])}>
      {view.subtitle && <p className={styles['section__subtitle']}>{view.subtitle}</p>}
      {roles.length > 1 && (
        <div className={styles['section__toggle']}>
          {roles.map(role => {
            const label = children.defs.find(d => d.layout?.role === role)?.layout?.label ?? role
            return (
              <button key={role}
                className={clsx(styles['toggle-btn'], role === activeRole && styles['toggle-btn--active'])}
                onClick={() => setActiveRole(role)}>
                {label}
              </button>
            )
          })}
        </div>
      )}
      {children.rendered.map((child, i) => {
        const role = children.defs[i].layout?.role
        const visible = !role || role === activeRole
        return (
          <div key={i} className={clsx(styles['section__view'], !visible && styles['sr-only'])}>
            {child}
          </div>
        )
      })}
    </div>
  )
}
```

```css
/* styles.module.css */
.section         { /* default */ }
.section--card   { border-radius: var(--geostat-radius-md); box-shadow: var(--geostat-shadow-sm); }
.section--panel  { border: 1px solid var(--geostat-color-border); }
```

`NodeBase.variant?: string` (already on NodeBase) → CSS modifier. ShellMap: zero change.
Constructor sets `node.variant = 'card'` in JSON → CSS handles it. No new shell registration.

### Folder Structure (shadcn / Grafana standard)

```
engine/react/
  src/theme/defaults/
    SectionShell/
      index.tsx          ← layout only, zero brand
      default.css
    FilterBarShell/
      index.tsx
      default.css
    ChartShell/
      index.tsx
    TableShell/
      index.tsx
    KpiStripShell/
      index.tsx
    PageShells/
      InnerPageShell/
        index.tsx
      TabPageShell/
        index.tsx
      ContainerPageShell/
        index.tsx

src/components/theme/
  GeostatSectionShell/
    index.tsx            ← brand + all variants via CSS modifiers
    styles.module.css
  GeostatFilterBarShell/
    index.tsx
    styles.module.css
  GeostatChartShell/
    index.tsx
    styles.module.css
  GeostatAppHeader/
    index.tsx
    styles.module.css
  GeostatAppSidebar/
    index.tsx
    styles.module.css
```

### Manifest → Tokens (Phase 2 token delivery)

```ts
// SiteManifest — token overrides from DB:
interface SiteManifest {
  stores: Record<string, DataStore>
  pages:  Record<string, PageConfig>
  nav:    NavItem[]
  tokens?: Record<string, string>    // CSS variable overrides — JSON-serializable ✅
}

// App.tsx — apply tokens before render:
const tokenStyle = Object.entries(manifest.tokens ?? {})
  .map(([k, v]) => `${k}:${v}`)
  .join(';')
// → <style>:root { --geostat-color-primary:#FF0000; }</style>
```

Constructor DB stores token overrides → manifest API returns them → CSS vars → all shells update. Zero code change.

### Platform Reference

| Platform | Variant pattern | Folder |
|---|---|---|
| shadcn | `variant` prop → CSS class (one component) | folder-per-component |
| Grafana | plugin type = separate registration; CSS for appearance | folder-per-component |
| Material UI | `variant` prop → CSS modifier (one component) | folder-per-component |
| Builder.io | CSS class variants; component is one | registry-based |

**Consensus:** variant = CSS, not multiple component registrations.

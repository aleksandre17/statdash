
# SOLID Principles — Applied to Geostat Architecture

> SOLID is not theory here. Every principle maps to a concrete architectural decision already made.
> New code is valid only if it doesn't violate any of these five mappings.

---

## S — Single Responsibility

> "A module should have one, and only one, reason to change."

### How we apply it

| Layer | One Responsibility |
|---|---|
| `NodeRenderer` | Dispatch to shell. Nothing else. |
| `Shell` (`GeostatSectionShell`) | Brand + interaction (toggle, collapse, hover). |
| `interpretSpec` | Convert DataSpec + ctx → DataRow[]. |
| `evalExpr` | Evaluate ExprVal → primitive value. |
| `defineFilters` | Parse filter schema → typed FilterBarSpec[]. |
| `useFilters` | Bind filter state to URL + emit ctx. |
| `fromSDMX` | Convert wire format → Observation[]. One conversion, nothing more. |

### Violations to watch for

```ts
// ❌ Renderer doing brand logic
export const SectionRenderer = (def, ctx) => {
  const [showChart, setShowChart] = useState(true) // ← Shell's job
  return <section>...</section>
}

// ❌ Shell doing data fetching
function GeostatSectionShell({ def, children }) {
  const { data } = useStoreQuery(...) // ← Renderer (or inner component) job
}

// ❌ fromSDMX computing SNA business rule
function fromSDMX(resp) {
  const isCarryForward = obs.isBalancing === 1 && obs.side === 'R' ... // ← backend's job
}
```

---

## O — Open/Closed

> "Open for extension, closed for modification."

### How we apply it

The registry pattern is the architecture's answer to Open/Closed:

```ts
// engine/react/ — CLOSED for modification (no Geostat code here)
const DEFAULT_REGISTRY: NodeRegistry = {
  'section':   SectionRenderer,
  'filter-bar': FilterBarRenderer,
  'chart':     ChartRenderer,
  'table':     TableRenderer,
  // ...built-ins only
}

// src/ — OPEN for extension (add without touching packages/)
engine.extend(nodeRegistry)  // registers 'landing-hero', 'regional-map', etc.
```

```ts
// ThemeConfig shells — same pattern
export const GEOSTAT_THEME: ThemeConfig = {
  shells: {
    ...DEFAULT_THEME.shells,       // extend from defaults
    'section': GeostatSectionShell, // override one without touching others
    'landing-page': GeostatLandingShell, // add new type
  }
}
```

### Rule

**Never reach into `packages/` to add app logic.**
- ✅ `engine.extend(nodeRegistry)` in `src/app/setupEngine.ts`
- ❌ Modifying `engine/react/src/engine/renderers/` for Geostat nodes

---

## L — Liskov Substitution

> "Subtypes must be substitutable for their base type."

### How we apply it

Every `NodeDef` subtype must satisfy the `NodeBase` contract:

```ts
interface NodeBase {
  type:    string
  layout?: LayoutHints
  derive?: Record<string, DeriveEntry>
  visibleWhen?: ExprVal
  view?:   ViewHints
}
```

Any node renderer that receives `NodeBase` must work with ANY concrete subtype.
The engine never specializes on `type` — it dispatches via registry.

```ts
// ✅ Engine: type-agnostic dispatch
const renderer = registry.get(def.type) // no if/switch on type
renderer(def, ctx, children)

// ❌ Engine: type-specific branching
if (def.type === 'section') { ... }
else if (def.type === 'chart') { ... }
```

**DataRow substitutability:** `DataRow` = `Record<string, DimVal | null>`.
All interpretSpec variants return this. Chart/table receive DataRow[] — not `SectionDataRow[]`.

---

## I — Interface Segregation

> "No client should depend on methods it does not use."

### How we apply it

Shell props are typed **per shell**, not one fat union:

```ts
// ✅ Narrow prop interface per shell
interface SectionShellProps {
  def:      SectionNode
  children: ChildrenArg
}

interface FilterBarShellProps {
  def:  FilterBarNode
  bars: FilterBarSpec[]
}

// ❌ Fat shell props (forces every shell to handle every field)
interface ShellProps {
  def:      NodeBase
  children?: ChildrenArg
  bars?:    FilterBarSpec[]
  nav?:     NavItem[]
  // ... every possible field
}
```

**DeriveMap vs DeriveEntry separation:**
- `@geostat/expr` — `DeriveMap = Array<{ key, expr: ExprVal }>` (pure)
- `@geostat/engine` — `DeriveEntry = ExprVal | DataLookupOp` (engine-level)

Engine clients don't depend on `DataLookupOp`. Expr clients don't know about `DataLookupOp`.

---

## D — Dependency Inversion

> "Depend on abstractions, not concretions."

### How we apply it

**ThemeConfig = the abstraction. Shell = the concretion.**

```ts
// Renderer depends on abstraction (ctx.theme.shells record)
const Shell = ctx.theme.shells['section'] ?? DEFAULT_THEME.shells['section']!
return <Shell def={def} children={children} />

// NOT on a concrete import
import { GeostatSectionShell } from '../../../src/components/...' // ❌ NEVER
```

**DataStore = the abstraction. Static/API store = the concretions.**

```ts
// interpretSpec depends on DataStore interface
function interpretSpec(spec: DataSpec, ctx: SectionContext, store: DataStore): DataRow[]
// caller swaps store (static → API) with zero config change
```

**defineFilters depends on ParamDef (abstract type union), not on concrete filter components.**

---

## Mapping Table

| Principle | Architectural Decision |
|---|---|
| **S** — Single Responsibility | Renderer dispatches. Shell renders. Adapter converts. Pure separation. |
| **O** — Open/Closed | Registry + `engine.extend()`. packages/ closed, src/ open. |
| **L** — Liskov | `NodeBase` contract. Engine dispatches by `type`, never branches on it. |
| **I** — Interface Segregation | Per-shell typed props. DeriveMap/DeriveEntry split. |
| **D** — Dependency Inversion | `ctx.theme.shells` injection. `DataStore` interface. `defineFilters` on ParamDef. |

---

## Litmus Test (ask before every PR)

```
1. Does this change add logic to the wrong layer?  (S violation)
2. Do I need to touch packages/ to add an app feature? (O violation)
3. Does this renderer branch on `def.type`? (L violation)
4. Does this shell receive props it doesn't use? (I violation)
5. Does this renderer import a concrete src/ component? (D violation)
```

**One YES = stop, redesign.**

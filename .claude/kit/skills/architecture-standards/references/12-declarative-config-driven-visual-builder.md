# 12. Declarative / config-driven / visual-builder platforms (Builder.io / Form.io class)
For systems where a **JSON/config tree is authored (visually or by hand) and a generic renderer interprets it** — low-code builders, form engines, dashboard constructors, headless CMS.

- **Config is the Single Source of Truth** — the serialized config fully describes the artifact; the renderer is pure `render(config) → UI`, deterministic and side-effect-free. Visual editor ↔ JSON must be a **lossless round-trip** (what you build = what serializes = what renders).
- **Declarative over imperative** — config carries *data and intent*, never logic/functions/`fetch`/conditionals-as-code. Behavior lives in the renderer/registry. A function in config = not serializable = not builder-ready.
- **Core patterns:** **Interpreter** (walk the config tree) + **Composite** (nodes contain nodes) + **Registry** (node-type → renderer/component, the open extension point) + **Strategy** (per-type behavior) + **Abstract Factory** (instantiate by discriminant). **OCP via discriminated unions / registry** — a new node type = a new capability, the interpreter interface unchanged.
- **Schema-driven & contract-first** — **JSON Schema** (or a typed DSL) defines valid config; validate at the boundary. References: JSON Forms, React-JSONSchema-Form (RJSF), Vega-Lite (grammar-of-graphics → declarative viz), Form.io component schema, Builder.io content model, Backstage software templates.
- **Capability discovery / palette** — the builder must *browse* what exists: every capability is declared and schema-introspectable (the "Constructor sees only what's registered" rule). Ship capabilities, not one-offs.
- **Safe expression evaluation** — bindings/conditions evaluated in a **sandboxed, restricted expression language** (no arbitrary code-exec); whitelist functions, no `eval`.
- **Data binding abstraction** — a **DataSource port** decouples content from where data comes from (Builder.io DataSource plugin, Cube.dev `load()`, Form.io data, GraphQL). Headless / **API-first**: authoring decoupled from delivery.
- **Schema versioning & migration** — config schema evolves via **expand-contract / parallel-change**; old configs keep rendering (backward-compatible) or are migrated by a versioned transform. Never silently break stored configs.
- **Model-Driven Engineering / DSL design** — treat the config as a small domain-specific language: define its grammar, keep it minimal and orthogonal, generate from it. "A grammar of <domain>."

---

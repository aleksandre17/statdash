# ADR-038 — The Bounded Element Law (the platform's governing compositional principle)

**Status:** ACCEPTED (owner-originated principle, 2026-07-11; the lead formalized it to standard). **Scope:** every renderable/authorable element in the platform (node · panel · chrome · control · item) and every mechanism that composes, renders, or authors them.

## Principle (owner, articulated; example: the KPI card)
> "A KPI card is like a ROOT: it has ONLY its own functionality, its own parameters, only what canonically belongs to it. What comes INSIDE it is not its business — except what it has DECLARED, i.e. what it ACCEPTS. It receives something ABSTRACTLY; after that, the rest is not its business except the canonical right we give it. Everything should be on this logic."

**The law (formal):** every element is a **bounded, self-owning unit** that (1) owns only its own concern, (2) hides its internals, (3) **declares a contract** of what it accepts — abstractly, and (4) is composed with others ONLY through that declared contract. A composer / renderer / authoring surface knows only the ABSTRACT contract and **recurses generically over each element's own declaration — it NEVER special-cases a concrete type externally.**

## The canon it names (standards this is)
- **SRP** (Single Responsibility) — one concern per element.
- **Encapsulation / Information Hiding** (Parnas 1972) — internals opaque.
- **Dependency Inversion + Interface Segregation** — an element depends on / accepts an abstraction *it declares*, never a concretion.
- **Open/Closed** — extend via the contract, closed to external knowledge of internals.
- **Law of Demeter** — never reach into another element's internals.
- **Composite pattern** — composition is a tree of uniform declared contracts.
- **Ports & Adapters / Hexagonal** (Cockburn) · **Bounded Context** (DDD) — a bounded core with declared ports.
- Aligns with CLAUDE.md **Law 1** (no privileged types/dims — generic), **Law 2** (declarative contracts, Constructor-ready), **Law 8/OCP** (a new element = a new declaration, mechanism unchanged).

## Why (what it fixes — one root for many symptoms)
1. **Deep authorability ("goes all the way in").** Because every element DECLARES what it accepts (its schema/slots), the Constructor drills into ANY element by **generic recursion over its own declaration** — "nothing un-buildable" FALLS OUT of universal declaration + generic recursion. A place authoring "can't reach into" = an element not fully declaring its contract, OR a composer special-casing instead of recursing.
2. **No external special-casing.** The anti-pattern to kill: hand-wiring a concrete type's composition from outside (e.g. `registerNodeProjector('kpi-strip', { toNode: kpiSpecToCardNode })` — external knowledge of kpi-strip's internals). The lawful form: kpi-strip DECLARES it accepts kpi-card items (in its META/itemSchema); a GENERIC projector reads that declaration for ALL promoted types — no per-type wire.
3. **One type system** (Fable, SPEC-rendering-core-object-model) and the **Summary-Card Inspector / sections derived from the schema** (SPEC-worldclass-authoring-ui) are instances of this same law.

## Decision
Adopt the Bounded Element Law as the platform's governing compositional standard. Every element declares its contract (what it accepts, its authorable schema/slots) in its registered META; every composer/renderer/authoring surface is a **generic mechanism over declarations** — no external per-type special-casing. Measured by fitness: `FF-NO-EXTERNAL-SPECIAL-CASE` (no composer hardcodes a concrete element type), `FF-ELEMENT-DECLARES-CONTRACT` (every renderable/authorable element's accept-contract is declared, not externally assumed), feeding the existing "nothing un-buildable" completeness gate.

## Consequences
- The object-model activation must be **generic-via-declared-contract**, not the hand-wired projector (revert the WIP hand-wire; derive projection from each promoted type's declared META). Strangler-Fig, forward-safe.
- Deep-authorability recurses over each element's declared schema (chrome, nav, filter-bar controls, nested items — all reachable by the same generic recursion).
- New elements cost one declaration; the composer/authoring machinery never changes (OCP).
- Migration is incremental (Law 7): where an element under-declares or a composer special-cases, fix the DECLARATION + generalize the mechanism — never add another special-case.

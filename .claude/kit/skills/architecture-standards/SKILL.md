---
name: architecture-standards
description: Comprehensive software-architecture reference — architecture styles (layered/hexagonal/clean/microservices/event-driven), design principles (SOLID, GRASP, OCP), design patterns (GoF, enterprise, distributed, resilience, concurrency) and anti-patterns to refuse, ISO 25010 quality attributes, DDD, C4 and ADR documentation, API/data/testing/security/delivery standards, and the RAG/AI-system layer. Use when making any architecture or design decision, auditing structure, choosing a pattern, designing an API or schema, or planning a refactor.
---

# Architecture & Engineering Standards — Reference Catalog

> The senior architect's knowledge spectrum: styles, principles, patterns, quality attributes, standards.
> **Generic + domain-free** — load on demand (not in every prompt). The architect *selects what fits this project's stack*; it does not apply everything. For every significant choice, **name the trade-off** and prefer encoding the resulting rule as a fitness function (`08`/`09`).
> Consulted by `architect` · `debugger` · `migration` agents and by `/architecture`, `/audit`, `/refactor`, `/roadmap`.

---

## Catalog — load the chapter your task touches (never all)
> Chapters live in `references/` and are read ON DEMAND. This index is all that preloads.

- **§1. Architecture styles (orthogonal axes — real systems combine several)** → `references/01-architecture-styles-orthogonal-axes-real.md` — **Deployment topology** — Monolithic · **Modular monolith** (pragmatic default) · Layered (N-tier) ·
- **§2. Design principles (named laws engineers cite by name)** → `references/02-design-principles-named-laws-engineers-c.md` — - **SOLID** — Single-responsibility · **Open/Closed** (open to extension, closed to modification — a
- **§3. Design patterns** → `references/03-design-patterns.md` — - **GoF** — *creational:* Factory, Abstract Factory, Builder, Prototype, Singleton · *structural:* A
- **§4. Quality attributes — ISO/IEC 25010 (architecture trades these; name the trade-off)** → `references/04-quality-attributes-iso-iec-25010-archite.md` — Functional suitability · Performance efficiency · Compatibility · Usability · **Reliability** (matur
- **§5. Documentation & modeling** → `references/05-documentation-modeling.md` — **C4** (Context → Containers → Components → Code) · 4+1 View Model · arc42 (12-section template) · *
- **§6. Formal standards & methods** → `references/06-formal-standards-methods.md` — ISO/IEC/IEEE **42010** (architecture descriptions) · ISO/IEC **25010** (quality) · TOGAF (ADM) · **D
- **§7. API · data · testing · security · delivery** → `references/07-api-data-testing-security-delivery.md` — - **API** — REST (Richardson maturity 0–3) · GraphQL · gRPC (contract-first/Protobuf) · OpenAPI/Asyn
- **§8. RAG / AI-system layer (for retrieval-augmented & agentic systems)** → `references/08-rag-ai-system-layer-for-retrieval-augmen.md` — - **Ingestion pipeline = Pipe-and-Filter** — crawl → parse → clean → chunk → embed → index, each sta
- **§9. Security standards (secure by design)** → `references/09-security-standards-secure-by-design.md` — OWASP Top 10 + **ASVS** (leveled verification requirements) · threat modeling — **STRIDE** (spoofing
- **§10. Operations & reliability standards** → `references/10-operations-reliability-standards.md` — **Observability — three pillars**: logs · metrics · traces (structured, high-cardinality where it ai
- **§11. Craftsmanship & refactoring (code-level senior judgment)** → `references/11-craftsmanship-refactoring-code-level-sen.md` — - **Code smells (detect → name → refactor):** long method · large class · long parameter list · prim
- **§12. Declarative / config-driven / visual-builder platforms (Builder.io / Form.io class)** → `references/12-declarative-config-driven-visual-builder.md` — For systems where a **JSON/config tree is authored (visually or by hand) and a generic renderer inte

## How to use this

1. **Select, don't apply-all.** Pick the few styles/patterns that fit the project's stack and stage; the rest is vocabulary, not a checklist.
2. **Name the trade-off** for every significant decision (ISO 25010 attribute gained vs lost) → record as an **ADR** (`paths.decisions_file`).
3. **Harden the choice** — turn the resulting invariant into a fitness function (`law_patterns` hook / ArchUnit), not a comment (`09`).
4. **Refuse the anti-patterns** (§3) — that is the no-degradation law in concrete form (`09` §B).

> Quick default for a multi-module monorepo: **Modular monolith / service-based + internally Hexagonal/Clean + Pipe-and-Filter ingestion + EDA/CQRS where read/write loads diverge + polyglot persistence + BFF at the edge.**

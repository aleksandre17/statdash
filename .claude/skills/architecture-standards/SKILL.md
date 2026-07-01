---
name: architecture-standards
description: Comprehensive software-architecture reference — architecture styles (layered/hexagonal/clean/microservices/event-driven), design principles (SOLID, GRASP, OCP), design patterns (GoF, enterprise, distributed, resilience, concurrency) and anti-patterns to refuse, ISO 25010 quality attributes, DDD, C4 and ADR documentation, API/data/testing/security/delivery standards, and the RAG/AI-system layer. Use when making any architecture or design decision, auditing structure, choosing a pattern, designing an API or schema, or planning a refactor.
---

# Architecture & Engineering Standards — Reference Catalog

> The senior architect's knowledge spectrum: styles, principles, patterns, quality attributes, standards.
> **Generic + domain-free** — load on demand (not in every prompt). The architect *selects what fits this project's stack*; it does not apply everything. For every significant choice, **name the trade-off** and prefer encoding the resulting rule as a fitness function (`08`/`09`).
> Consulted by `architect` · `debugger` · `migration` agents and by `/architecture`, `/audit`, `/refactor`, `/roadmap`.

---

## 1. Architecture styles (orthogonal axes — real systems combine several)

**Deployment topology** — Monolithic · **Modular monolith** (pragmatic default) · Layered (N-tier) · Microkernel/Plugin · Service-based · SOA · Microservices · Event-Driven · Space-based · Cell-based · Micro-frontends.
**Internal structure** — Layered · **Hexagonal (Ports & Adapters)** · Onion · **Clean** · Vertical slice · Component-based.
**Communication** — sync: Client-Server, RPC, REST/GraphQL/gRPC · async: Pub/Sub, EDA (broker/mediator), Event Sourcing, CQRS, Streaming, Saga (orchestration/choreography) · shared: Data-centric, Blackboard.
**Data architecture** — Lambda · Kappa · Medallion (bronze/silver/gold) · Data Mesh · Polyglot persistence (store per workload).
**Integration** — API Gateway · **Backend-for-Frontend (BFF)** · Service Mesh · ESB · **Pipe-and-Filter** · Blackboard.
**UI** — MVC · MVP · MVVM · Flux/Redux · Server-Driven UI (SDUI) · Micro-frontends.
**Hosting** — On-prem · Cloud-native (containers + orchestration) · Serverless/FaaS · 12-factor/PaaS.

---

## 2. Design principles (named laws engineers cite by name)

- **SOLID** — Single-responsibility · **Open/Closed** (open to extension, closed to modification — add behaviour with new code, don't widen existing) · Liskov substitution · Interface segregation · Dependency inversion.
- **GRASP** — controller, information expert, low coupling, high cohesion, **Protected Variations** (find where it may change, put a stable interface/seam there).
- **DRY · KISS · YAGNI** · Composition over inheritance · Law of Demeter · Principle of least astonishment.
- **Fail fast** · **Make illegal states unrepresentable** (encode invariants in the type system) · **Dependency Injection / IoC** · Convention over configuration · Conway's Law (structure mirrors org).

---

- **Named laws every engineer should wield:** **Single Source of Truth (SSOT)** — every datum has one authoritative home, all else derives · **Postel's Law / robustness** — be conservative in what you send, liberal in what you accept · **Law of Demeter** — talk only to immediate collaborators · **Principle of Least Astonishment** — behavior matches expectation · **Conway's Law** — architecture mirrors team communication · **Fail-fast** — surface errors at the boundary, never swallow · **5 Whys / root-cause** — fix the cause, not the symptom · **Occam's Razor** — simplest explanation first · **One-way vs two-way doors** — irreversible decisions get more scrutiny · **Expand-contract (parallel change)** — evolve contracts/schemas without breaking consumers · **Boy-Scout Rule** — leave it cleaner, bounded by scope · **KISS** · **Chesterton's Fence** — don't remove what you don't understand · **Pareto / vital-few** — the 20% that carries 80% · **Lehman's laws** — software must evolve or rot.

## 3. Design patterns

- **GoF** — *creational:* Factory, Abstract Factory, Builder, Prototype, Singleton · *structural:* Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy · *behavioral:* Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, **Strategy**, Template Method, Visitor.
- **Enterprise (PoEAA)** — Repository, Unit of Work, Data Mapper, Service Layer, Domain Model, DTO, Identity Map, Lazy Load, Optimistic/Pessimistic Locking, Null Object.
- **Integration (EIP)** — Message Channel/Router/Translator, Content-Based Router, Aggregator, Splitter, Dead Letter Channel, **Idempotent Receiver**.
- **Distributed / cloud** — **Outbox/Inbox**, **Saga**, **CQRS**, Event Sourcing, API Composition, Database-per-Service, Sidecar, Ambassador, **Anti-Corruption Layer**, **Strangler Fig** (incremental replacement — the safe refactor path), Cache-Aside, Materialized View, Sharding, Competing Consumers, Claim-Check, Throttling.
- **Resilience** — Retry (exp backoff + jitter), **Circuit Breaker**, Bulkhead, **Timeout**, Rate Limiting, Backpressure, **Fallback / Graceful Degradation**, Health Check, Load Shedding, Idempotency keys.
- **Concurrency** — Producer-Consumer, Thread Pool, Future/Promise, Actor, Read-Write Lock, Immutable Object, Reactor.
- **Anti-patterns to REFUSE** — God Object · Anemic Domain Model · Big Ball of Mud · Spaghetti · Golden Hammer · Lava Flow · **Magic Numbers/Strings** · Premature Optimization · **Distributed Monolith** · **Shotgun Surgery** · default Vendor Lock-in.

---

## 4. Quality attributes — ISO/IEC 25010 (architecture trades these; name the trade-off)

Functional suitability · Performance efficiency · Compatibility · Usability · **Reliability** (maturity, availability, fault tolerance, recoverability) · Security (CIA + non-repudiation, authenticity) · **Maintainability** (modularity, reusability, analysability, modifiability, testability) · Portability. Plus: scalability · observability · evolvability · auditability · deployability · cost-efficiency · resilience.

---

## 5. Documentation & modeling

**C4** (Context → Containers → Components → Code) · 4+1 View Model · arc42 (12-section template) · **ADR** (context · decision · consequences · ≥2 rejected alternatives; versioned with code) · UML (selective) · **Fitness functions** (automated tests asserting architectural characteristics — Evolutionary Architecture) · RFC / design-doc process.

- **Architecture leads, code follows** — the target architecture is the standard; when legacy code conflicts, the code is migrated to the pattern (Strangler-Fig), never the architecture bent to accommodate violations. New decisions are judged against the target, not the current state.

- **Benchmark sources (where "best" is defined — consult/research these):** AWS & Google Cloud **Well-Architected** frameworks · **Google SRE** book · **Netflix** resilience (Hystrix/chaos) · **Stripe** API design · **Martin Fowler** / refactoring.com catalog · **ThoughtWorks Tech Radar** · **12-Factor** · the **canonical reference implementation** for the domain. Don't reinvent — adopt the proven best case, adapted.

## 6. Formal standards & methods

ISO/IEC/IEEE **42010** (architecture descriptions) · ISO/IEC **25010** (quality) · TOGAF (ADM) · **Domain-Driven Design** (strategic: bounded contexts, context mapping, ubiquitous language; tactical: aggregates, entities, value objects, repositories, domain events) · 12-Factor App · Reactive Manifesto · Well-Architected (operational excellence, security, reliability, performance, cost, sustainability).

## 7. API · data · testing · security · delivery

- **API** — REST (Richardson maturity 0–3) · GraphQL · gRPC (contract-first/Protobuf) · OpenAPI/AsyncAPI contracts · versioning (additive/backward-compatible; SemVer) · error contracts (**RFC 9457** Problem Details) · idempotency keys · correct status-code semantics (don't tunnel through 200).
- **Data** — modeling (3NF vs deliberate denormalization, indexing, integrity) · **ACID vs BASE** · isolation levels (read-committed → repeatable-read → serializable; know the anomaly each prevents) · **CAP** (under partition: consistency or availability) + **PACELC** (else: latency vs consistency) · consistency models (strong · eventual · causal · read-your-writes) · migrations versioned + reversible, never edit an applied one · idempotency.
- **Testing** — test pyramid (unit > integration > e2e; avoid the ice-cream cone) · TDD/BDD · types: unit·integration·contract·e2e·smoke·regression·perf·chaos·security·mutation · test doubles (dummy·stub·spy·mock·fake — don't over-mock) · **consumer-driven contracts** (Pact) at service boundaries · property-based for edge cases · untested critical path = defect.
- **Security** — secure by design · least privilege · validate inputs / encode outputs · proper auth/authz · no hardcoded secrets · threat-model sensitive flows · OWASP.
- **Delivery** — Conventional Commits · SemVer · CI fitness-function gates · deployment strategies (blue/green · canary · rolling · feature-flag) · DORA (deploy freq · lead time · change-failure rate · restore time).

---

- **Accessibility:** **WCAG 2.1 AA** + **WAI-ARIA** as the baseline for any UI (semantic HTML, keyboard nav, contrast, no color-only signal) · **Atomic Design** (atoms→molecules→organisms→templates→pages) · **mobile-first / responsive** · **Core Web Vitals** as a performance budget (LCP/INP/CLS).

## 8. RAG / AI-system layer (for retrieval-augmented & agentic systems)

- **Ingestion pipeline = Pipe-and-Filter** — crawl → parse → clean → chunk → embed → index, each stage a replaceable filter with an explicit contract. Idempotent stages + upsert, not check/delete/insert.
- **Chunking** — semantic vs fixed-window + overlap; chunk size tuned to the embedding model; preserve source metadata for citation.
- **Embedding & vector store** — named vectors per field (body/title/summary); store-per-workload (vector store + relational + cache = polyglot persistence); identity over text.
- **Retrieval** — dense + sparse **hybrid**; fusion (**RRF**); diversification (**MMR**); optional rerank; **grounding/citations** back to source; confidence/availability signals (don't silently return empty on a backend failure).
- **Generation** — provider behind a **port** (never import the LLM SDK into the application layer); prompt templates **versioned**; structured output where possible.
- **Eval & safety** — retrieval quality metrics (recall/precision/coverage), answer faithfulness/grounding eval, regression set; treat the corpus as the foundation (a weak corpus caps everything downstream).
- **Agentic** — orchestrator/sub-agent decomposition, tool allowlists, bounded autonomy, human-in-the-loop on irreversible steps (mirrors this kit's own `01`/`09`).

## 9. Security standards (secure by design)

OWASP Top 10 + **ASVS** (leveled verification requirements) · threat modeling — **STRIDE** (spoofing, tampering, repudiation, info disclosure, DoS, elevation) · **OAuth 2.0/OIDC** + RBAC/ABAC · **Zero Trust** (never trust, always verify; least privilege; assume breach) · defense in depth · secrets in vaults — never in source or logs, rotated · data: TLS in transit + encryption at rest, minimize PII · **supply chain**: dependency scanning, SBOM, pinned versions · validate input / encode output / parameterize queries.

## 10. Operations & reliability standards

**Observability — three pillars**: logs · metrics · traces (structured, high-cardinality where it aids debugging) · **SLI/SLO + error budgets** — define and govern reliability targets, don't guess · scalability: stateless services, **AKF Scale Cube** (X clone · Y split by function · Z split by data) · caching: cache-aside / write-through / write-behind — with an explicit invalidation strategy and TTLs · capacity: load-test, headroom, measure before optimizing · delivery: **trunk-based development** (short branches, feature flags), **IaC** (declarative, versioned), **GitOps** (Git as deploy truth) · tests **FIRST** (fast, isolated, repeatable, self-validating, timely); contract + property-based on critical paths; coverage is a signal, not a goal · **standards as code** — encode conventions in linters/templates/generators so they hold by default · flow & planning: **Little's Law** (WIP ↔ throughput), **Theory of Constraints** (optimize the bottleneck), **MoSCoW** prioritization · resilience under load: **backpressure** + **graceful degradation** · **Evolutionary Architecture** — guided change behind fitness functions · **Polyglot Persistence** — the right store per job.

## 11. Craftsmanship & refactoring (code-level senior judgment)

- **Code smells (detect → name → refactor):** long method · large class · long parameter list · primitive obsession · data clumps · feature envy · inappropriate intimacy · shotgun surgery · divergent change · message chains · middle man · speculative generality · temporary field · refused bequest.
- **Refactoring catalog (Fowler — apply in small, tested steps):** extract/inline method · extract class · move method/field · rename · introduce parameter object · preserve whole object · replace temp with query · **replace conditional with polymorphism** · replace magic literal with constant · decompose conditional · introduce Null Object · separate query from modifier. Refactor on a green test bar; one behavior-preserving step per commit.
- **Standards of resolution (the bar for "done"):** "it works" is not the bar — **works + agnostic + interface-clean (ISP) + extensible + tested** is. Every fix is a **root-cause fix, not a symptom fix**: state it as *root cause → standard it should meet → proposed fix*; a symptom patch is rejected even when it makes the error disappear.
- **Platform-level thinking:** when a problem recurs or a capability is missing, prefer the solution that **adds reusable power** (promote to a shared library / framework seam) over a one-off local patch — solve it once, for every future caller. After the minimal fix ask: *what can it do now that it couldn't? is it open for extension (a new case = a new capability, interface unchanged)?* Balance against YAGNI: build the seam when the second caller is real, not speculatively.
- **Clean code:** intention-revealing names · small functions, one level of abstraction · explicit side effects · no silent failures, clear error boundaries · comments explain *why*, not *what*. Boy-scout rule: leave it cleaner than you found it (bounded by scope + the no-broken-windows law).
- **Debugging discipline:** **scientific method** (hypothesis → experiment) · **rubber-duck** · **delta debugging** (minimize the failing input) · **fault isolation / bisection** · correlation ≠ causation.

## 12. Declarative / config-driven / visual-builder platforms (Builder.io / Form.io class)

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

## How to use this

1. **Select, don't apply-all.** Pick the few styles/patterns that fit the project's stack and stage; the rest is vocabulary, not a checklist.
2. **Name the trade-off** for every significant decision (ISO 25010 attribute gained vs lost) → record as an **ADR** (`paths.decisions_file`).
3. **Harden the choice** — turn the resulting invariant into a fitness function (`law_patterns` hook / ArchUnit), not a comment (`09`).
4. **Refuse the anti-patterns** (§3) — that is the no-degradation law in concrete form (`09` §B).

> Quick default for a multi-module monorepo: **Modular monolith / service-based + internally Hexagonal/Clean + Pipe-and-Filter ingestion + EDA/CQRS where read/write loads diverge + polyglot persistence + BFF at the edge.**

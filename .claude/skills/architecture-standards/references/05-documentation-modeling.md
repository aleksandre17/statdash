# 5. Documentation & modeling
**C4** (Context → Containers → Components → Code) · 4+1 View Model · arc42 (12-section template) · **ADR** (context · decision · consequences · ≥2 rejected alternatives; versioned with code) · UML (selective) · **Fitness functions** (automated tests asserting architectural characteristics — Evolutionary Architecture) · RFC / design-doc process.

- **Architecture leads, code follows** — the target architecture is the standard; when legacy code conflicts, the code is migrated to the pattern (Strangler-Fig), never the architecture bent to accommodate violations. New decisions are judged against the target, not the current state.

- **Benchmark sources (where "best" is defined — consult/research these):** AWS & Google Cloud **Well-Architected** frameworks · **Google SRE** book · **Netflix** resilience (Hystrix/chaos) · **Stripe** API design · **Martin Fowler** / refactoring.com catalog · **ThoughtWorks Tech Radar** · **12-Factor** · the **canonical reference implementation** for the domain. Don't reinvent — adopt the proven best case, adapted.

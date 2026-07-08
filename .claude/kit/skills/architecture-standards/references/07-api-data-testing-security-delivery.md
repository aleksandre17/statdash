# 7. API · data · testing · security · delivery
- **API** — REST (Richardson maturity 0–3) · GraphQL · gRPC (contract-first/Protobuf) · OpenAPI/AsyncAPI contracts · versioning (additive/backward-compatible; SemVer) · error contracts (**RFC 9457** Problem Details) · idempotency keys · correct status-code semantics (don't tunnel through 200).
- **Data** — modeling (3NF vs deliberate denormalization, indexing, integrity) · **ACID vs BASE** · isolation levels (read-committed → repeatable-read → serializable; know the anomaly each prevents) · **CAP** (under partition: consistency or availability) + **PACELC** (else: latency vs consistency) · consistency models (strong · eventual · causal · read-your-writes) · migrations versioned + reversible, never edit an applied one · idempotency.
- **Testing** — test pyramid (unit > integration > e2e; avoid the ice-cream cone) · TDD/BDD · types: unit·integration·contract·e2e·smoke·regression·perf·chaos·security·mutation · test doubles (dummy·stub·spy·mock·fake — don't over-mock) · **consumer-driven contracts** (Pact) at service boundaries · property-based for edge cases · untested critical path = defect.
- **Security** — secure by design · least privilege · validate inputs / encode outputs · proper auth/authz · no hardcoded secrets · threat-model sensitive flows · OWASP.
- **Delivery** — Conventional Commits · SemVer · CI fitness-function gates · deployment strategies (blue/green · canary · rolling · feature-flag) · DORA (deploy freq · lead time · change-failure rate · restore time).

---

- **Accessibility:** **WCAG 2.1 AA** + **WAI-ARIA** as the baseline for any UI (semantic HTML, keyboard nav, contrast, no color-only signal) · **Atomic Design** (atoms→molecules→organisms→templates→pages) · **mobile-first / responsive** · **Core Web Vitals** as a performance budget (LCP/INP/CLS).

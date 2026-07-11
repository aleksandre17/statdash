# ADR-040 — The Agnostic Ingestion Port + self-declaring adapters (raw-data upload to the front)

**Status:** PROPOSED (owner-originated 2026-07-12; grounds AR-51). **Governed by:** ADR-038 (Bounded Element Law), Law 5 (`fromSDMX` is the only adapter boundary — here GENERALIZED), Law 1 (no privileged dims), Law 2 (declarative).

## Context
Raw data enters today ONLY through a backend, xlsx-shaped path (`apps/api/src/ingest/canonical/` + the `canonical` upload route). The self-describing CORE already exists and is excellent — `CanonicalDsd` is a self-describing SDMX-lite DSD (dimensions-as-SSOT, agnostic parser, declare-OR-reference), and `source-descriptor.ts` is an OCP wire-type→kind table. What is missing is (a) a **front-plane** upload experience and (b) **format-agnosticism** (the pipeline still assumes the workbook shape). The owner's principle: *"it knows THAT it receives + its own characteristics, not WHAT it receives — the object is agnostic."*

## Decision
Model ingestion as a **Ports & Adapters (Hexagonal) port**: ONE agnostic `IngestionPort` the pipeline depends on, and a REGISTRY of **self-declaring adapters** (one per format: xlsx / CSV / SDMX-JSON / …). Each adapter is a **bounded element** that (1) declares its identity + what it accepts, and (2) emits the SAME self-describing contract — a `CanonicalDsd` + rows. The core NEVER branches on format; a new format = a new registered adapter (OCP), selectable/authorable for free. Bring this to the **front plane**: a panel "Onboard data" surface — **upload → adapter parses → the source SELF-DECLARES its DSD → human REVIEWS/CONFIRMS the declaration → COMMIT** through the existing canonical FSM (stage → publish → obs).

## Reference grounding (seek → canonical pattern → surpass — not blind)
- **Ports & Adapters / Hexagonal (Cockburn)** — the agnostic port + swappable adapters; DIP + ISP (the pipeline depends on the abstraction it declares).
- **The "data-onboarding" pattern — Flatfile · Power Query · Tableau Prep · Airtable import**: upload → INFER/parse structure → **human review + confirm** → commit (never trust a blind parse). We adopt the review-confirm step verbatim.
- **Self-declaring sources — dbt `sources` · Observable data loaders · Malloy sources**: the source declares its own shape as config, not code.
- **SDMX SDMX-CSV/JSON + DSD**: the data carries its own structure — statistics-grade self-description; `CanonicalDsd` already is this.
- **SURPASS:** the CSV-import class infers a FLAT, ungoverned schema; we emit a **self-describing SDMX-grade DSD** (dimensions/codelists/measure/SIMS, declare-OR-reference) flowing the SAME governed, agnostic pipeline — *statistics-grade AND non-programmer-uploadable*, a hybrid no single reference platform ships.

## Rejected alternatives
1. **Per-format hardcoded import UI** (a separate xlsx-importer, csv-importer…) — violates OCP + the agnostic port; a new format = new UI. Rejected.
2. **Infer-only flat schema (the CSV-tool default)** — loses the SDMX DSD governance (codelists, dims-SSOT, provenance) the platform is built on. Rejected; keep the self-describing DSD as the contract every adapter emits.
3. **Leave ingestion backend/CLI-only (status quo)** — the raw-data front-door stays expert-only; contradicts the owner's "upload to the front". Rejected.

## Fitness functions
- **FF-INGEST-PORT-AGNOSTIC** — no generic ingestion/pipeline layer branches on a concrete format literal; format handling lives ONLY in a registered adapter (mirrors FF-NO-EXTERNAL-SPECIAL-CASE for the data port).
- **FF-ADAPTER-EMITS-DSD** — every registered adapter emits a valid self-describing `CanonicalDsd` + rows (the ONE contract), round-trip JSON-lossless (Law 2).

## Consequences
Front-plane raw-data upload becomes a first-class, non-programmer capability without weakening governance. `fromSDMX`/`CanonicalDsd` become ONE adapter among several behind the port (Law 5 generalized, not violated). First slice (AR-51): the panel upload surface over the existing `canonical` route + the adapter registry (start: xlsx adapter = today's parser wrapped; then CSV). Unifies with the object model — a data source is a self-declaring node, exactly like a UI element (ADR-038 / ADR-039).

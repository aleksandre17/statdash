# 8. RAG / AI-system layer (for retrieval-augmented & agentic systems)
- **Ingestion pipeline = Pipe-and-Filter** — crawl → parse → clean → chunk → embed → index, each stage a replaceable filter with an explicit contract. Idempotent stages + upsert, not check/delete/insert.
- **Chunking** — semantic vs fixed-window + overlap; chunk size tuned to the embedding model; preserve source metadata for citation.
- **Embedding & vector store** — named vectors per field (body/title/summary); store-per-workload (vector store + relational + cache = polyglot persistence); identity over text.
- **Retrieval** — dense + sparse **hybrid**; fusion (**RRF**); diversification (**MMR**); optional rerank; **grounding/citations** back to source; confidence/availability signals (don't silently return empty on a backend failure).
- **Generation** — provider behind a **port** (never import the LLM SDK into the application layer); prompt templates **versioned**; structured output where possible.
- **Eval & safety** — retrieval quality metrics (recall/precision/coverage), answer faithfulness/grounding eval, regression set; treat the corpus as the foundation (a weak corpus caps everything downstream).
- **Agentic** — orchestrator/sub-agent decomposition, tool allowlists, bounded autonomy, human-in-the-loop on irreversible steps (mirrors this kit's own `01`/`09`).

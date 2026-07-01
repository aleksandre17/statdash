// ── Reserved cube keys — the SSOT for the platform's reserved dimension codes ─
//
// A tiny neutral home for the RESERVED cube tokens that would otherwise be a magic
// string scattered across subsystems (the canonical parser, the DQAF rule registry,
// the cube-profile route). Placed in `lib/` — the shared, dependency-free layer — so
// no consumer owns the constant and no delivery route has to reach into an ingest
// internal to name it (SSOT + low coupling; DRY over a magic string, skill §3).

/**
 * The reserved MEASURE dimension code. `stats.dimension` rows are DATA (Law 1) — but
 * the measure axis is the ONE reserved structural dimension (measures are flat; the
 * approach is a metadata attribute). This single token names it everywhere it appears
 * as structure: the cube-profile measure join (`c.dim_code = 'measure'`), the signed
 * accounting-identity RuleSpec (`dim: 'measure'`), and the canonical DSD-input header
 * key that declares the measure concept. One name, one home — never a bare literal.
 */
export const KEY_MEASURE = 'measure'

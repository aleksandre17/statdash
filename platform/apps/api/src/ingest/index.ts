// ── Ingest — Staged Submission Pipeline public surface ────────────────────────
//
// Bronze (raw) → parse → conform → validate → Silver (staged) → PUBLISH → Gold.
// The boot wiring (after runProvisioning) calls runIngestionWorker; the approval
// route calls publishSubmission. The filters are exported for unit tests.

export * from './types.js'
export { conformObsRows } from './conform.js'
export { validateObs, validateClassifiers, validateDisplays, fetchActiveLocales } from './validate.js'
export { runFactRules, checkContractCompat, precheckContractCompat } from './validate-integrity.js'
export { recognizeReferenceMetadata } from './reference-metadata-map.js'
export type { RecognizedReferenceMetadata } from './reference-metadata-map.js'
export type { RuleSpec, RuleKind } from './rules/registry.js'
export { resolveRules, ruleSpecRejection, DEFAULT_EPSILON } from './rules/registry.js'
export { runRules } from './rules/evaluator.js'
export type { RuleContext } from './rules/evaluator.js'
export {
  classifyContractChange, COMPAT_POLICY,
} from './canonical/compat.js'
export type {
  ContractChange, ContractChangeKind, DsdSnapshot, CompatMode, CodelistDelta,
} from './canonical/compat.js'
export { publishSubmission } from './publish.js'
export type { PublishOpts } from './publish.js'
export { publishBundle } from './publish-bundle.js'
export type { PublishBundleResult } from './publish-bundle.js'
export { runIngestionWorker } from './worker.js'
export { createSubmission, contentHash, AlreadyPublishedError } from './submit.js'
export type { CreateSubmissionArgs, SubmissionProvenance } from './submit.js'
export {
  upsertClassifier, upsertDisplay, upsertObservation, bumpDatasetVersion,
} from './upsert.js'
export {
  isValidTimePeriod, normalizeObsStatus, normalizeDimKey, SDMX_TIME_PERIOD_RE,
} from './util.js'

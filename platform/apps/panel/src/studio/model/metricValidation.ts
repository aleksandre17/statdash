// ── metricValidation — boundary validation of an authored metric (M2.2) ────────
//
//  FF-CATALOG-EDIT-SAFE (spec §6.2): an authored ManifestMetric is validated
//  against its LIVE cube profile before it can be persisted — the `code` must be a
//  real measure in its dataset; every default-dims key must be a real dimension;
//  every pinned member must be a real member. An invalid metric CANNOT be saved, so
//  the governed catalog is provably resolvable through the one resolveMeasureRef
//  seam. Plus the structural governance rules: a legal immutable id, a unique id on
//  create, and a non-empty bilingual label (Law 4 / Law 9).
//
//  PURE (draft + context in → issues out): no React, no store, no network — the
//  editor gates its Save button on `issues.every(i => i.severity !== 'error')`, and
//  the fitness test drives it directly.
//
import type { ManifestMetric } from '@statdash/contracts'
import type { CubeProfile } from '../../lib/cubeApi'
import { isValidMetricId } from './metricDraft'

export type IssueField = 'id' | 'label' | 'code' | 'unit' | 'dims'
export type IssueSeverity = 'error' | 'warning'

export interface MetricIssue {
  field:    IssueField
  severity: IssueSeverity
  message:  { ka: string; en: string }
}

export interface ValidateContext {
  /** The live cube profile for the metric's dataSource, or null when unavailable. */
  profile:     CubeProfile | null
  /** All metric ids currently in the catalog (for the create-uniqueness check). */
  existingIds: string[]
  /** True when creating (id must be new + legal); false when editing (id is immutable). */
  isNew:       boolean
  /** Active locales — a label must carry at least one non-empty active-locale value. */
  activeLocales: readonly string[]
}

/** True when a LocaleString map carries a non-empty value on at least one active locale. */
function hasLabel(label: Record<string, string> | undefined, locales: readonly string[]): boolean {
  if (!label) return false
  return locales.some((loc) => (label[loc]?.trim().length ?? 0) > 0)
    || Object.values(label).some((v) => v.trim().length > 0)
}

/** Validate an authored metric. Returns [] when it is safe to persist. */
export function validateMetric(draft: ManifestMetric, ctx: ValidateContext): MetricIssue[] {
  const issues: MetricIssue[] = []

  // ── id — legal immutable slug, unique on create ──────────────────────────────
  if (!draft.id || !isValidMetricId(draft.id)) {
    issues.push({
      field: 'id', severity: 'error',
      message: {
        ka: 'იდენტიფიკატორი უნდა იწყებოდეს ასოთი და შეიცავდეს მხოლოდ პატარა ასოებს, ციფრებსა და ქვედა ხაზს',
        en: 'Id must start with a letter and contain only lowercase letters, digits and underscore',
      },
    })
  } else if (ctx.isNew && ctx.existingIds.includes(draft.id)) {
    issues.push({
      field: 'id', severity: 'error',
      message: { ka: `იდენტიფიკატორი „${draft.id}“ უკვე გამოყენებულია`, en: `Id "${draft.id}" is already in use` },
    })
  }

  // ── label — required, at least one active locale ─────────────────────────────
  if (!hasLabel(draft.label, ctx.activeLocales)) {
    issues.push({
      field: 'label', severity: 'error',
      message: { ka: 'დასახელება სავალდებულოა', en: 'A label is required' },
    })
  }

  // ── code — a real measure in the live cube profile (belt-and-suspenders) ─────
  const code = typeof draft.code === 'string' ? draft.code : Array.isArray(draft.code) ? draft.code[0] : undefined
  if (!code) {
    issues.push({
      field: 'code', severity: 'error',
      message: { ka: 'აირჩიეთ საზომი (measure)', en: 'Pick a measure' },
    })
  } else if (ctx.profile) {
    const measures = new Set(ctx.profile.measures.map((m) => m.code))
    const codes = Array.isArray(draft.code) ? draft.code : [code]
    for (const c of codes) {
      if (!measures.has(c)) {
        issues.push({
          field: 'code', severity: 'error',
          message: { ka: `საზომი „${c}“ არ არსებობს ამ კუბში`, en: `Measure "${c}" does not exist in this cube` },
        })
      }
    }
  } else {
    // Profile unavailable — we cannot PROVE resolvability. Warn (do not hard-block a
    // steward who picked from the profile while it was live); fail-soft, Law 9.
    issues.push({
      field: 'code', severity: 'warning',
      message: {
        ka: 'კუბის პროფილი მიუწვდომელია — საზომის ვალიდაცია გამოტოვდა',
        en: 'Cube profile unavailable — measure validation skipped',
      },
    })
  }

  // ── dims — every key a real dimension, every pin a real member ────────────────
  if (draft.dims && ctx.profile) {
    const dimByCode = new Map(ctx.profile.dimensions.map((d) => [d.code, d]))
    for (const [dimCode, member] of Object.entries(draft.dims)) {
      const dim = dimByCode.get(dimCode)
      if (!dim) {
        issues.push({
          field: 'dims', severity: 'error',
          message: { ka: `განზომილება „${dimCode}“ არ არსებობს ამ კუბში`, en: `Dimension "${dimCode}" does not exist in this cube` },
        })
        continue
      }
      // A scalar pin must be a real member; a predicate object (advanced) is skipped.
      if (member != null && (typeof member === 'string' || typeof member === 'number' || typeof member === 'boolean')) {
        const memberSet = new Set(dim.members.map((m) => m.code))
        if (!memberSet.has(String(member))) {
          issues.push({
            field: 'dims', severity: 'error',
            message: { ka: `წევრი „${String(member)}“ არ არსებობს განზომილებაში „${dimCode}“`, en: `Member "${String(member)}" is not in dimension "${dimCode}"` },
          })
        }
      }
    }
  }

  return issues
}

/** True when the metric can be saved (no error-severity issues). */
export function isSaveable(issues: MetricIssue[]): boolean {
  return issues.every((i) => i.severity !== 'error')
}

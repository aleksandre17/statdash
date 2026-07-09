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
import { collectInputRefs, calcCreatesCycle } from './metricCalc'

export type IssueField = 'id' | 'label' | 'code' | 'unit' | 'dims' | 'calc'
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
  /**
   * The full governed-metric catalog — the operand universe for a CALCULATED metric
   * (FF-CALC-EDIT-SAFE): every input measure must resolve to a real governed metric,
   * and a cycle over this catalog is rejected. Absent ⇒ base-metric validation only
   * (the M2.2 path, byte-identical).
   */
  catalogMetrics?: readonly ManifestMetric[]
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

  // ── CALCULATED metric — validate the measure-algebra, skip the base code/dims path ─
  //  A calc metric carries `calc` INSTEAD of `code` (exactly one — mirrors MetricDef).
  //  FF-CALC-EDIT-SAFE: every input measure resolves to a real governed metric; the
  //  expr references only declared inputs; no self-reference / cycle.
  if (draft.calc) {
    validateCalc(draft, ctx, issues)
    return issues
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

/**
 * Validate a CALCULATED metric's measure-algebra (FF-CALC-EDIT-SAFE). Mutates
 * `issues`. Rules: exactly-one-of code/calc; ≥1 input; every input measure is a real
 * governed metric (never a dangling ref); the expr references ONLY declared inputs;
 * no self-reference / cycle over the catalog.
 */
function validateCalc(draft: ManifestMetric, ctx: ValidateContext, issues: MetricIssue[]): void {
  const calc = draft.calc!
  const catalog = ctx.catalogMetrics ?? []
  const catalogIds = new Set(catalog.map((m) => m.id))

  // A calc metric may NOT also carry a raw `code` (exactly one — Law 2 / MetricDef XOR).
  if (draft.code !== undefined) {
    issues.push({
      field: 'calc', severity: 'error',
      message: { ka: 'გამოთვლადი მეტრიკა ვერ ატარებს პირდაპირ საზომს (code)', en: 'A calculated metric cannot also carry a raw measure (code)' },
    })
  }

  const inputEntries = Object.entries(calc.inputs)
  if (inputEntries.length === 0) {
    issues.push({
      field: 'calc', severity: 'error',
      message: { ka: 'დაამატეთ მინიმუმ ერთი ოპერანდი (მეტრიკა)', en: 'Add at least one operand (metric)' },
    })
  }

  // Every input measure must resolve to a real GOVERNED metric (the operand universe).
  for (const [name, input] of inputEntries) {
    if (!input.measure) {
      issues.push({
        field: 'calc', severity: 'error',
        message: { ka: `ოპერანდ „${name}“-ს არ აქვს არჩეული მეტრიკა`, en: `Operand "${name}" has no metric selected` },
      })
      continue
    }
    // Self-reference is a special, clearer message than a generic cycle.
    if (input.measure === draft.id) {
      issues.push({
        field: 'calc', severity: 'error',
        message: { ka: 'მეტრიკა ვერ დაეყრდნობა თავის თავს', en: 'A metric cannot reference itself' },
      })
      continue
    }
    if (!catalogIds.has(input.measure)) {
      issues.push({
        field: 'calc', severity: 'error',
        message: { ka: `ოპერანდი „${input.measure}“ არ არის მართული მეტრიკა`, en: `Operand "${input.measure}" is not a governed metric` },
      })
    }
  }

  // The expr must reference only declared inputs (no dangling $derived).
  const declared = new Set(Object.keys(calc.inputs))
  const referenced = collectInputRefs(calc.expr)
  for (const ref of referenced) {
    if (!declared.has(ref)) {
      issues.push({
        field: 'calc', severity: 'error',
        message: { ka: `ფორმულა მიმართავს გამოუცხადებელ ოპერანდს „${ref}“`, en: `The formula references an undeclared operand "${ref}"` },
      })
    }
  }
  // An expr that references NO input is not yet a meaningful derivation — gate Save.
  if (inputEntries.length > 0 && referenced.length === 0) {
    issues.push({
      field: 'calc', severity: 'error',
      message: { ka: 'აირჩიეთ ალგებრის ფორმა ან ააგეთ ფორმულა', en: 'Choose an algebra shape or build a formula' },
    })
  }
  // A declared-but-unreferenced input is dead weight — warn (does not block Save).
  for (const name of declared) {
    if (!referenced.includes(name)) {
      issues.push({
        field: 'calc', severity: 'warning',
        message: { ka: `ოპერანდი „${name}“ არ გამოიყენება ფორმულაში`, en: `Operand "${name}" is not used in the formula` },
      })
    }
  }

  // Cycle / self-reference over the whole catalog (un-resolvable at runtime).
  const measures = inputEntries.map(([, i]) => i.measure).filter(Boolean)
  if (draft.id && isValidMetricId(draft.id) && calcCreatesCycle(draft.id, measures, catalog as ManifestMetric[])) {
    issues.push({
      field: 'calc', severity: 'error',
      message: { ka: 'ეს გამოთვლა ქმნის ციკლს (მეტრიკა დამოკიდებულია საკუთარ თავზე)', en: 'This calculation forms a cycle (the metric depends on itself)' },
    })
  }
}

/** True when the metric can be saved (no error-severity issues). */
export function isSaveable(issues: MetricIssue[]): boolean {
  return issues.every((i) => i.severity !== 'error')
}

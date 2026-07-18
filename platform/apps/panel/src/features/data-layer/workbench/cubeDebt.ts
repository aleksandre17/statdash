// ── cubeDebt — the governance-debt lens over a raw cube profile (0084 §3) ──────
//
//  ADR-046 · SPEC §2 (Floor 1 vocabulary) · the DQ spirit (Law 9). A raw cube's
//  dimension can offer RAW member codes (`R`/`U`) instead of governed member labels
//  when the cube profile carries no label for them — the ledgered R/U gap the P-OFFER
//  wave surfaced (a governance/provisioning debt, NOT a panel defect). This module makes
//  that debt VISIBLE to the person who can fix it (the steward): it does NOT invent labels
//  and does NOT touch provisioning data — visibility only.
//
//  Pure + framework-free (no React, no store, no network) — trivially testable. Operates
//  on the CubeProfile wire shape the discovery client already caches (cubeProfile.store).
//
import type { CubeProfile, CubeProfileDimension, CubeProfileMember } from '../../../lib/cubeApi'

/** The member-label debt of ONE dimension: how many members lack a governed label. */
export interface DimLabelDebt {
  /** The dimension's SDMX code (its raw axis id). */
  dimCode:  string
  /** Whether this is the time axis (time members are period codes, never label-bearing). */
  isTime:   boolean
  /** Total members in the dimension's live codelist. */
  total:    number
  /** Members with NO governed label in ANY locale (they fall back to the raw code). */
  missing:  number
}

/**
 * A member "lacks a governed label" when its `label` map carries no non-empty value in
 * any locale — the MemberPicker then honestly falls back to the raw code (the R/U gap).
 * A label whose only value equals the member's own code is ALSO treated as missing (a raw
 * code echoed as a label is not a governed label). Pure predicate.
 */
export function memberLacksLabel(member: CubeProfileMember): boolean {
  const values = Object.values(member.label ?? {}).map((v) => (v ?? '').trim()).filter(Boolean)
  if (values.length === 0) return true
  // Every present value is just the code echoed back → not a real governed label.
  return values.every((v) => v === member.code)
}

/** Count the label debt of one dimension (time axis is exempt — period codes aren't labels). */
export function dimLabelDebt(dim: CubeProfileDimension): DimLabelDebt {
  const missing = dim.isTime ? 0 : dim.members.filter(memberLacksLabel).length
  return { dimCode: dim.code, isTime: dim.isTime, total: dim.members.length, missing }
}

/** The label debt of every dimension in a cube profile, in the profile's own order. */
export function cubeLabelDebt(profile: CubeProfile): DimLabelDebt[] {
  return profile.dimensions.map(dimLabelDebt)
}

/** The dimensions that carry debt (≥1 member missing a label) — what the steward must fix. */
export function dimsWithDebt(profile: CubeProfile): DimLabelDebt[] {
  return cubeLabelDebt(profile).filter((d) => d.missing > 0)
}

/** A bilingual, honest note for a dimension's debt («N წევრს ეტიკეტი აკლია»). */
export function debtNote(missing: number, en: boolean): string {
  return en ? (missing === 1 ? '1 member lacks a label' : `${missing} members lack a label`)
            : `${missing} წევრს ეტიკეტი აკლია`
}

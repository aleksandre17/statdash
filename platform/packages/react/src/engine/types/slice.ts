// ── Engine Types — Slice layer ────────────────────────────────────────
//
//  Split from the former monolithic types.ts. This file owns the SLICE /
//  Constructor-taxonomy vocabulary.
//
//  The concrete definitions live in ../slice-meta (a cohesive module that
//  predates this split). This layer re-exports them so the `./types` public
//  API is unchanged.
//
export type {
  SliceCategory,
  SlotDef,
  PropertyGroup,
  ValidationError,
  PropFieldType,
  PropFieldSource,
  PropFieldOption,
  PropFieldValidation,
  AudiencePlane,
  PropField,
  PropSchema,
  ObjectMeta,
  PageSliceMeta,
  PanelSliceMeta,
  NodeSliceMeta,
  ChromeSlotConfig,
  ChromeEntry,
  ChromeSliceMeta,
  FilterControlMeta,
  SliceMeta,
  VariantDef,
  VariantSchema,
  BandDescriptor,
  CapabilityRequirement,
}                                from '../slice-meta'

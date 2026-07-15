// ── Select — the owned Radix surface (foundation pattern #1) ─────────────────
//
//  An OWNED compound component = unstyled Radix behavior + DTCG-token CSS +
//  a compound API. The primitive (`radix-ui` → `@radix-ui/react-select`) supplies
//  the WAI-ARIA listbox behavior we must never re-implement (roving tabindex,
//  `aria-activedescendant`, typeahead, focus trap/return, escape/outside-dismiss);
//  our CSS (Select.css, `@layer components`, tokens only) supplies the paint; and
//  this compound API is our MUI-free surface — consumers see `Select.Root/Trigger/
//  Content/Item`, never `radix-ui`. This is a BOUNDED ELEMENT (ADR-038) at the
//  component scale: it hides which primitive it wraps.
//
//  Home is `packages/react` (the app-agnostic React adapter), NOT `apps/panel` —
//  a second tenant (runner/plugins chrome) reuses and restyles it for free
//  (the H5 agnosticism fix at the root). Radix is a legitimate dependency of this
//  layer: Radix primitives are app-agnostic behavior.
//
//  Contract: controlled — `value` in, `onValueChange` out (identical to the
//  native `SelectControl` it replaces). Painted ONLY by design tokens; guarded by
//  FF-RADIX-TOKEN-ONLY (no hex/emotion/sx) + FF-RADIX-A11Y-INTACT (role + keyboard).
//
import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Select as RadixSelect } from 'radix-ui'
import './Select.css'

// ── Owned glyphs — the component paints its own chevron/check (no icon-lib
//    coupling, no MUI). Sized in `em` so they track the trigger/item font-size. ─
function ChevronDownGlyph() {
  return (
    <svg
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ChevronUpGlyph() {
  return (
    <svg
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

const cx = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' ')

// ── Root — controlled passthrough (value / onValueChange). No paint. ──────────
const Root = RadixSelect.Root

// ── Trigger — the closed control: value/placeholder + chevron, one owned part.
//    Forwards `id` (so an external <label htmlFor> binds the trigger button) and
//    `ref`; renders `Select.Value` internally so callers never touch the primitive.
interface TriggerProps extends ComponentPropsWithoutRef<typeof RadixSelect.Trigger> {
  /** Shown when no value is selected (Radix renders it via `Select.Value`). */
  placeholder?: ReactNode
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>(function Trigger(
  { placeholder, className, children, ...rest }, ref,
) {
  return (
    <RadixSelect.Trigger ref={ref} className={cx('ui-select__trigger', className)} {...rest}>
      {children ?? <RadixSelect.Value placeholder={placeholder} />}
      <RadixSelect.Icon className="ui-select__icon">
        <ChevronDownGlyph />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  )
})

// ── Content — the open listbox: portalled to <body> (tracks live theme edits,
//    like the MUI menu portal), popper-positioned, width-matched to the trigger,
//    with scroll affordances. `position="popper"` exposes the Radix CSS vars
//    (`--radix-select-trigger-width`, `--radix-select-content-available-height`)
//    the CSS binds for width/height. ─────────────────────────────────────────
type ContentProps = ComponentPropsWithoutRef<typeof RadixSelect.Content>

const Content = forwardRef<HTMLDivElement, ContentProps>(function Content(
  { className, children, position = 'popper', sideOffset = 6, ...rest }, ref,
) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cx('ui-select__content', className)}
        {...rest}
      >
        <RadixSelect.ScrollUpButton className="ui-select__scroll">
          <ChevronUpGlyph />
        </RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport className="ui-select__viewport">
          {children}
        </RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="ui-select__scroll">
          <ChevronDownGlyph />
        </RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  )
})

// ── Item — one option: text + the selected-state check indicator. ─────────────
type ItemProps = ComponentPropsWithoutRef<typeof RadixSelect.Item>

const Item = forwardRef<HTMLDivElement, ItemProps>(function Item(
  { className, children, ...rest }, ref,
) {
  return (
    <RadixSelect.Item ref={ref} className={cx('ui-select__item', className)} {...rest}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="ui-select__indicator">
        <CheckGlyph />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
})

/**
 * The owned compound `Select` — Radix behavior on the DTCG token spine.
 *
 * ```tsx
 * <Select.Root value={v} onValueChange={setV}>
 *   <Select.Trigger aria-label="Region" placeholder="—" />
 *   <Select.Content>
 *     <Select.Item value="ge">Georgia</Select.Item>
 *   </Select.Content>
 * </Select.Root>
 * ```
 */
export const Select = { Root, Trigger, Content, Item }

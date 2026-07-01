import './layout.css'

// `row` was the legacy viewport-media grid primitive (hardcoded 1280px collapse).
// Retired in favour of the container-query `columns` family — one grid handwriting
// (DESIGN-responsive-composition §3.2 / FF-NO-DUP-COLUMN-PRIMITIVE).
export * as grid    from './grid'
export * as columns from './columns'
export * as stack   from './stack'
export * as card    from './card'
export * as divider from './divider'
export * as spacer  from './spacer'
export * as wrap    from './wrap'
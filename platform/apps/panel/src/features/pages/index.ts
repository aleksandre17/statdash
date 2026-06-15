// NOTE: Superseded by wizard feature slices. Kept as RA Resource stubs for
// data provider mapping. Do not add new CRUD components here.
import { PageList } from './PageList'
import { PageEdit } from './PageEdit'
import { PageCreate } from './PageCreate'

// Pages feature barrel.
// Exports the React Admin <Resource> props as one object — App spreads it.
// Resource name maps 1:1 to the `pages` feature (RA convention).
export const pageResource = {
  name: 'pages',
  list: PageList,
  edit: PageEdit,
  create: PageCreate,
} as const

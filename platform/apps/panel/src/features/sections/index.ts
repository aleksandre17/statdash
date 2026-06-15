// NOTE: Superseded by wizard feature slices. Kept as RA Resource stubs for
// data provider mapping. Do not add new CRUD components here.
import { SectionList } from './SectionList'
import { SectionEdit } from './SectionEdit'
import { SectionCreate } from './SectionCreate'

// Sections feature barrel — RA <Resource> props.
export const sectionResource = {
  name: 'sections',
  list: SectionList,
  edit: SectionEdit,
  create: SectionCreate,
} as const

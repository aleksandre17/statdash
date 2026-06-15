// NOTE: Superseded by wizard feature slices. Kept as RA Resource stubs for
// data provider mapping. Do not add new CRUD components here.
import { DatasourceList } from './DatasourceList'
import { DatasourceEdit } from './DatasourceEdit'
import { DatasourceCreate } from './DatasourceCreate'

// Datasources feature barrel — RA <Resource> props.
export const datasourceResource = {
  name: 'datasources',
  list: DatasourceList,
  edit: DatasourceEdit,
  create: DatasourceCreate,
} as const

import { Edit, SimpleForm, TextInput, SelectInput } from 'react-admin'

// DataStore connection kinds — matches the engine's adapter boundary (fromSDMX et al.).
const DATASOURCE_TYPES = [
  { id: 'sdmx', name: 'SDMX' },
  { id: 'rest', name: 'REST' },
  { id: 'static', name: 'Static' },
]

// Datasources feature — edit view.
// Edits DataStore connection config: name, type, url.
export const DatasourceEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" />
      <SelectInput source="type" choices={DATASOURCE_TYPES} />
      <TextInput source="url" />
    </SimpleForm>
  </Edit>
)

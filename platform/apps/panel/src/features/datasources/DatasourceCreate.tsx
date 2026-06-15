import { Create, SimpleForm, TextInput, SelectInput } from 'react-admin'

// DataStore connection kinds — kept local to the feature slice.
const DATASOURCE_TYPES = [
  { id: 'sdmx', name: 'SDMX' },
  { id: 'rest', name: 'REST' },
  { id: 'static', name: 'Static' },
]

// Datasources feature — create view.
export const DatasourceCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" />
      <SelectInput source="type" choices={DATASOURCE_TYPES} />
      <TextInput source="url" />
    </SimpleForm>
  </Create>
)

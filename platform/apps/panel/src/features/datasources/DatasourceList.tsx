import { List, Datagrid, TextField, EditButton } from 'react-admin'

// Datasources feature — list view.
// Columns: id, name, type (sdmx/rest/static).
export const DatasourceList = () => (
  <List>
    <Datagrid>
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="type" />
      <EditButton />
    </Datagrid>
  </List>
)

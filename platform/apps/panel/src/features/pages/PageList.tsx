import { List, Datagrid, TextField, EditButton } from 'react-admin'

// Pages feature — list view.
// Columns: id, title, slug. Edit action per row.
export const PageList = () => (
  <List>
    <Datagrid>
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="slug" />
      <EditButton />
    </Datagrid>
  </List>
)

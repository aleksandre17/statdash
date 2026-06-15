import { List, Datagrid, TextField, EditButton } from 'react-admin'

// Sections feature — list view.
// Columns: id, title, type (chart/table/kpi), pageId.
export const SectionList = () => (
  <List>
    <Datagrid>
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="type" />
      <TextField source="pageId" />
      <EditButton />
    </Datagrid>
  </List>
)

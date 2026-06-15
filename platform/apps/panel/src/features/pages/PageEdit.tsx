import { Edit, SimpleForm, TextInput } from 'react-admin'

// Pages feature — edit view.
// Edits PageDef metadata: title, slug, description.
export const PageEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="title" />
      <TextInput source="slug" />
      <TextInput source="description" multiline />
    </SimpleForm>
  </Edit>
)

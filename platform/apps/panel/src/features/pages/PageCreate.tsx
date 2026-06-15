import { Create, SimpleForm, TextInput } from 'react-admin'

// Pages feature — create view.
// Same fields as edit; mirrors PageDef metadata shape.
export const PageCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="title" />
      <TextInput source="slug" />
      <TextInput source="description" multiline />
    </SimpleForm>
  </Create>
)

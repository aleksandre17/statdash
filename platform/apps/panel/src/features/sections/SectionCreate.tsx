import { Create, SimpleForm, TextInput, SelectInput, ReferenceInput } from 'react-admin'

// Section type discriminants — kept local to the feature slice.
const SECTION_TYPES = [
  { id: 'chart', name: 'Chart' },
  { id: 'table', name: 'Table' },
  { id: 'kpi', name: 'KPI' },
  { id: 'filter-bar', name: 'Filter Bar' },
]

// Sections feature — create view.
export const SectionCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="title" />
      <SelectInput source="type" choices={SECTION_TYPES} />
      <ReferenceInput source="pageId" reference="pages" />
    </SimpleForm>
  </Create>
)

import { Edit, SimpleForm, TextInput, SelectInput, ReferenceInput } from 'react-admin'

// Section type discriminants — drives which renderer the engine selects.
const SECTION_TYPES = [
  { id: 'chart', name: 'Chart' },
  { id: 'table', name: 'Table' },
  { id: 'kpi', name: 'KPI' },
  { id: 'filter-bar', name: 'Filter Bar' },
]

// Sections feature — edit view.
// Edits SectionDef: title, type discriminant, owning page reference.
export const SectionEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="title" />
      <SelectInput source="type" choices={SECTION_TYPES} />
      <ReferenceInput source="pageId" reference="pages" />
    </SimpleForm>
  </Edit>
)

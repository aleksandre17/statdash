import { Menu as RAMenu } from 'react-admin'

// Custom navigation menu — one entry per Constructor resource.
// Resource items resolve to the registered <Resource> definitions in App.
export const Menu = () => (
  <RAMenu>
    <RAMenu.ResourceItem name="pages" />
    <RAMenu.ResourceItem name="sections" />
    <RAMenu.ResourceItem name="datasources" />
  </RAMenu>
)

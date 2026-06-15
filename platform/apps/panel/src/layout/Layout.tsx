import { Layout as RALayout, type LayoutProps } from 'react-admin'
import { AppBar } from './AppBar'
import { Menu } from './Menu'

// Composes the Constructor shell: RA Layout + custom AppBar + custom Menu.
export const Layout = (props: LayoutProps) => (
  <RALayout {...props} appBar={AppBar} menu={Menu} />
)

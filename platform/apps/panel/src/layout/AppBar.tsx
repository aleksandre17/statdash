import { AppBar as RAAppBar, TitlePortal } from 'react-admin'
import { Typography } from '@mui/material'

// Custom AppBar for the Constructor shell.
// TitlePortal renders the per-page title; the static brand sits beside it.
export const AppBar = () => (
  <RAAppBar>
    <TitlePortal />
    <Typography variant="h6" color="inherit" sx={{ flex: 1, ml: 2 }}>
      Geostat Constructor
    </Typography>
  </RAAppBar>
)

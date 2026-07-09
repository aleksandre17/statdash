import { Snackbar, Alert } from '@mui/material'
import { useNotifyStore } from '../store/notify'

// ── ToastHost — the notify port's MUI renderer ────────────────────────────────
//
//  Subscribes to the notify queue (store/notify.ts) and surfaces one toast at a
//  time via MUI Snackbar/Alert (already a panel dependency — no new library). The
//  impl is MUI today; the PORT is ours, so this surface is decoupled from both
//  react-admin (retired) and MUI (the flagged exit). Mount once, near the app root.
export function ToastHost() {
  const current = useNotifyStore((s) => s.queue[0])
  const dismiss = useNotifyStore((s) => s.dismiss)

  if (!current) return null

  return (
    <Snackbar
      key={current.id}
      open
      autoHideDuration={4000}
      onClose={() => dismiss(current.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        severity={current.type}
        variant="filled"
        onClose={() => dismiss(current.id)}
        sx={{ width: '100%' }}
      >
        {current.message}
      </Alert>
    </Snackbar>
  )
}

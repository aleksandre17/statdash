// ── LoginForm — full-viewport admin login screen ───────────────────────────
//
//  Collects username + password → calls login() → notifies parent on success.
//  Shows a descriptive error on 401, a generic message on network failure.
//  No react-admin dependency — pure MUI (the panel is react-admin-free, AR-49 M1.1).
//

import { useState } from 'react'
import {
  Box, Paper, TextField, Button, Typography,
  CircularProgress, Alert,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { login, AuthError } from '../../lib/auth'

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      onSuccess()
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setError('არასწორი მომხმარებელი ან პაროლი.')
      } else {
        setError('სერვერთან კავშირი ვერ მოხერხდა. სცადეთ ხელახლა.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 5, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {/* Logo / icon */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 48, height: 48, borderRadius: '50%',
              bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <LockOutlinedIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>Constructor</Typography>
          <Typography variant="body2" color="text.secondary">GeoStat Statistics Dashboard Platform</Typography>
        </Box>

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="მომხმარებელი"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            size="small"
            fullWidth
            disabled={loading}
            inputProps={{ 'aria-label': 'Username' }}
          />
          <TextField
            label="პაროლი"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            size="small"
            fullWidth
            disabled={loading}
            inputProps={{ 'aria-label': 'Password' }}
          />

          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !username || !password}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loading ? 'შესვლა...' : 'შესვლა'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}

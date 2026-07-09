import { Box, Typography, Button } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import { useConstructorStore } from '../../../store/constructor.store'
import { DataModelingPanel } from '../../data-layer'

// ── DataStep — the wizard's data-modeling step (AR-49) ────────────────────────
//
//  The step is now a THIN frame: its own header + the "Continue → Site" waterfall
//  gate wrap the shared DataModelingPanel (the source/spec browser + editor,
//  extracted so the Studio Data surface mounts the SAME body — no fork, Law 6/7).
//  Behavior is byte-identical to the pre-extraction step; only the gate + heading
//  are wizard-specific and remain here (they are deleted with the wizard in M1.3b).
export function DataStep() {
  const markStepDone = useConstructorStore((s) => s.markStepDone)
  const goToStep     = useConstructorStore((s) => s.goToStep)

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <StorageIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>მონაცემთა შრე</Typography>
          <Typography variant="body2" color="text.secondary">
            კონფიგურირებეთ მონაცემების წყაროები და განსაზღვრეთ DataSpec-ები
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 420 }}>
        <DataModelingPanel />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => { markStepDone(0); goToStep(1) }}>
          გაგრძელება → საიტი
        </Button>
      </Box>
    </Box>
  )
}

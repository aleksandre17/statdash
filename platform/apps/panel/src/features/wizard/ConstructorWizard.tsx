import { lazy, Suspense } from 'react'
import { Box } from '@mui/material'
import { WizardStepper } from './WizardStepper'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import { useWizardStep } from '../../store/constructor.store'

// ── Route-level code-splitting (one step renders at a time) ───────────────────
//
//  Each wizard step is a heavy, mutually-exclusive surface: DataStep pulls the
//  full DataSpec editor suite + dnd-kit; PageStep pulls the live canvas (the REAL
//  @statdash/react renderer + ApexCharts), the outline, the cmdk command palette,
//  the inspector, filters and page-config. Only ONE step is mounted at a time, so
//  the wizard is the natural route boundary: lazy() + dynamic import() keep each
//  step out of the initial chunk, so the boot/shell loads small and the authoring
//  surface for the active step streams in on demand. The boundaries are
//  transparent — same components, just deferred (behavior byte-identical).
//
//  Steps are named exports → adapt to the default-export shape React.lazy expects.
const DataStep = lazy(() => import('./steps/DataStep').then((m) => ({ default: m.DataStep })))
const SiteStep = lazy(() => import('./steps/SiteStep').then((m) => ({ default: m.SiteStep })))
const PageStep = lazy(() => import('./steps/PageStep').then((m) => ({ default: m.PageStep })))

const STEP_CONTENT = [DataStep, SiteStep, PageStep] as const

/**
 * Top-level Constructor wizard: stepper + active step content.
 * Each step owns its own DndContext (self-contained drag logic, shared sensors via
 * useDndSensors), so the wizard no longer wraps a single platform-wide context.
 */
export function ConstructorWizard() {
  const activeStep = useWizardStep()
  const StepContent = STEP_CONTENT[activeStep]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <WizardStepper />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<SuspenseFallback label="Loading editor" />}>
          <StepContent />
        </Suspense>
      </Box>
    </Box>
  )
}

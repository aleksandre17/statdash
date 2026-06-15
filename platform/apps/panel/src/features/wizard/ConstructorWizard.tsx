import { Box } from '@mui/material'
import { WizardStepper } from './WizardStepper'
import { DataStep }  from './steps/DataStep'
import { SiteStep }  from './steps/SiteStep'
import { PageStep }  from './steps/PageStep'
import { useWizardStep } from '../../store/constructor.store'

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
        <StepContent />
      </Box>
    </Box>
  )
}

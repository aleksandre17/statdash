import { Stepper, Step, StepLabel, StepButton, Box, Typography, IconButton, Tooltip } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { WIZARD_STEPS } from '../../types/constructor'
import { useWizardStep, useCompletedSteps, useConstructorStore } from '../../store/constructor.store'
import { logout } from '../../lib/auth'

/**
 * Non-linear wizard stepper — once a step is completed the user may jump freely
 * between Data / Site / Pages. Step state is driven entirely by the store.
 * Logout button clears the session token and reloads to the login screen.
 */
export function WizardStepper() {
  const activeStep     = useWizardStep()
  const completedSteps = useCompletedSteps()
  const goToStep       = useConstructorStore((s) => s.goToStep)
  const locale         = useConstructorStore((s) => s.site.defaultLocale)

  const handleLogout = () => {
    logout()
    window.location.reload()   // simplest correct path: reload → App sees no token → login
  }

  return (
    <Box sx={{ width: '100%', px: 4, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
      <Stepper activeStep={activeStep} nonLinear sx={{ flex: 1 }}>
        {WIZARD_STEPS.map((step) => (
          <Step key={step.id} completed={completedSteps.has(step.index)}>
            <StepButton onClick={() => goToStep(step.index)}>
              <StepLabel>
                <Typography variant="subtitle2">{step.label[locale]}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description[locale]}
                </Typography>
              </StepLabel>
            </StepButton>
          </Step>
        ))}
      </Stepper>

      <Tooltip title={locale === 'en' ? 'Logout' : 'გასვლა'}>
        <IconButton
          onClick={handleLogout}
          size="small"
          aria-label={locale === 'en' ? 'Logout' : 'გასვლა'}
          sx={{ ml: 2, color: 'text.secondary' }}
        >
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

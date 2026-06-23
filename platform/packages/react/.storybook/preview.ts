import type { Preview } from '@storybook/react-vite'
import '../src/styles/index.css' // design tokens (@statdash/styles) + a11y utilities (.sr-only)

// Storybook 10 backgrounds API: `options` is a keyed map; the active background
// is selected via `initialGlobals.backgrounds.value` (the legacy
// `{ default, values }` shape is deprecated). Values mirror the design tokens
// so component stories render against real surface colours.
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
    backgrounds: {
      options: {
        light:   { name: 'light',   value: '#ffffff' },
        surface: { name: 'surface', value: '#f8f9fa' },
        dark:    { name: 'dark',    value: '#15151f' },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'light' },
  },
}

export default preview

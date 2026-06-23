import type { StorybookConfig } from '@storybook/react-vite'

// Storybook 10 — "essentials" addons (controls, actions, viewport, backgrounds,
// toolbars, measure, outline, highlight) are built into core and need not be
// listed. `@storybook/addon-docs` is the one separately-installed addon that
// provides autodocs / MDX. The `autodocs` story tag (set per-meta) drives doc
// page generation; the deprecated `docs.autodocs` config key is gone in v10.
const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config

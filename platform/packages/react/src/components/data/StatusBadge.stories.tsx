import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusBadge }         from './StatusBadge'

const meta: Meta<typeof StatusBadge> = {
  component: StatusBadge,
  title:     'Data / StatusBadge',
  tags:      ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['A', 'p', 'e', 'r', 'c'],
      description: 'SDMX OBS_STATUS code',
    },
  },
}
export default meta

type Story = StoryObj<typeof StatusBadge>

export const Preliminary:  Story = { args: { status: 'p' } }
export const Estimated:    Story = { args: { status: 'e' } }
export const Revised:      Story = { args: { status: 'r' } }
export const Confidential: Story = { args: { status: 'c' } }
export const Final: Story = {
  args: { status: 'A' },
  name: 'Final (A) — renders nothing',
}
export const NoStatus: Story = {
  args: { status: undefined },
  name: 'Undefined — renders nothing',
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChartDataTable }      from './ChartDataTable'
import type { ChartOutput }    from '@statdash/charts'

const meta: Meta<typeof ChartDataTable> = {
  component: ChartDataTable,
  title:     'Data / ChartDataTable',
  tags:      ['autodocs'],
}
export default meta

type Story = StoryObj<typeof ChartDataTable>

// A faithful ChartOutput fixture. Note: `tooltip` here is the OUTPUT shape
// (`{ show, shared }`) produced by interpretChart — not the ChartDef INPUT
// shape (`{ mode }`). Keeping these literals exact means no `as` cast is
// needed; the table renders from `categories` + `series` only.
const BASE_OUTPUT: ChartOutput = {
  type:       'bar',
  categories: ['2021', '2022', '2023'],
  series: [
    {
      name:  'GDP',
      color: '#005a9c',
      data: [
        { value: 12.3, formatted: '12.3' },
        { value: 14.5, formatted: '14.5' },
        { value: 16.0, formatted: '16.0' },
      ],
    },
  ],
  stacked:     false,
  horizontal:  false,
  legend:      { show: true, position: 'bottom' },
  tooltip:     { show: true, shared: true },
  axes:        { x: {}, y: {} },
  annotations: [],
}

export const SingleSeries: Story = {
  args: { output: BASE_OUTPUT, label: 'Gross Domestic Product' },
}

export const MultiSeries: Story = {
  args: {
    label: 'GDP vs GNP',
    output: {
      ...BASE_OUTPUT,
      categories: ['2022', '2023'],
      series: [
        { name: 'GDP', color: '#005a9c', data: [{ value: 12.3, formatted: '12.3' }, { value: 14.5, formatted: '14.5' }] },
        { name: 'GNP', color: '#e8710a', data: [{ value: 10.1, formatted: '10.1' }, { value: 11.8, formatted: '11.8' }] },
      ],
    },
  },
}

export const Empty: Story = {
  name: 'Empty output — renders nothing',
  args: {
    output: { ...BASE_OUTPUT, categories: [], series: [] },
  },
}

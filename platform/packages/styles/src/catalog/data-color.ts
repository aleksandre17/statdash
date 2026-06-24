// ── @statdash/styles — Data / scale color token descriptors ────────────────────
// Raw gray scale · status (feedback) · chart (categorical data-viz) palette.
// value hints are light-mode swatches for Panel preview; dark mode remaps in CSS.

import type { TokenDescriptor } from './types'

export const DATA_COLOR_TOKENS: Record<string, TokenDescriptor> = {

  // ── Gray scale (raw neutral primitives) ─────────────────────────────────────
  'gray.50':  { group: 'gray', cssVar: 'var(--gray-50)',  value: '#f8f9fa',
    label: { ka: 'ნაცრისფერი 50',  en: 'Gray 50'  }, description: { ka: 'ყველაზე ღია ნაცრისფერი.', en: 'Lightest gray.' } },
  'gray.100': { group: 'gray', cssVar: 'var(--gray-100)', value: '#f1f3f5',
    label: { ka: 'ნაცრისფერი 100', en: 'Gray 100' }, description: { ka: 'ძალიან ღია ნაცრისფერი.', en: 'Very light gray.' } },
  'gray.200': { group: 'gray', cssVar: 'var(--gray-200)', value: '#e9ecef',
    label: { ka: 'ნაცრისფერი 200', en: 'Gray 200' }, description: { ka: 'ღია ნაცრისფერი.', en: 'Light gray.' } },
  'gray.300': { group: 'gray', cssVar: 'var(--gray-300)', value: '#dee2e6',
    label: { ka: 'ნაცრისფერი 300', en: 'Gray 300' }, description: { ka: 'საზღვრის ნაცრისფერი.', en: 'Border gray.' } },
  'gray.400': { group: 'gray', cssVar: 'var(--gray-400)', value: '#ced4da',
    label: { ka: 'ნაცრისფერი 400', en: 'Gray 400' }, description: { ka: 'საშუალო-ღია ნაცრისფერი.', en: 'Mid-light gray.' } },
  'gray.500': { group: 'gray', cssVar: 'var(--gray-500)', value: '#adb5bd',
    label: { ka: 'ნაცრისფერი 500', en: 'Gray 500' }, description: { ka: 'საშუალო ნაცრისფერი.', en: 'Mid gray.' } },
  'gray.600': { group: 'gray', cssVar: 'var(--gray-600)', value: '#868e96',
    label: { ka: 'ნაცრისფერი 600', en: 'Gray 600' }, description: { ka: 'მკრთალი ტექსტის ნაცრისფერი.', en: 'Muted-text gray.' } },
  'gray.700': { group: 'gray', cssVar: 'var(--gray-700)', value: '#495057',
    label: { ka: 'ნაცრისფერი 700', en: 'Gray 700' }, description: { ka: 'მუქი ნაცრისფერი.', en: 'Dark gray.' } },
  'gray.800': { group: 'gray', cssVar: 'var(--gray-800)', value: '#343a40',
    label: { ka: 'ნაცრისფერი 800', en: 'Gray 800' }, description: { ka: 'ძალიან მუქი ნაცრისფერი.', en: 'Very dark gray.' } },
  'gray.900': { group: 'gray', cssVar: 'var(--gray-900)', value: '#212529',
    label: { ka: 'ნაცრისფერი 900', en: 'Gray 900' }, description: { ka: 'ყველაზე მუქი ნაცრისფერი.', en: 'Darkest gray.' } },

  // ── Status (feedback) — bg / border / fg per status ─────────────────────────
  'status.positive-bg':     { group: 'status', cssVar: 'var(--status-positive-bg)',     value: '#e6f4ea',
    label: { ka: 'დადებითი ფონი',   en: 'Positive BG'     }, description: { ka: 'დადებითი / ზრდის ფონი.', en: 'Positive / growth background.' } },
  'status.positive-border': { group: 'status', cssVar: 'var(--status-positive-border)', value: '#a3d9b5',
    label: { ka: 'დადებითი საზღვარი', en: 'Positive Border' }, description: { ka: 'დადებითი საზღვარი.', en: 'Positive border.' } },
  'status.positive-fg':     { group: 'status', cssVar: 'var(--status-positive-fg)',     value: '#1b7a43',
    label: { ka: 'დადებითი ტექსტი',  en: 'Positive FG'     }, description: { ka: 'დადებითი ტექსტი / ხატულა.', en: 'Positive text / icon.' } },

  'status.negative-bg':     { group: 'status', cssVar: 'var(--status-negative-bg)',     value: '#fdecea',
    label: { ka: 'უარყოფითი ფონი',   en: 'Negative BG'     }, description: { ka: 'უარყოფითი / შემცირების ფონი.', en: 'Negative / decline background.' } },
  'status.negative-border': { group: 'status', cssVar: 'var(--status-negative-border)', value: '#f3b6af',
    label: { ka: 'უარყოფითი საზღვარი', en: 'Negative Border' }, description: { ka: 'უარყოფითი საზღვარი.', en: 'Negative border.' } },
  'status.negative-fg':     { group: 'status', cssVar: 'var(--status-negative-fg)',     value: '#b3261e',
    label: { ka: 'უარყოფითი ტექსტი',  en: 'Negative FG'     }, description: { ka: 'უარყოფითი ტექსტი / ხატულა.', en: 'Negative text / icon.' } },

  'status.warning-bg':      { group: 'status', cssVar: 'var(--status-warning-bg)',      value: '#fff6e5',
    label: { ka: 'გაფრთხილების ფონი', en: 'Warning BG'     }, description: { ka: 'გაფრთხილების ფონი.', en: 'Warning background.' } },
  'status.warning-border':  { group: 'status', cssVar: 'var(--status-warning-border)',  value: '#f5d28a',
    label: { ka: 'გაფრთხილების საზღვარი', en: 'Warning Border' }, description: { ka: 'გაფრთხილების საზღვარი.', en: 'Warning border.' } },
  'status.warning-fg':      { group: 'status', cssVar: 'var(--status-warning-fg)',      value: '#8a5a00',
    label: { ka: 'გაფრთხილების ტექსტი', en: 'Warning FG'    }, description: { ka: 'გაფრთხილების ტექსტი / ხატულა.', en: 'Warning text / icon.' } },

  'status.info-bg':         { group: 'status', cssVar: 'var(--status-info-bg)',         value: '#e8f0f8',
    label: { ka: 'ინფო ფონი',        en: 'Info BG'         }, description: { ka: 'ინფორმაციული ფონი.', en: 'Informational background.' } },
  'status.info-border':     { group: 'status', cssVar: 'var(--status-info-border)',     value: '#a8c8e8',
    label: { ka: 'ინფო საზღვარი',    en: 'Info Border'     }, description: { ka: 'ინფორმაციული საზღვარი.', en: 'Informational border.' } },
  'status.info-fg':         { group: 'status', cssVar: 'var(--status-info-fg)',         value: '#0b4a82',
    label: { ka: 'ინფო ტექსტი',      en: 'Info FG'         }, description: { ka: 'ინფორმაციული ტექსტი / ხატულა.', en: 'Informational text / icon.' } },

  'status.preliminary-bg':     { group: 'status', cssVar: 'var(--status-preliminary-bg)',     value: '#f3eefb',
    label: { ka: 'წინასწარის ფონი',   en: 'Preliminary BG'   }, description: { ka: 'წინასწარი მონაცემის ფონი.', en: 'Preliminary-data background.' } },
  'status.preliminary-border': { group: 'status', cssVar: 'var(--status-preliminary-border)', value: '#c9b8e8',
    label: { ka: 'წინასწარის საზღვარი', en: 'Preliminary Border' }, description: { ka: 'წინასწარი მონაცემის საზღვარი.', en: 'Preliminary-data border.' } },
  'status.preliminary-fg':     { group: 'status', cssVar: 'var(--status-preliminary-fg)',     value: '#5b3a9b',
    label: { ka: 'წინასწარის ტექსტი',  en: 'Preliminary FG'   }, description: { ka: 'წინასწარი მონაცემის ბეჯი (ჯერ არ არის საბოლოო).', en: 'Preliminary-data badge (not yet final).' } },

  // ── Chart palette (categorical, deuteranopia-distinguishable) ───────────────
  'chart-color.series1':  { group: 'chart-color', cssVar: 'var(--chart-color-1)',  value: '#005a9c',
    label: { ka: 'სერია 1',  en: 'Series 1'  }, description: { ka: 'მე-1 სერია — ლურჯი.', en: 'Series 1 — blue.' } },
  'chart-color.series2':  { group: 'chart-color', cssVar: 'var(--chart-color-2)',  value: '#e8710a',
    label: { ka: 'სერია 2',  en: 'Series 2'  }, description: { ka: 'მე-2 სერია — ნარინჯისფერი.', en: 'Series 2 — orange.' } },
  'chart-color.series3':  { group: 'chart-color', cssVar: 'var(--chart-color-3)',  value: '#1b9e77',
    label: { ka: 'სერია 3',  en: 'Series 3'  }, description: { ka: 'მე-3 სერია — მწვანე.', en: 'Series 3 — teal-green.' } },
  'chart-color.series4':  { group: 'chart-color', cssVar: 'var(--chart-color-4)',  value: '#d81b60',
    label: { ka: 'სერია 4',  en: 'Series 4'  }, description: { ka: 'მე-4 სერია — მაჯენტა.', en: 'Series 4 — magenta.' } },
  'chart-color.series5':  { group: 'chart-color', cssVar: 'var(--chart-color-5)',  value: '#7b3294',
    label: { ka: 'სერია 5',  en: 'Series 5'  }, description: { ka: 'მე-5 სერია — იისფერი.', en: 'Series 5 — purple.' } },
  'chart-color.series6':  { group: 'chart-color', cssVar: 'var(--chart-color-6)',  value: '#c79a00',
    label: { ka: 'სერია 6',  en: 'Series 6'  }, description: { ka: 'მე-6 სერია — მდოგვისფერი.', en: 'Series 6 — mustard.' } },
  'chart-color.series7':  { group: 'chart-color', cssVar: 'var(--chart-color-7)',  value: '#4eb3d3',
    label: { ka: 'სერია 7',  en: 'Series 7'  }, description: { ka: 'მე-7 სერია — ცისფერი.', en: 'Series 7 — sky.' } },
  'chart-color.series8':  { group: 'chart-color', cssVar: 'var(--chart-color-8)',  value: '#984ea3',
    label: { ka: 'სერია 8',  en: 'Series 8'  }, description: { ka: 'მე-8 სერია — ვიოლეტი.', en: 'Series 8 — violet.' } },
  'chart-color.series9':  { group: 'chart-color', cssVar: 'var(--chart-color-9)',  value: '#66a61e',
    label: { ka: 'სერია 9',  en: 'Series 9'  }, description: { ka: 'მე-9 სერია — ზეთისხილისფერი.', en: 'Series 9 — olive.' } },
  'chart-color.series10': { group: 'chart-color', cssVar: 'var(--chart-color-10)', value: '#8c564b',
    label: { ka: 'სერია 10', en: 'Series 10' }, description: { ka: 'მე-10 სერია — ყავისფერი.', en: 'Series 10 — brown.' } },
}

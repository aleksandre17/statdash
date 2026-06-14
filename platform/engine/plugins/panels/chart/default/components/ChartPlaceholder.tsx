import './chart-placeholder.css'

export type ChartType = 'bar' | 'hbar' | 'line' | 'pie' | 'donut' | 'waterfall' | 'map' | 'sankey' | 'combo'

interface ChartPlaceholderProps {
  type?: ChartType
  label?: string
  text?: string
  height?: number
}

const ICONS: Record<ChartType, React.ReactNode> = {
  bar: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="4" height="11" rx="1"/><rect x="9" y="6" width="4" height="15" rx="1"/><rect x="16" y="2" width="4" height="19" rx="1"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
    </svg>
  ),
  hbar: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4"  width="12" height="3.5" rx="1"/><rect x="3" y="10" width="17" height="3.5" rx="1"/><rect x="3" y="16" width="9"  height="3.5" rx="1"/>
      <line x1="3" y1="2" x2="3" y2="22"/>
    </svg>
  ),
  line: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 18 7 10 12 14 17 6 22 10"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
    </svg>
  ),
  pie: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.2 15A9 9 0 1 1 9 2.8"/>
      <path d="M21.2 15A9 9 0 0 0 9 2.8L12 12Z"/>
    </svg>
  ),
  donut: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
      <path d="M12 3a9 9 0 0 1 7.8 13.5"/>
    </svg>
  ),
  waterfall: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2"  y="12" width="4" height="9"  rx="1"/>
      <rect x="7"  y="7"  width="4" height="5"  rx="1"/>
      <rect x="12" y="9"  width="4" height="3"  rx="1"/>
      <rect x="17" y="5"  width="4" height="16" rx="1"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
    </svg>
  ),
  map: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),
  sankey: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5h4v14H2z"/><path d="M18 8h4v8h-4z"/>
      <path d="M6 7q8 0 12 3"/><path d="M6 15q8 0 12-3"/>
    </svg>
  ),
  combo: (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="12" width="3.5" height="9" rx="1"/><rect x="7" y="8" width="3.5" height="13" rx="1"/>
      <rect x="12" y="10" width="3.5" height="11" rx="1"/><rect x="17" y="5" width="3.5" height="16" rx="1"/>
      <polyline points="2 10 7 6 12 8 17 3 22 6" strokeDasharray="1.5 1.5"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
    </svg>
  ),
}

const LABELS: Record<ChartType, string> = {
  bar:       'სვეტოვანი დიაგრამა',
  hbar:      'ჰორიზონტალური ბარ დიაგრამა',
  line:      'ხაზოვანი დიაგრამა',
  pie:       'წრიული დიაგრამა',
  donut:     'დონატის დიაგრამა',
  waterfall: 'Waterfall დიაგრამა',
  map:       'ქორეპლეთ რუკა',
  sankey:    'Sankey დიაგრამა',
  combo:     'კომბინირებული დიაგრამა',
}

export default function ChartPlaceholder({ type = 'bar', label, text, height = 280 }: ChartPlaceholderProps) {
  return (
    <div className="chart-ph" style={{ minHeight: height }}>
      <div className="chart-ph-icon">{ICONS[type]}</div>
      <div className="chart-ph-label">{label ?? LABELS[type]}</div>
      <div className="chart-ph-text">{text ?? 'ვიზუალიზაცია მალე დაემატება'}</div>
    </div>
  )
}
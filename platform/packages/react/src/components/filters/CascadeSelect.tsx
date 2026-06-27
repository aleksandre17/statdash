import { useResolveLocaleSafe } from '../../context/SiteContext'
import type { LocaleString }    from '@statdash/engine'

interface CascadeNode {
  id: number
  value: LocaleString
  children?: CascadeNode[]
}

interface Props {
  tree:         CascadeNode[]
  path:         number[]
  onChange:     (path: number[]) => void
  allLabel:     LocaleString
  placeholders?: string[]
  disabled?:    boolean
}

export default function CascadeSelect({ tree, path, onChange, allLabel, placeholders = [], disabled }: Props) {
  // i18n boundary: resolve LocaleString node values + allLabel to the active locale
  // (no-op on plain strings) so a bilingual cascade label never renders [object Object].
  const t = useResolveLocaleSafe()
  const levels: CascadeNode[][] = [tree]
  for (let i = 0; i < path.length; i++) {
    const node = levels[i]?.find((n) => n.id === path[i])
    if (node?.children?.length) levels.push(node.children)
    else break
  }

  const handleChange = (levelIdx: number, raw: string) => {
    if (raw === '') {
      onChange(path.slice(0, levelIdx))
    } else {
      onChange([...path.slice(0, levelIdx), Number(raw)])
    }
  }

  return (
    <>
      {levels.map((nodes, levelIdx) => (
        <select
          key={levelIdx}
          className="filter-select"
          value={path[levelIdx] ?? ''}
          onChange={(e) => handleChange(levelIdx, e.target.value)}
          disabled={disabled}
          aria-label={placeholders?.[levelIdx] ?? String(levelIdx + 1)}
        >
          <option value="">{t(allLabel)}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {t(n.value)}
            </option>
          ))}
        </select>
      ))}
    </>
  )
}
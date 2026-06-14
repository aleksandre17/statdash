interface CascadeNode {
  id: number
  value: string
  children?: CascadeNode[]
}

interface Props {
  tree:         CascadeNode[]
  path:         number[]
  onChange:     (path: number[]) => void
  placeholders?: string[]
  disabled?:    boolean
}

export default function CascadeSelect({ tree, path, onChange, placeholders = [], disabled }: Props) {
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
          aria-label={placeholders[levelIdx] ?? `დონე ${levelIdx + 1}`}
        >
          <option value="">{placeholders[levelIdx] ?? 'ყველა'}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.value}
            </option>
          ))}
        </select>
      ))}
    </>
  )
}
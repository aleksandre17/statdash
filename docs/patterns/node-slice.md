# Pattern: NodeSlice Anatomy

Full spec → `docs/architecture/subsystems/02-node-system.md` (Plugin Anatomy section)

```ts
// plugins/nodes/<type>/index.ts
export const Shell: NodeRenderer<MyNode> =
  (def, ctx, children) => <MyControl def={def} ctx={ctx} children={children} />
// ↑ NOT a React component — plain function call. Hooks → inner component only.

function MyControl({ def, ctx, children }: { def: MyNode; ctx: RenderContext; children: ChildrenArg }) {
  const t   = useResolveLocale()   // content strings
  const fmt = useFmt()             // number/date formatting
  // hooks here ✅
  return <div>...</div>
}

export const META: NodeSliceMeta = {
  sliceType:  'node',
  type:       'my-type',
  variant:    'default',           // omit → 'default'
  label:      { ka: '...', en: '...' },
  category:   'content',
  i18n:       { ka: { export: 'ექსპორტი' }, en: { export: 'Export' } },  // system UI strings
}

export const Skeleton: () => ReactNode = () => <div className="skeleton" />
```

## Rules

- Shell = plain function `(def, ctx, children) => ReactNode` — NOT `React.FC`
- Hooks only in inner component (component wrapper pattern)
- `useResolveLocale()` for content strings, `useFmt()` for numbers/dates
- `ZERO PROPS` on Chrome shells — `() => ReactNode`
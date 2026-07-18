import { useMemo, useState } from 'react'
import { Box, Typography, Collapse, Chip } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { CubeProfileMember } from '../../lib/cubeApi'
import { readLocale } from '../../inspector/localeString'
import { memberLacksLabel } from '../../features/data-layer/workbench/cubeDebt'
import type { Locale } from '../../types/constructor'

// ── CodelistTree — the browsable classifier of ONE dimension (0091 · SDMX DSD) ──
//
//  «ჯერ შეიმეცნოს, მერე მანიპულირება» (owner): a cube is unreadable without its
//  classifiers. This renders a dimension's live codelist — its members with governed
//  labels — as the SDMX DSD canon shows them: a TREE where parent edges exist (Eurostat
//  NACE/COFOG browser, .Stat registry class), a flat list where they don't. READ-ONLY
//  comprehension, never manipulation (the shape-it acts live behind the steward lens).
//
//  ── One SSOT, no invention (reuses the cube-profile/codelist source) ───────────
//  Members come straight from the CubeProfile the cubeProfile.store already caches —
//  no second fetch path. Hierarchy is derived PURELY from each member's `parentCode`
//  (the wire's own edge). A governed label is read through the locale reader; a member
//  that LACKS one falls back HONESTLY to its raw code + a muted "code only" mark (the
//  R/U governance debt made visible, never a fabricated label — cubeDebt spirit, Law 9).
//
//  WCAG (Law 9): a labelled tree (role=tree/treeitem/group), each branch a real
//  <button> disclosure with aria-expanded; bilingual chrome; a leaf is plain text.

interface TreeNodeModel {
  member:   CubeProfileMember
  children: TreeNodeModel[]
}

/** Build the member forest from `parentCode` edges. A member whose parent is absent
 *  from the codelist is promoted to a root (an orphan is shown, never dropped). Pure. */
function buildForest(members: CubeProfileMember[]): { roots: TreeNodeModel[]; hierarchical: boolean } {
  const byCode = new Map<string, CubeProfileMember>()
  for (const m of members) byCode.set(m.code, m)

  const childrenOf = new Map<string | null, CubeProfileMember[]>()
  let hierarchical = false
  for (const m of members) {
    const parent = m.parentCode != null && byCode.has(m.parentCode) ? m.parentCode : null
    if (parent != null) hierarchical = true
    const bucket = childrenOf.get(parent) ?? []
    bucket.push(m)
    childrenOf.set(parent, bucket)
  }

  const toNode = (m: CubeProfileMember): TreeNodeModel => ({
    member:   m,
    children: (childrenOf.get(m.code) ?? []).map(toNode),
  })

  return { roots: (childrenOf.get(null) ?? []).map(toNode), hierarchical }
}

function MemberLabel({ member, locale }: { member: CubeProfileMember; locale: Locale }) {
  const en = locale === 'en'
  const label = readLocale(member.label, locale)
  const lacks = memberLacksLabel(member)
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
      <Typography variant="body2" component="span" sx={{ fontWeight: lacks ? 400 : 500 }} noWrap>
        {label || member.code}
      </Typography>
      {!lacks && (
        <Typography variant="caption" component="span" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {member.code}
        </Typography>
      )}
      {lacks && (
        <Chip size="small" variant="outlined" label={en ? 'code only' : 'მხოლოდ კოდი'}
          sx={{ height: 16, '& .MuiChip-label': { px: 0.5, fontSize: 10 } }} />
      )}
    </Box>
  )
}

function TreeBranch({ node, locale, depth }: { node: TreeNodeModel; locale: Locale; depth: number }) {
  const [open, setOpen] = useState(depth === 0 && node.children.length <= 8)
  const hasChildren = node.children.length > 0
  const en = locale === 'en'

  if (!hasChildren) {
    return (
      <Box component="li" role="treeitem" sx={{ py: 0.25, pl: 3 }}>
        <MemberLabel member={node.member} locale={locale} />
      </Box>
    )
  }
  return (
    <Box component="li" role="treeitem" aria-expanded={open}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{
          width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 0.5,
          py: 0.25, px: 0.5, font: 'inherit', border: 0, borderRadius: 1, cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        <MemberLabel member={node.member} locale={locale} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {en ? `${node.children.length}` : `${node.children.length}`}
        </Typography>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box component="ul" role="group" sx={{ listStyle: 'none', m: 0, pl: 1.5 }}>
          {node.children.map((c) => (
            <TreeBranch key={c.member.code} node={c} locale={locale} depth={depth + 1} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

export function CodelistTree({ members, locale }: { members: CubeProfileMember[]; locale: Locale }) {
  const en = locale === 'en'
  const { roots, hierarchical } = useMemo(() => buildForest(members), [members])

  if (members.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" data-testid="codelist-empty">
        {en ? 'No members in this codelist.' : 'ამ კლასიფიკატორს წევრები არ აქვს.'}
      </Typography>
    )
  }

  return (
    <Box
      component="ul"
      role="tree"
      aria-label={en ? 'Codelist members' : 'კლასიფიკატორის წევრები'}
      data-testid="codelist-tree"
      data-hierarchical={hierarchical || undefined}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {roots.map((node) => (
        <TreeBranch key={node.member.code} node={node} locale={locale} depth={0} />
      ))}
    </Box>
  )
}

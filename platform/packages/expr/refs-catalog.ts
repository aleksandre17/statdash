// Capability Descriptor for @statdash/expr — refs catalog. Consumed by Panel's
// reference picker UI (which binding type to use in an expression slot).
// NOT META.  Pattern: Self-Describing Module.

export type RefKind = 'scalar' | 'array'

export type RefDescriptor = {
  kind:        RefKind
  label:       { ka: string; en: string }
  description: { ka: string; en: string }
  /** The JSON key that identifies this ref — e.g. '$ctx', '$row', '$rows' */
  key:         string
  example:     string
}

export const REFS_CATALOG: Record<string, RefDescriptor> = {
  '$ctx': {
    kind:  'scalar',
    key:   '$ctx',
    label: { ka: 'კონტექსტი',   en: 'Context' },
    description: {
      ka: 'scope.dims[key] — მომხმარებლის მიერ არჩეული ფილტრის პარამეტრი.',
      en: 'scope.dims[key] — the user-selected filter parameter value.',
    },
    example: '{ "$ctx": "geo" }',
  },
  '$derived': {
    kind:  'scalar',
    key:   '$derived',
    label: { ka: 'გამოთვლილი',  en: 'Derived' },
    description: {
      ka: 'scope.derived[key] — evalDerived()-ის შედეგი.',
      en: 'scope.derived[key] — an output of evalDerived().',
    },
    example: '{ "$derived": "selectedLabel" }',
  },
  '$row': {
    kind:  'scalar',
    key:   '$row',
    label: { ka: 'მიმდინარე სტრიქონი', en: 'Current Row' },
    description: {
      ka: 'scope.row?.[key] — კოლექციის ოპერაციის ბლოკში მიმდინარე ელემენტი.',
      en: 'scope.row?.[key] — the current item inside a collection op body.',
    },
    example: '{ "$row": "code" }',
  },
  '$literal': {
    kind:  'scalar',
    key:   '$literal',
    label: { ka: 'ლიტერალი',    en: 'Literal' },
    description: {
      ka: 'DimVal სკალარული ლიტერალი — სტრიქონი, რიცხვი, boolean, null.',
      en: 'Explicit scalar literal — string, number, boolean, or null.',
    },
    example: '{ "$literal": 42 }',
  },
  '$rows': {
    kind:  'array',
    key:   '$rows',
    label: { ka: 'სტრიქონთა სია', en: 'Row List' },
    description: {
      ka: 'ListRef — scope.rows[] მასივი. მხოლოდ კოლექციის ოპერაციებში.',
      en: 'ListRef — the scope.rows[] array. Only valid in collection ops.',
    },
    example: '{ "$rows": true }',
  },
}

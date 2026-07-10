// Capability Descriptor for @statdash/expr — ops catalog. Consumed by Panel's
// expression builder UI.  NOT META.  Pattern: Self-Describing Module.

// exprVal=any ExprVal  expr=boolean Expr  string=literal  list=ListRef  []variants
export type OpCategory = 'comparison' | 'logic' | 'arithmetic' | 'string' | 'lookup' | 'collection'
export type OpArgType  = 'exprVal' | 'expr' | 'string' | 'list' | 'exprVal[]' | 'expr[]'

export type OpDescriptor = {
  category:    OpCategory
  label:       { ka: string; en: string }
  description: { ka: string; en: string }
  /** Ordered field descriptors — Panel builds one form row per entry. */
  fields: Array<{
    key:       string      // matches the op's TypeScript field name exactly
    type:      OpArgType
    label:     { ka: string; en: string }
    optional?: boolean
  }>
  /** Short usage hint shown in Panel tooltip — concrete JSON snippet. */
  example: string
}

// ── OPS_CATALOG ───────────────────────────────────────────────────────────────

export const OPS_CATALOG: Record<string, OpDescriptor> = {

  // ── Comparison ───────────────────────────────────────────────────────────────

  'eq': {
    category: 'comparison',
    label:       { ka: 'ტოლია',        en: 'Equals' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა და მარჯვენა მნიშვნელობები ერთმანეთის ტოლია.',
                   en: 'Returns true when the left and right values are strictly equal.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "eq", "left": { "$ctx": "geo" }, "right": "GE" }',
  },

  'ne': {
    category: 'comparison',
    label:       { ka: 'არ ტოლია',     en: 'Not equal' },
    description: { ka: 'აბრუნებს true-ს, თუ მნიშვნელობები განსხვავებულია.',
                   en: 'Returns true when the left and right values differ.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "ne", "left": { "$ctx": "sector" }, "right": "total" }',
  },

  'gt': {
    category: 'comparison',
    label:       { ka: 'მეტია',        en: 'Greater than' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა მარჯვენაზე მეტია.',
                   en: 'Returns true when the left value is strictly greater than the right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "gt", "left": { "$row": "value" }, "right": 0 }',
  },

  'lt': {
    category: 'comparison',
    label:       { ka: 'ნაკლებია',     en: 'Less than' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა მარჯვენაზე ნაკლებია.',
                   en: 'Returns true when the left value is strictly less than the right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "lt", "left": { "$row": "pct" }, "right": 50 }',
  },

  'gte': {
    category: 'comparison',
    label:       { ka: 'მეტია ან ტოლი',   en: 'Greater than or equal' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა მარჯვენაზე მეტია ან ტოლია.',
                   en: 'Returns true when the left value is greater than or equal to the right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "gte", "left": { "$row": "value" }, "right": 100 }',
  },

  'lte': {
    category: 'comparison',
    label:       { ka: 'ნაკლებია ან ტოლი', en: 'Less than or equal' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა მარჯვენაზე ნაკლებია ან ტოლია.',
                   en: 'Returns true when the left value is less than or equal to the right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "lte", "left": { "$row": "rank" }, "right": 10 }',
  },

  'in': {
    category: 'comparison',
    label:       { ka: 'სიაში შედის',  en: 'In list' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა მოცემული სიის ერთ-ერთი ელემენტია.',
                   en: 'Returns true when the left value matches any element in the right array.' },
    fields: [
      { key: 'left',  type: 'exprVal',  label: { ka: 'მნიშვნელობა', en: 'Value' } },
      { key: 'right', type: 'exprVal[]', label: { ka: 'დასაშვები სია', en: 'Allowed list' } },
    ],
    example: '{ "op": "in", "left": { "$ctx": "geo" }, "right": ["GE", "AM", "AZ"] }',
  },

  'nin': {
    category: 'comparison',
    label:       { ka: 'სიაში არ შედის', en: 'Not in list' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა მნიშვნელობა სიაში არ გვხვდება.',
                   en: 'Returns true when the left value is absent from the right array.' },
    fields: [
      { key: 'left',  type: 'exprVal',  label: { ka: 'მნიშვნელობა',    en: 'Value'        } },
      { key: 'right', type: 'exprVal[]', label: { ka: 'გამორიცხული სია', en: 'Excluded list' } },
    ],
    example: '{ "op": "nin", "left": { "$ctx": "sector" }, "right": ["total", "other"] }',
  },

  'null': {
    category: 'comparison',
    label:       { ka: 'ცარიელია (null)',  en: 'Is null' },
    description: { ka: 'აბრუნებს true-ს, თუ მნიშვნელობა null-ია.',
                   en: 'Returns true when the value resolves to null.' },
    fields: [
      { key: 'value', type: 'exprVal', label: { ka: 'მნიშვნელობა', en: 'Value' } },
    ],
    example: '{ "op": "null", "value": { "$row": "code" } }',
  },

  'exists': {
    category: 'comparison',
    label:       { ka: 'არსებობს (არ არის null)', en: 'Exists (not null)' },
    description: { ka: 'აბრუნებს true-ს, თუ მნიშვნელობა განსაზღვრულია და null-ი არ არის.',
                   en: 'Returns true when the value is defined and non-null.' },
    fields: [
      { key: 'value', type: 'exprVal', label: { ka: 'მნიშვნელობა', en: 'Value' } },
    ],
    example: '{ "op": "exists", "value": { "$ctx": "region" } }',
  },

  // ── Logic ─────────────────────────────────────────────────────────────────────

  'and': {
    category: 'logic',
    label:       { ka: 'და (ყველა)',    en: 'And (all)' },
    description: { ka: 'აბრუნებს true-ს, თუ ყველა ქვეგამოსახულება true-ს აბრუნებს.',
                   en: 'Returns true when every sub-expression evaluates to true.' },
    fields: [
      { key: 'exprs', type: 'expr[]', label: { ka: 'პირობები', en: 'Conditions' } },
    ],
    example: '{ "op": "and", "exprs": [{ "op": "eq", "left": { "$ctx": "geo" }, "right": "GE" }, { "op": "gt", "left": { "$row": "value" }, "right": 0 }] }',
  },

  'or': {
    category: 'logic',
    label:       { ka: 'ან (ერთი მაინც)', en: 'Or (any)' },
    description: { ka: 'აბრუნებს true-ს, თუ ქვეგამოსახულებათაგან ერთი მაინც true-ს აბრუნებს.',
                   en: 'Returns true when at least one sub-expression evaluates to true.' },
    fields: [
      { key: 'exprs', type: 'expr[]', label: { ka: 'პირობები', en: 'Conditions' } },
    ],
    example: '{ "op": "or", "exprs": [{ "op": "eq", "left": { "$ctx": "geo" }, "right": "GE" }, { "op": "eq", "left": { "$ctx": "geo" }, "right": "AM" }] }',
  },

  'not': {
    category: 'logic',
    label:       { ka: 'არა (უარყოფა)', en: 'Not (negate)' },
    description: { ka: 'ასრულებს ლოგიკურ უარყოფას — true → false, false → true.',
                   en: 'Negates the sub-expression — true becomes false and vice versa.' },
    fields: [
      { key: 'expr', type: 'expr', label: { ka: 'პირობა', en: 'Condition' } },
    ],
    example: '{ "op": "not", "expr": { "op": "null", "value": { "$ctx": "sector" } } }',
  },

  'if': {
    category: 'logic',
    label:       { ka: 'თუ/მაშინ/სხვა', en: 'If / then / else' },
    description: { ka: 'პირობითი განშტოება: თუ cond true-ა, აბრუნებს then-ს, სხვა შემთხვევაში else-ს (ან null-ს).',
                   en: 'Conditional branch: returns then when cond is true, else (or null) otherwise.' },
    fields: [
      { key: 'cond', type: 'expr',    label: { ka: 'პირობა',          en: 'Condition'      } },
      { key: 'then', type: 'exprVal', label: { ka: 'შედეგი (true)',    en: 'Then (true)'    } },
      { key: 'else', type: 'exprVal', label: { ka: 'სხვა (false)',     en: 'Else (false)'   }, optional: true },
    ],
    example: '{ "op": "if", "cond": { "op": "eq", "left": { "$ctx": "geo" }, "right": "GE" }, "then": "საქართველო", "else": "სხვა" }',
  },

  // ── Arithmetic ────────────────────────────────────────────────────────────────

  'add': {
    category: 'arithmetic',
    label:       { ka: 'შეკრება',  en: 'Add' },
    description: { ka: 'ასრულებს ორი მნიშვნელობის შეკრებას.',
                   en: 'Returns the sum of the left and right values.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "add", "left": { "$row": "value" }, "right": 1000 }',
  },

  'sub': {
    category: 'arithmetic',
    label:       { ka: 'გამოკლება', en: 'Subtract' },
    description: { ka: 'ასრულებს მარცხენა მნიშვნელობიდან მარჯვენის გამოკლებას.',
                   en: 'Returns the difference left − right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "sub", "left": { "$row": "value" }, "right": { "$derived": "base" } }',
  },

  'mul': {
    category: 'arithmetic',
    label:       { ka: 'გამრავლება', en: 'Multiply' },
    description: { ka: 'ასრულებს ორი მნიშვნელობის გამრავლებას.',
                   en: 'Returns the product of the left and right values.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "mul", "left": { "$row": "pct" }, "right": 0.01 }',
  },

  'div': {
    category: 'arithmetic',
    label:       { ka: 'გაყოფა',    en: 'Divide' },
    description: { ka: 'ყოფს მარცხენა მნიშვნელობას მარჯვენაზე. ნულზე გაყოფა null-ს აბრუნებს.',
                   en: 'Returns left divided by right. Division by zero yields null.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მრიცხველი',  en: 'Numerator'   } },
      { key: 'right', type: 'exprVal', label: { ka: 'მნიშვნელი', en: 'Denominator' } },
    ],
    example: '{ "op": "div", "left": { "$row": "value" }, "right": { "$derived": "gdp" } }',
  },

  'mod': {
    category: 'arithmetic',
    label:       { ka: 'ნაშთი',     en: 'Modulo' },
    description: { ka: 'აბრუნებს მარცხენა მნიშვნელობის მარჯვენაზე გაყოფის ნაშთს.',
                   en: 'Returns the remainder of left divided by right.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'მარცხენა',  en: 'Left'  } },
      { key: 'right', type: 'exprVal', label: { ka: 'მარჯვენა', en: 'Right' } },
    ],
    example: '{ "op": "mod", "left": { "$row": "index" }, "right": 2 }',
  },

  'abs': {
    category: 'arithmetic',
    label:       { ka: 'აბსოლუტური', en: 'Absolute value' },
    description: { ka: 'აბრუნებს მნიშვნელობის აბსოლუტურ (ნიშნისგან დამოუკიდებელ) სიდიდეს.',
                   en: 'Returns the absolute (sign-independent) magnitude of the value.' },
    fields: [
      { key: 'value', type: 'exprVal', label: { ka: 'მნიშვნელობა', en: 'Value' } },
    ],
    example: '{ "op": "abs", "value": { "$row": "delta" } }',
  },

  'neg': {
    category: 'arithmetic',
    label:       { ka: 'უარყოფითი (−x)', en: 'Negate (−x)' },
    description: { ka: 'აბრუნებს მნიშვნელობის ნიშანშეცვლილ (უარყოფით) სიდიდეს.',
                   en: 'Returns the arithmetic negation (sign-flipped value).' },
    fields: [
      { key: 'value', type: 'exprVal', label: { ka: 'მნიშვნელობა', en: 'Value' } },
    ],
    example: '{ "op": "neg", "value": { "$row": "value" } }',
  },

  // ── String ────────────────────────────────────────────────────────────────────

  'template': {
    category: 'string',
    label:       { ka: 'შაბლონი',       en: 'Template string' },
    description: { ka: 'ჩანაცვლებს {key} ადგილსამსახველებს scope.dims-ის მიხედვით და აბრუნებს სტრიქონს.',
                   en: 'Interpolates {key} placeholders from scope.dims and returns the resulting string.' },
    fields: [
      { key: 'tmpl', type: 'string', label: { ka: 'შაბლონი', en: 'Template' } },
    ],
    example: '{ "op": "template", "tmpl": "{time} წელი — {geo}" }',
  },

  'concat': {
    category: 'string',
    label:       { ka: 'გაერთიანება',   en: 'Concatenate' },
    description: { ka: 'აერთიანებს მნიშვნელობათა სიას ერთ სტრიქონად (null მნიშვნელობები იგნორირდება).',
                   en: 'Joins the values array into a single string, skipping nulls.' },
    fields: [
      { key: 'values', type: 'exprVal[]', label: { ka: 'მნიშვნელობები', en: 'Values' } },
    ],
    example: '{ "op": "concat", "values": [{ "$ctx": "geo" }, " — ", { "$ctx": "time" }] }',
  },

  'startsWith': {
    category: 'string',
    label:       { ka: 'იწყება (სტრიქონი)', en: 'Starts with' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა სტრიქონი მარჯვენა პრეფიქსით იწყება.',
                   en: 'Returns true when the left string begins with the right prefix literal.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'სტრიქონი', en: 'String' } },
      { key: 'right', type: 'string',  label: { ka: 'პრეფიქსი', en: 'Prefix' } },
    ],
    example: '{ "op": "startsWith", "left": { "$row": "code" }, "right": "GE_" }',
  },

  'includes': {
    category: 'string',
    label:       { ka: 'შეიცავს (სტრიქონი)', en: 'Includes (string)' },
    description: { ka: 'აბრუნებს true-ს, თუ მარცხენა სტრიქონი მარჯვენა ქვეტექსტს შეიცავს.',
                   en: 'Returns true when the left string contains the right substring literal.' },
    fields: [
      { key: 'left',  type: 'exprVal', label: { ka: 'სტრიქონი',   en: 'String'    } },
      { key: 'right', type: 'string',  label: { ka: 'ქვეტექსტი', en: 'Substring' } },
    ],
    example: '{ "op": "includes", "left": { "$row": "label" }, "right": "total" }',
  },

  // ── Lookup ────────────────────────────────────────────────────────────────────

  'get': {
    category: 'lookup',
    label:       { ka: 'ველის წაკითხვა', en: 'Get field' },
    description: { ka: 'წაიკითხავს ref-ის ობიექტიდან path-ის გასწვრივ არსებულ ველს (მაგ. "address.city").',
                   en: 'Reads a nested field at path from the object resolved by ref (e.g. "address.city").' },
    fields: [
      { key: 'ref',  type: 'exprVal', label: { ka: 'წყარო',  en: 'Source'     } },
      { key: 'path', type: 'string',  label: { ka: 'გზა',    en: 'Path'       } },
    ],
    example: '{ "op": "get", "ref": { "$ctx": "meta" }, "path": "label.ka" }',
  },

  'coalesce': {
    category: 'lookup',
    label:       { ka: 'პირველი არა-null', en: 'Coalesce' },
    description: { ka: 'აბრუნებს მნიშვნელობათა სიაში პირველ არა-null ელემენტს.',
                   en: 'Returns the first non-null value from the values array.' },
    fields: [
      { key: 'values', type: 'exprVal[]', label: { ka: 'მნიშვნელობები', en: 'Values' } },
    ],
    example: '{ "op": "coalesce", "values": [{ "$ctx": "region" }, { "$ctx": "geo" }, "WORLD"] }',
  },

  // ── Collection ────────────────────────────────────────────────────────────────

  'some': {
    category: 'collection',
    label:       { ka: 'მინიმუმ ერთი',  en: 'Some (any match)' },
    description: { ka: 'აბრუნებს true-ს, თუ სტრიქონების სიაში ერთ-ერთი მაინც პირობას აკმაყოფილებს. $row ხელმისაწვდომია expr-ში.',
                   en: 'Returns true when at least one row in the list satisfies expr. $row binds the current row inside expr.' },
    fields: [
      { key: 'list', type: 'list', label: { ka: 'სია',     en: 'List'      } },
      { key: 'expr', type: 'expr', label: { ka: 'პირობა', en: 'Predicate' } },
    ],
    example: '{ "op": "some", "list": { "$rows": true }, "expr": { "op": "gt", "left": { "$row": "value" }, "right": 0 } }',
  },

  'every': {
    category: 'collection',
    label:       { ka: 'ყველა',          en: 'Every (all match)' },
    description: { ka: 'აბრუნებს true-ს, თუ სტრიქონების სიაში ყველა ელემენტი პირობას აკმაყოფილებს.',
                   en: 'Returns true when every row in the list satisfies expr.' },
    fields: [
      { key: 'list', type: 'list', label: { ka: 'სია',     en: 'List'      } },
      { key: 'expr', type: 'expr', label: { ka: 'პირობა', en: 'Predicate' } },
    ],
    example: '{ "op": "every", "list": { "$rows": true }, "expr": { "op": "exists", "value": { "$row": "code" } } }',
  },

  'filter': {
    category: 'collection',
    label:       { ka: 'გაფილტვრა',     en: 'Filter' },
    description: { ka: 'აბრუნებს სიის ქვეჯგუფს, სადაც ყველა სტრიქონი პირობას აკმაყოფილებს.',
                   en: 'Returns the subset of rows in the list for which expr is true.' },
    fields: [
      { key: 'list', type: 'list', label: { ka: 'სია',     en: 'List'      } },
      { key: 'expr', type: 'expr', label: { ka: 'პირობა', en: 'Predicate' } },
    ],
    example: '{ "op": "filter", "list": { "$rows": true }, "expr": { "op": "ne", "left": { "$row": "code" }, "right": "total" } }',
  },

  'count': {
    category: 'collection',
    label:       { ka: 'რაოდენობა',     en: 'Count' },
    description: { ka: 'აბრუნებს სიაში სტრიქონების რაოდენობას.',
                   en: 'Returns the number of rows in the list.' },
    fields: [
      { key: 'list', type: 'list', label: { ka: 'სია', en: 'List' } },
    ],
    example: '{ "op": "count", "list": { "$rows": true } }',
  },

  'map': {
    category: 'collection',
    label:       { ka: 'გარდაქმნა',     en: 'Map' },
    description: { ka: 'გარდაქმნის სიის ყოველ სტრიქონს expr-ის შედეგად. $row ხელმისაწვდომია expr-ში.',
                   en: 'Transforms each row in the list to the value produced by expr. $row binds the current row inside expr.' },
    fields: [
      { key: 'list', type: 'list',    label: { ka: 'სია',            en: 'List'       } },
      { key: 'expr', type: 'exprVal', label: { ka: 'გარდამქმნელი', en: 'Transformer' } },
    ],
    example: '{ "op": "map", "list": { "$rows": true }, "expr": { "$row": "label" } }',
  },
}

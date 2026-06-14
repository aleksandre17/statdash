# geostat-chat-ai: Key Architectural Patterns

## 1. Hook-Based State (No Global Store)

`useChatSession` is the single source of truth for UI state:

```js
const [messages, setMessages] = useState([])
const [sessionId, setSessionId] = useState('')
const [showWelcome, setShowWelcome] = useState(true)

// Lifecycle methods (immutable mutations)
appendUserMessage(text) → {id, text, isBot: false, timestamp}
startBotStream(intro) → {id, text, isBot: true, streaming: true}
updateBotStream(id, text) → message.text = text
finalizeBotStream(id, finalData) → message.responseData = finalData, streaming: false
appendBotResponse(finalData) → standalone message
appendError() → error message
reset() → clear everything
```

**Why**: Decouples "what to render" (session) from "how to get data" (stream) and "what to measure" (feedback). Each concern is testable independently.

---

## 2. SSE Streaming with Reliability

**File**: `src/services/chatApi.js` — `sendChatMessage()`

### Protocol
```
GET /api/v1/chat/stream?message=...&sessionId=...&locale=...
  ↓ SSE stream
event: token
data: first chunk

event: token
data: of answer

event: complete
data: {"intro":"full answer","items":[...],"turnId":"..."}
```

### Error Handling
1. **Idle watchdog** (30s): No token → abort + `StreamTimeoutError`
2. **User abort** (new send, unmount): Resolves silently
3. **Stream transport failure** (mid-read):
   - Retry once after 500ms delay
   - If retry fails: fall back to blocking GET `/api/v1/chat`
4. **Stale turn protection**:
   - New send aborts prior AbortController
   - All `onToken`/`onComplete` callbacks check `controller.signal.aborted`
   - Prevents late callbacks from writing into stale closures

### Caller Integration (useChatStream)
```js
abortActive('user-abort')  // Cancel prior turn
controller = new AbortController()
sendChatMessageImpl({
  text, sessionId, locale,
  signal: controller.signal,
  onToken: (chunk) => {
    if (controller.signal.aborted) return
    // Only write state if not superseded
    session.startBotStream(chunk) or session.updateBotStream(...)
  },
  onComplete: (finalData) => {
    if (controller.signal.aborted) return
    session.finalizeBotStream(...)
  }
})
```

---

## 3. Lazy-Loaded Admin Routes

**File**: `src/app/adminSections.jsx` — single source of truth

```js
export const ADMIN_SECTIONS = [
  { path: 'curation', labelKey: 'admin.sections.curation', element: lazy$(<CurationAdmin />) },
  { path: 'runs', ..., element: lazy$(<PhasePlaceholder />) },
  // ... more sections
]

// App.jsx uses ADMIN_SECTIONS to build <Route> elements
// AdminLayout.jsx uses same list to build sidebar <NavLink> entries
// Benefit: no drift between routing and navigation
```

**Code-Splitting Effect** (vite.config.js):
```js
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-markdown': ['react-markdown', ...],  // chat only
  'vendor-motion': ['framer-motion'],          // chat animations
  'vendor-icons': ['lucide-react'],            // both
  // CurationAdmin lands in admin chunk (lazy-loaded)
}
```

**Result**: Public user downloads only public-chat chunks; admin code never included unless `/admin` visited.

---

## 4. Analytics Without State

`useRetrievalFeedback` tracks card impressions/clicks as refs, not state:

```js
const cardsRef = useRef(new Map())  // documentId → {rank, score, shownAt, wasClicked, dwellMs}
const queryRef = useRef('')
const flushedRef = useRef(true)

registerCards(finalData, queryText) {
  // Called when bot response completes
  cardsRef.current.clear()
  cardsRef.current.set(link.documentId, {...})
  flushedRef.current = false  // Mark dirty
}

onCardClick(documentId) {
  card.wasClicked = true
  card.dwellMs = now - card.shownAt
}

flush() {
  if (flushedRef.current) return  // Idempotent
  POST /api/v1/feedback/{sessionId} with cardsRef.current
  flushedRef.current = true
}
```

**Why**: Card tracking shouldn't trigger re-renders; it's pure side-effect data. Refs + callbacks suffice.

**Called at**:
- Next `sendMessage` (before appending new user message)
- Component unmount (via `useEffect(() => () => flush(), [flush])`)

---

## 5. Bilingual i18n with Lazy Loading

**File**: `src/i18n/LanguageContext.jsx`

```js
const LanguageProvider = ({ initialLang = 'ka', initialTranslations = {} }) => {
  const [lang, setLang] = useState(initialLang)
  const [cache, setCache] = useState(initialTranslations)

  // deepMerge(english_base, locale_override)
  const t = deepMerge(cache.en, cache[lang])

  toggleLang = async () => {
    const newLang = lang === 'ka' ? 'en' : 'ka'
    if (!cache[newLang]) {
      const fetched = await fetch(`/i18n/${newLang}.json`).then(r => r.json())
      setCache(prev => ({...prev, [newLang]: fetched}))
    }
    setLang(newLang)
  }
}
```

**Bootstrap** (src/main.jsx):
```js
const [enT, localeT] = await Promise.all([
  fetch('/i18n/en.json'),
  fetch(`/i18n/${lang}.json`) || null
])
createRoot(...).render(
  <LanguageProvider initialLang={lang} initialTranslations={{en: enT, [lang]: localeT ?? enT}} />
)
```

**Benefits**:
- No build-time extraction; all keys static
- English is fallback base; locale is override
- Missing translations don't crash (fall back to en)
- Toggle lang → lazy-fetch new locale on demand

---

## 6. Responsive Tiers (No Tailwind)

**CSS classes** in `src/chatTiers.css`:
```css
.chat-container.tier-xs { /* mobile */ }
.chat-container.tier-sm { /* tablet */ }
.chat-container.tier-md { /* laptop */ }
.chat-container.tier-lg { /* desktop */ }
```

**Hook** (`src/hooks/useChatSize.js`) detects viewport and returns `tier`.

**Component-level logic**:
```jsx
const isCompact = tier === 'xs' || tier === 'sm'
{!isCompact && <ExternalLink size={14} />}
{!isCompact && <span className="link-card-score">{score}%</span>}
```

**Why**: CSS variables + media queries don't know component state; a hook provides tier to JS logic.

---

## 7. Idempotent Mutations (State)

`useChatSession` uses functional setState to avoid race conditions:

```js
const appendUserMessage = (text) => {
  setMessages(prev => [...prev, {id, text, isBot: false, ...}])
  // ✓ Guaranteed to see previous state
}

const updateBotStream = (id, text) => {
  setMessages(prev =>
    prev.map(m => m.id === id ? {...m, text} : m)
    // ✓ Only touches target message
  )
}
```

All mutations are deterministic map/spread, no push/mutate.

---

## 8. Injection for Testability

Each service is injectable:

```js
useChatStream({
  session,
  lang,
  sendChatMessageImpl = sendChatMessage  // injectable
})

useRetrievalFeedback({
  sessionId,
  submitImpl = submitRetrievalFeedback  // injectable
})

useChatFeedback({
  turnId, sessionId,
  sendChatFeedbackImpl = sendChatFeedback  // injectable
})
```

**Tests** pass fake implementations that drive callbacks deterministically:
```js
const fakeSend = ({ onToken, onComplete }) => {
  onToken('first ')
  onToken('chunk ')
  onComplete({intro: 'full response', items: []})
}
useChatStream({session: mockSession, sendChatMessageImpl: fakeSend})
// Now test message state lifecycle without network
```

# geostat-chat-ai Architectural Study

## Overview
**geostat-chat-ai** is a full-stack RAG (Retrieval-Augmented Generation) chatbot platform for the Georgian National Statistics Office (Geostat). It enables semantic search over statistical content, integrating a React UI frontend with a Spring Boot microservice backend.

## What the App Does
- **Public Chat Interface**: Users ask questions about Georgian statistics in Georgian or English
- **RAG Pipeline**: 
  - Ingestion crawls Geostat portal, chunks content, embeds with dense vectors
  - Retrieval searches Qdrant vector DB and returns relevant statistical documents
  - Chat-API uses Gemini LLM with RAG context to generate natural language answers
  - Frontend displays bot responses with citation cards (links to retrieved sources)
- **Admin Curation Panel**: Operators manage ranking overrides (boost/demote/exclude documents, rename topics)
- **Analytics**: Tracks user interactions (card clicks, dwell time) and feedback (thumbs up/down)
- **Accessibility**: Bilingual (Georgian/English), responsive design, voice input/output via speech APIs

## Tech Stack

### Frontend (React 19, Vite 7)
- **Core**: React 19.2.0, React Router 6.30, React DOM 19.2
- **Build**: Vite 7.1.12 (JSX, code-splitting, dev server)
- **Styling**: Vanilla CSS with CSS variables (no Tailwind/emotion)
- **Rendering**:
  - `react-markdown` + `remark-gfm` (GitHub-flavored markdown)
  - `rehype-raw` + `rehype-sanitize` (HTML passthrough with XSS protection)
- **Animation**: Framer Motion 12.23
- **Icons**: Lucide React 0.548 (admin), SVG icons (public chat)
- **Speech**:
  - `MediaRecorder` API for voice input → WebM/Opus audio
  - Backend APIs: POST `/api/v1/speech/transcribe` (STT), POST `/api/v1/speech/synthesize` (TTS)
- **Testing**: Vitest 2.1.9 (jsdom environment), React Testing Library 16.3
- **Utilities**: `framer-motion`, TypeScript 5.9 (JSDoc annotations, no build-time transpilation)

### Backend (Spring Boot, Java)
- **Multi-service architecture**:
  - `chat-api` (port 8090): RAG orchestration, Gemini integration, feedback APIs
  - `retrieval-service` (port 8092): Vector search, Qdrant client
  - `ingestion-service` (port 8093): Web crawler, chunking, embedding, admin panel
- **Shared Contract Layer**: `platform-contracts` (DTOs, error types, interfaces)
- **Vector DB**: Qdrant (self-hosted)
- **Relational DB**: PostgreSQL (curation overrides, feedback, sessions)
- **LLM**: Google Gemini (chat completion + streaming)
- **Search**: Vector similarity (semantic) + keyword search
- **Security**: API key authentication (X-API-Key header) for admin/internal planes

### Ops & Infrastructure
- **Monorepo**:
  - `apps/frontend`, `apps/backend`, `apps/retrieval-service`, `apps/ingestion-service`
  - `libs/platform-contracts`, `libs/embedding-adapters`
  - `kits/geostat-kit/` (git submodule for deployment/ops)
- **Container**: Docker Compose (manifest-driven via `geostat.ops.json`)
- **Package Manager**: npm (workspaces)
- **Environment**: Local dev via `infra tunnel` (SSH tunnel to remote Postgres/Qdrant)

---

## Frontend Architecture

### Folder Structure
```
apps/frontend/src/
├── app/                 # Top-level routing & layout
│   ├── App.jsx          # Routes: /, /login, /admin/* (lazy-loaded)
│   ├── AdminLayout.jsx  # Admin chrome (header, sidebar nav)
│   ├── AdminLayout.css
│   ├── adminSections.jsx # Central registry of admin pages
│   └── RequireAuth.jsx   # Route guard for /admin
├── components/
│   ├── chat/
│   │   ├── ChatWidget.jsx       # Main public chat UI
│   │   ├── ChatMessage.jsx      # Renders bot/user messages, citations
│   │   ├── ChatInput.jsx        # Message input + send
│   │   ├── LinkCard.jsx         # Citation card (RAG link + snippet)
│   │   └── VoiceInputButton.jsx # Mic button for STT
│   └── admin/
│       ├── CurationAdmin.jsx     # CRUD for ranking overrides
│       ├── LoginPage.jsx         # API key login form
│       └── PhasePlaceholder.jsx  # Stubs for Phase-2 admin pages
├── hooks/
│   ├── useChatSession.js         # Message state (append, finalize, reset)
│   ├── useChatStream.js          # SSE streaming (token by token)
│   ├── useChatFeedback.js        # Per-turn thumbs up/down
│   ├── useChatSize.js            # Responsive breakpoint detection
│   └── useRetrievalFeedback.js   # Card click/dwell tracking
├── services/
│   ├── chatApi.js           # SSE streaming, fallback GET, feedback endpoints
│   ├── curationApi.js       # Admin CRUD (boost/demote/exclude/pin/rename)
│   ├── adminSession.js      # API key persistence (localStorage)
│   └── speechApi.js         # STT/TTS (transcribe + synthesize)
├── i18n/
│   └── LanguageContext.jsx  # Bilingual provider (ka/en, lazy-load JSON)
├── config/
│   ├── api.js              # API URLs (Vite env + runtime /config.json)
│   └── iconMap.js          # Geostat category icon resolver
├── generated/
│   ├── chat-api.d.ts       # Auto-gen OpenAPI types (chat endpoints)
│   ├── retrieval-service.d.ts
│   └── ingestion-service.d.ts
├── utils/
│   └── uuid.js             # crypto.randomUUID with fallback
├── test/
│   └── setup.js            # Vitest globals + mocks
├── index.css               # Global styles (CSS variables, layout)
├── chatTiers.css           # Responsive classes (tier-xs, tier-sm, tier-md, tier-lg)
├── main.jsx                # Bootstrap (load i18n, create root)
└── assets/
    └── logo.svg            # Geostat logo

vite.config.js             # Vendor code-splitting (react, markdown, motion, icons)
jsconfig.json              # Path alias: @ = ./src
package.json               # Dependencies + prebuild hooks
```

### Key Architectural Patterns

#### 1. **Hook-Based State Management (No Global Store)**
- **`useChatSession`**: Single source of truth for message list, sessionId, welcome state
  - Methods: `appendUserMessage`, `startBotStream`, `updateBotStream`, `finalizeBotStream`, `appendBotResponse`, `appendError`, `reset`
  - Returns immutable via `setMessages(prev => ...)`
- **`useChatStream`**: Owns SSE stream + AbortController
  - Decoupled from state — takes `session` as prop
  - Handles retry logic, idle timeout (30s), stream reconnect
  - Returns `isTyping`, `sendMessage`, `cancel`
- **Composition in `ChatWidget`**:
  ```jsx
  const session = useChatSession(...)
  const { registerCards, onCardClick, flush } = useRetrievalFeedback({ sessionId })
  const sessionWithFeedback = useMemo(() => ({...session, finalizeBotStream: wrappedFn}), ...)
  const { isTyping, sendMessage } = useChatStream({ session: sessionWithFeedback, lang })
  ```
  - Separates concerns: message state, streaming control, analytics signals

#### 2. **SSE Streaming with Reliability**
- **File**: `src/services/chatApi.js` — `sendChatMessage()`
- **Flow**:
  1. Open stream to `/api/v1/chat/stream?message=...&sessionId=...&locale=...`
  2. Parse SSE: `event: token | complete | error`
  3. Call `onToken(text)` per token → render streaming intro
  4. Call `onComplete(ChatResponse)` on `complete` event
  5. **Fallback**: If stream fails (404, disconnect), retry once, then GET `/api/v1/chat`
- **Reliability hardening**:
  - Idle watchdog: abort if no token for 30s (raises `StreamTimeoutError`)
  - `AbortSignal` composed from caller + internal idle controller
  - User-abort (new send, unmount) resolves silently; idle-timeout shows error
  - Stale turn protection: new send aborts prior, callbacks check `controller.signal.aborted`

#### 3. **Analytics Without Global State**
- **`useRetrievalFeedback`** (per ChatWidget):
  - Tracks card impressions + clicks + dwell time
  - `registerCards(finalData, queryText)` — records rank, score, visibility
  - `onCardClick(documentId)` — stamps click + dwell
  - `flush()` — POST to `/api/v1/feedback/{sessionId}` once per turn
  - Integrated into ChatWidget lifecycle: flush before new send, flush on unmount
- **`useChatFeedback`** (per ChatMessage):
  - Per-turn thumbs up/down
  - Idempotent: once `feedbackSent` is set, subsequent calls are no-ops

#### 4. **Bilingual i18n with Lazy Loading**
- **`LanguageContext.jsx`**:
  - Provider loads JSON from `/i18n/{ka,en}.json`
  - `deepMerge(en, locale)` → English as base, locale as override
  - Toggle lang → fetch missing file, cache in state, switch
  - No build-time extraction; all keys static, JSON-based

#### 5. **Lazy-Loaded Admin Routes**
- **`adminSections.jsx`** — single source of truth:
  ```js
  ADMIN_SECTIONS = [{
    path: 'curation',
    labelKey: 'admin.sections.curation',
    element: lazy$(<CurationAdmin />)  // loaded only on first visit
  }, ...]
  ```
- **`App.jsx`** maps to routes; `AdminLayout.jsx` maps to nav links
- **Benefit**: Public chat bundle never includes admin code (framer-motion, curation APIs)

#### 6. **Component Composition Over Props Drilling**
- **ChatWidget** wraps `useChatSession` + `useRetrievalFeedback` + `useChatStream`
- Passes `sessionWithFeedback` object to `useChatStream`
- Renders `ChatMessage` with deconstructed props (no nested drilling)
- Admin layout uses `<Outlet/>` for section content

---

## Data Flow

### Chat Turn (User → Bot)
1. **User types & sends**: `ChatInput` → `handleSend` → `ChatWidget.handleSendQuery`
2. **Session state**: `session.appendUserMessage(text)` → message added to state
3. **Streaming dispatch**: `useChatStream.sendMessage(text)`
   - Compose URL: `POST /api/v1/chat/stream?message=...&sessionId=...&locale=...`
   - Open SSE stream via `sendChatMessage()`
4. **First token arrives**:
   - `onToken` callback → `session.startBotStream(token)` → new message with `streaming: true`
   - User sees typing indicator + streaming text
5. **Subsequent tokens**: `updateBotStream(botMsgId, accumulatedText)` → re-render
6. **Complete event**:
   - `onComplete(ChatResponse)` → `session.finalizeBotStream(botMsgId, finalData)`
   - Message updated: `responseData` set, `streaming` cleared
   - `registerCards(finalData, queryText)` → track RAG items
7. **Error** (stream timeout/transport):
   - `session.appendError()` → error message added
   - No retry visible to user (handled inside `sendChatMessage`)

### Citation Cards
1. **Response arrives** with `items: [{link: {documentId, titleKa, titleEn, snippet, score, url, ...}, explanation}, ...]`
2. **`registerCards`** walks items, creates card records: `{documentId, rank, score, shownAt, dwellMs, wasClicked}`
3. **User clicks card**: `LinkCard` → `onCardClick(documentId)` → marks `wasClicked: true`, stamps dwell
4. **Next send or unmount**: `flush()` → POST `/api/v1/feedback/{sessionId}` with chunk list
5. **Server** ingests signals → boost/demote in next ranking

### Admin Curation
1. **Login**: `LoginPage` → `login(apiKey, identity)` → stored in localStorage
2. **Fetch overrides**: `CurationAdmin.loadOverrides()` → `GET /api/v1/admin/curation/overrides` (with X-API-Key)
3. **Create override**: Form → `createCurationOverride({url, action, target, reason, createdBy})` → POST
4. **Delete**: `deleteCurationOverride(id)` → DELETE

---

## Component Hierarchy

```
<App>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<ChatWidget />} />
      <Route path="/login" element={lazy(LoginPage)} />
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        {ADMIN_SECTIONS.map(section => (
          <Route path={section.path} element={section.element} />
        ))}
      </Route>
    </Routes>
  </BrowserRouter>
</App>

<ChatWidget>
  ├─ header + logo + lang switcher + status
  ├─ .chat-messages
  │  ├─ welcome banner (if first load)
  │  ├─ {messages.map(msg => <ChatMessage />)}
  │  │  ├─ message-avatar (bot/user)
  │  │  ├─ message-content
  │  │  │  ├─ (bot) grounded badge + ReactMarkdown(responseData.intro)
  │  │  │  ├─ (bot) .link-cards
  │  │  │  │  ├─ link-cards-header (topic icon)
  │  │  │  │  ├─ secondary-topics (if >1 topic)
  │  │  │  │  └─ {items.map(item => <LinkCard />)}
  │  │  │  ├─ (bot) chat-feedback (thumbs up/down)
  │  │  │  └─ (user) <p>{message.text}</p>
  │  │  └─ motion.div (framer-motion entry anim)
  │  └─ typing-indicator (if isTyping)
  └─ <ChatInput />
     ├─ textarea + <VoiceInputButton />
     └─ send button
```

---

## HTTP APIs (OpenAPI-Generated)

### Chat Endpoints
- **GET /api/v1/chat** (params: message, sessionId, locale)
  - Blocking chat turn → JSON `ChatResponse`
- **GET /api/v1/chat/stream** (params: message, sessionId, locale)
  - SSE stream → `event: token` (text) → `event: complete` (JSON)
- **POST /api/v1/chat/feedback** (body: {turnId, sessionId, rating})
  - Thumbs up/down → 202 Accepted
- **POST /api/v1/feedback/{sessionId}** (body: {queryText, language, chunks})
  - Card impressions + clicks → fire-and-forget

### Speech Endpoints
- **POST /api/v1/speech/transcribe** (multipart: file, language)
  - WebM audio → JSON `TranscriptionResponse` → text
- **POST /api/v1/speech/synthesize** (body: {text, language})
  - Text → audio/mp3 Blob

### Admin/Curation Endpoints (X-API-Key required)
- **GET /api/v1/admin/curation/overrides**
- **POST /api/v1/admin/curation/overrides** (body: `CreateCurationOverrideRequest`)
- **DELETE /api/v1/admin/curation/overrides/{id}`

---

## Testing Strategy

### Unit Tests (Vitest + RTL)
- **`useChatSession.test.js`**: Lifecycle (append, stream, finalize, reset)
- **`useChatStream.test.js`**: Injects `sendChatMessageImpl` for deterministic SSE
- **`useRetrievalFeedback.test.js`**: Click/dwell tracking, flush idempotency
- **`useChatFeedback.test.js`**: Per-turn feedback idempotency
- **Component tests**: `ChatMessage.test.jsx`, `ChatInput.test.jsx`, `LinkCard.test.jsx`

### Manual E2E
- Local dev: `npm run dev` → Vite server
- Backend: `./tools/geostat.ps1 infra tunnel` + Docker Compose
- Test flow: send message → stream tokens → complete → feedback → card click

---

## Build & Deployment

### Development
```bash
npm run dev                 # Vite dev server (HMR)
npm run typecheck          # JSDoc tsc check
npm run lint:i18n          # Check missing translations
npm run generate:api       # Fetch OpenAPI snapshots, gen types
npm test                   # Vitest (pretest runs generate:api)
```

### Production
```bash
npm run build              # Vite build (prebuild: generate:api + typecheck + lint:i18n)
# Output: dist/ (HTML + JS bundles + assets)
```

### Code-Splitting Strategy (vite.config.js)
- **vendor-react**: React + router (always loaded)
- **vendor-markdown**: react-markdown + remark/rehype (chat only, not in admin)
- **vendor-motion**: framer-motion (animations)
- **vendor-icons**: lucide-react (icons)
- **admin chunk**: CurationAdmin, LoginPage (lazy-loaded on /admin visit)
- **main chunk**: ChatWidget (public chat)

**Result**: Public user only downloads React + chat vendor chunks; admin code never included unless visited.

---

## Security Considerations

### XSS Protection
- **Markdown sanitization**: `rehype-sanitize` with tight schema
  - Allows GFM tables, drops `<script>/<style>/<iframe>`
  - Custom `safeHref()` rejects `javascript:`, `data:`, relative links
- **Content Security Policy**: Recommended (not in current codebase but noted for deployment)

### CORS
- **Credentials enabled** only with explicit allowlist (never `*` with credentials)
- Set via `GEOSTAT_CORS_ALLOWED_ORIGIN_PATTERNS`

### API Key Auth
- **Admin plane** (`/api/v1/admin/*`): X-API-Key header
- Stored in localStorage on client; server validates every request
- Keys live in `ops/config/*/.env*` (gitignored)

### Session Security
- **sessionId** is opaque (server-generated UUID)
- Used to correlate feedback + chat context
- No secrets transmitted in URLs (only sessionId)

---

## Performance Optimizations

1. **Lazy component loading**: Admin routes split from public chat
2. **Code-splitting by domain**: vendor chunks separate from app
3. **Streaming**: Token-by-token rendering for perceived speed
4. **Virtual scrolling**: Not implemented (could add for long chats)
5. **Image optimization**: SVG icons (vector, scalable)
6. **Responsive design**: CSS media queries (tier-xs, tier-sm, tier-md, tier-lg)
7. **Memoization**: `useMemo` for `sessionWithFeedback` in ChatWidget

---

## Known Limitations & Future Work

1. **No offline support**: Chat requires API
2. **No persistent chat history UI**: Session-based, no retrieval of past turns
3. **TTS/STT**: Optional features, tied to backend availability
4. **Mobile-first responsive**: Working but could refine UX for xs viewports
5. **Phase-2 admin pages**: Stub placeholders for runs, quality, topics, feedback, retrieval-explain

---

## Integration Notes (for statdash-platform)

### Reusable Patterns
1. **Hook-based state** without Redux (useChatSession pattern)
2. **SSE streaming controller** with reliability (sendChatMessage pattern)
3. **Lazy route splitting** via adminSections registry
4. **i18n via Context** + JSON-based translations
5. **Analytics hook** decoupled from UI (useRetrievalFeedback pattern)

### API Contract
- OpenAPI types auto-generated from backend specs
- Response DTOs: `ChatResponse`, `ChatRequest`, `ChatFeedbackRequest`
- All endpoints follow `/api/v1/{service}/{resource}` pattern

### Styling
- CSS variables for theming (no Tailwind/CSS-in-JS)
- Responsive breakpoints via tier classes
- Geostat brand colors baked in

---

## Files Read
- `package.json` — deps + build config
- `vite.config.js` — code-splitting strategy
- `jsconfig.json` — path alias config
- `src/main.jsx` — app bootstrap + i18n loading
- `src/app/App.jsx` — routing
- `src/app/AdminLayout.jsx` — admin shell
- `src/app/adminSections.jsx` — admin registry
- `src/app/RequireAuth.jsx` — route guard
- `src/components/chat/ChatWidget.jsx` — main chat UI
- `src/components/chat/ChatMessage.jsx` — message render + feedback
- `src/components/chat/ChatInput.jsx` — input + send
- `src/components/chat/LinkCard.jsx` — citation card
- `src/components/admin/CurationAdmin.jsx` — curation CRUD
- `src/components/admin/LoginPage.jsx` — login form
- `src/hooks/useChatSession.js` — message state
- `src/hooks/useChatStream.js` — SSE streaming
- `src/hooks/useChatFeedback.js` — thumbs up/down
- `src/hooks/useRetrievalFeedback.js` — card tracking
- `src/services/chatApi.js` — SSE + fallback + feedback
- `src/services/curationApi.js` — admin CRUD
- `src/services/adminSession.js` — API key persistence
- `src/services/speechApi.js` — STT/TTS
- `src/i18n/LanguageContext.jsx` — bilingual provider
- `src/config/api.js` — API URLs
- `src/index.css` — global styles
- `src/generated/chat-api.d.ts` — API types
- `README.md` — project overview

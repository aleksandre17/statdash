# geostat-chat-ai: Architectural Overview

**geostat-chat-ai** is a full-stack RAG (Retrieval-Augmented Generation) chatbot for the Georgian National Statistics Office (Geostat). It enables semantic search over statistical content using a React frontend + Spring Boot microservices backend.

## What It Does
- **Public Chat**: Users ask questions about Georgian statistics in Georgian/English
- **RAG Pipeline**: Ingestion → Vector search (Qdrant) → LLM generation (Gemini) → Citations
- **Admin Panel**: Operators manage ranking overrides (boost/demote/exclude documents)
- **Analytics**: Tracks card clicks, dwell time, user feedback (thumbs up/down)
- **Accessibility**: Bilingual, responsive, voice input/output (STT/TTS)

## Tech Stack at a Glance

### Frontend
- **Core**: React 19.2, React Router 6.30, Vite 7.1
- **Styling**: Vanilla CSS with variables (Geostat brand colors)
- **Rendering**: `react-markdown` + `remark-gfm` + `rehype-sanitize` (XSS protected)
- **Animation**: Framer Motion 12.23
- **Icons**: Lucide React 0.548, SVG category icons
- **Testing**: Vitest 2.1, React Testing Library 16.3
- **i18n**: Context API + JSON (ka/en)
- **Build**: No TypeScript transpilation; JSDoc for static checking

### Backend
- **Chat API** (8090): SSE streaming, Gemini integration, feedback APIs
- **Retrieval Service** (8092): Vector search (Qdrant), semantic ranking
- **Ingestion Service** (8093): Web crawler, chunking, embedding, admin APIs
- **Shared Contracts**: Platform DTOs, error types
- **DB**: PostgreSQL (curation, feedback), Qdrant (vectors)
- **LLM**: Google Gemini

### Ops
- Monorepo (npm workspaces)
- Docker Compose (manifest-driven `geostat.ops.json`)
- `geostat-kit` submodule (deployment, infra tunnel)

## Folder Organization

```
apps/frontend/src/
├── app/              # Routing & layout
├── components/       # UI (chat, admin)
├── hooks/            # State & logic (useChatSession, useChatStream, etc.)
├── services/         # API clients (chatApi, curationApi, speechApi)
├── i18n/             # Bilingual provider
├── config/           # API URLs, icon mapping
├── generated/        # Auto-gen OpenAPI types
├── utils/            # UUID helper
└── index.css         # Global styles + variables
```

## Key Architectural Patterns
1. **Hook-based state** (no Redux): `useChatSession`, `useChatStream`, `useRetrievalFeedback`
2. **SSE streaming** with reliability: Fallback to blocking GET, idle timeout, reconnect
3. **Lazy-loaded admin routes**: Public chat never downloads admin code
4. **Analytics decoupled from UI**: `useRetrievalFeedback` tracks card signals independently
5. **Bilingual i18n**: LanguageContext + lazy-load JSON per language

## Critical Files Read
- `package.json` — dependencies, build scripts
- `vite.config.js` — code-splitting (vendor chunks separate from app)
- `src/main.jsx` — bootstrap, i18n loading
- `src/app/App.jsx` — routing structure
- `src/components/chat/ChatWidget.jsx` — main public UI
- `src/hooks/useChatSession.js` — message state lifecycle
- `src/hooks/useChatStream.js` — SSE streaming + error handling
- `src/services/chatApi.js` — streaming protocol + fallback
- `README.md` — project vision

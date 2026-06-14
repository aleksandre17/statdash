# geostat-chat-ai: Data Flow & Component Hierarchy

## Chat Turn Lifecycle

### User Message → Bot Response
1. **User sends**: `ChatInput.handleSend()` → `ChatWidget.handleSendQuery(text)`
2. **Add to session**: `session.appendUserMessage(text)` → message added to state
3. **Flush prior signals**: `useRetrievalFeedback.flush()` (from previous turn's card clicks)
4. **Capture query**: `lastQueryRef.current = text` (for card signal payload)
5. **Start stream**: `useChatStream.sendMessage(text)`
   - Opens SSE: `GET /api/v1/chat/stream?message=...&sessionId=...&locale=...`
   - Spins up idle watchdog (30s timeout)

### Token Streaming
6. **First token**: `onToken(text)` → `session.startBotStream(streamingIntro)` → new message created
   - User sees typing indicator + first chunk of answer
7. **Subsequent tokens**: `updateBotStream(botMsgId, accumulatedText)` → message text updated
   - Streaming text accumulates in real-time

### Completion
8. **Complete event**: `onComplete(ChatResponse)` → `session.finalizeBotStream(botMsgId, finalData)`
   - Message finalized: `responseData` set, `streaming` cleared
   - Extract `finalData.items` (RAG citations), `finalData.intro` (complete answer)
9. **Register cards**: `registerCards(finalData, lastQueryRef.current)` → card impressions tracked
10. **Render**:
    - `ChatMessage` renders `finalData.intro` as markdown (sanitized)
    - `LinkCard` components for each item with snippet, score, icon
    - Feedback buttons (thumbs up/down)

### Error Path
- **Idle timeout**: No token for 30s → `StreamTimeoutError` → `session.appendError()`
- **Fallback GET**: Stream fails → retry once, then GET `/api/v1/chat` (blocking)
- **User abort**: New send or unmount → silent abort (no error shown)

---

## Citation Card Analytics

### Impression (Per Turn)
- `registerCards(finalData, queryText)` called when response completes
- For each item with `documentId`:
  ```js
  {
    documentId,      // RAG document ID
    rank: i,         // Position in result set
    score: relevance,// Vector similarity (0-1)
    shownAt: now,    // Timestamp
    dwellMs: 0,      // Updated on click
    wasClicked: false,
    wasShown: true
  }
  ```

### Click Event
- User clicks card → `LinkCard.onClick` → `onCardClick(documentId)`
- `useRetrievalFeedback.onCardClick()`:
  ```js
  wasClicked: true
  dwellMs: Date.now() - card.shownAt  // milliseconds from impression to click
  ```

### Flush (On Next Send or Unmount)
- `flush()` sends POST `/api/v1/feedback/{sessionId}`:
  ```json
  {
    "queryText": "2024 population growth",
    "language": "ka",
    "chunks": [
      {
        "documentId": "doc-123",
        "rank": 0,
        "score": 0.89,
        "wasShown": true,
        "wasClicked": true,
        "dwellMs": 2500
      }
    ]
  }
  ```
- Idempotent: once flushed, `flushedRef` prevents double-fire
- Fire-and-forget: failures swallowed

---

## Per-Turn Feedback

- `ChatMessage` renders thumbs up/down (if `responseData.turnId` present)
- `useChatFeedback` manages per-message state
- On click: POST `/api/v1/chat/feedback` → `{turnId, sessionId, rating: 'up'|'down'}`
- Response: 200 OK or 202 Accepted
- Once sent, button disabled + "Thanks for feedback" message

---

## Component Tree

```
<App>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<ChatWidget />} />
      <Route path="/login" element={lazy(LoginPage)} />
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        {ADMIN_SECTIONS.map(s => <Route path={s.path} element={s.element} />)}
      </Route>
    </Routes>
  </BrowserRouter>

<ChatWidget>
  header (logo, lang switch, status, new conversation btn)
  .chat-messages
    [welcome banner if first load]
    {messages.map(msg => (
      <motion.div className="message model|user">
        .message-avatar
        .message-content-wrapper
          .message-content
            [bot: grounded badge, ReactMarkdown, link-cards, feedback buttons]
            [user: plain text]
    ))}
    [typing indicator if isTyping]
  <ChatInput />
    textarea + voice button
    send button

<AdminLayout>
  header (back link)
  .admin-body
    nav.admin-nav
      {ADMIN_SECTIONS.map(s => <NavLink />)}
    main
      <Outlet />  ← matched admin section element

<CurationAdmin>
  title + budget gauge
  error banner
  [add override, refresh buttons]
  [form: url, action dropdown, target, reason]
  [override list: delete button per item]
```

---

## State Management Architecture

No Redux/Zustand. All state via hooks:

| Hook | Scope | State |
|------|-------|-------|
| `useChatSession` | ChatWidget level | messages[], sessionId, showWelcome |
| `useChatStream` | ChatWidget level | isTyping |
| `useRetrievalFeedback` | ChatWidget level | card impressions + clicks (refs) |
| `useChatFeedback` | Per ChatMessage | feedbackSent |
| `LanguageContext` | App level | lang, translations cache |
| `useAdminSession` | Global (localStorage) | API key, identity |

**Composition in ChatWidget**:
```js
const session = useChatSession(...)
const { registerCards, onCardClick, flush } = useRetrievalFeedback({ sessionId })
const sessionWithFeedback = useMemo(() => ({
  ...session,
  finalizeBotStream: (id, data) => {
    session.finalizeBotStream(id, data)
    registerCards(data, lastQueryRef.current)
  },
  appendBotResponse: (data) => {
    session.appendBotResponse(data)
    registerCards(data, lastQueryRef.current)
  }
}), [session, registerCards])
const { isTyping, sendMessage } = useChatStream({ session: sessionWithFeedback, lang })
```

Decoupling achieved: message state, streaming, analytics are independent units composed at the widget level.

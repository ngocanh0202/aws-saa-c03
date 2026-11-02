# Gemini Chat in Practice Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in users doing a Practice attempt can open a multi-turn Gemini chat per question; the prompt carries the question, displayed options and correct answer; history is saved per user in Firebase.

**Architecture:** Pure pieces (prompt builder, history trimming, Markdown renderer) live in `src/ai/` and `src/components/`. Firebase SDK access stays in adapters: `src/ai/gemini.ts` (only importer of `firebase/ai`) and `src/sync/firebase.ts` (DB history store + optional App Check). UI reads `ai`/`chats` from `AppDeps` and the signed-in user from `sync`.

**Tech Stack:** React + TypeScript + Vitest, `firebase@^13` (`firebase/ai`, `firebase/app-check`, `firebase/database`).

**Spec:** `docs/superpowers/specs/2026-11-02-gemini-chat-design.md`

## Global Constraints

- Button only when `attempt.mode === 'practice'` AND `deps.ai` AND `deps.chats` AND sync state is `loading | conflict | synced` (has `user`). Never in real mode, ResultPage, External, QuestionViewPage.
- `markGuideOpened(attempt, qid)` is called when the **first streamed chunk** of a reply arrives (idempotent); opening the popup or a send that fails before any chunk does not mark. Asking Gemini does not open the written guide.
- Options in the prompt use display order and labels from `displayLabel(i)` over `aq.optionOrder`; nothing display-labelled is stored except inside chat text.
- History path `users/{uid}/aiChats/{attemptId}/{qid}`, value `{ json: string, updatedAt: number }`, `json` = `JSON.stringify(ChatMessage[])`, rule: `json` string `< 200000` chars, `updatedAt` number. Saved after each complete reply only.
- Model gets at most the **40** most recent history messages; UI shows all.
- Model name: `import.meta.env.VITE_GEMINI_MODEL` or default `'gemini-2.5-flash'` (implementer: if Firebase AI Logic docs list a newer stable Flash, use it and note it in the report). Backend `GoogleAIBackend`.
- App Check only when `VITE_RECAPTCHA_SITE_KEY` is set (`ReCaptchaEnterpriseProvider`, auto refresh on).
- Only `src/ai/gemini.ts` imports `firebase/ai`; only `src/sync/firebase.ts` imports other Firebase SDK modules; only `main.tsx` imports either adapter.
- UI copy is Vietnamese; button `aria-label="Hỏi Gemini"`. Model output rendered as safe Markdown (no raw HTML / `dangerouslySetInnerHTML`).
- System prompt instructs: Vietnamese answers keeping AWS terms in English, focus exactly on the user's question, concise, say when info may be outdated, never invent services or numbers.

## Review Focus

1. Stream fails after some chunks: partial reply stays, Vietnamese error shows, turn is not saved, question is still marked — Task 4 test.
2. History load rejects: error notice, chat still usable starting from empty — Task 4 test.
3. Whitespace-only message: not sent — Task 4 test.
4. User signs out while the popup is open: popup closes and button disappears — Task 4 test.
5. Send while a reply is streaming: blocked (button disabled) — Task 4 test.

---

### Task 1: Pure AI layer — types, prompt, history trimming

**Files:**
- Create: `src/ai/types.ts`, `src/ai/prompt.ts`, `src/ai/prompt.test.ts`, `src/data/html-text.ts`
- Modify: `scripts/lib/parse-main.ts` (move `htmlToText` to `src/data/html-text.ts`, re-export it from parse-main so scripts/tests keep importing it unchanged)

**Interfaces:**
- Produces (`src/ai/types.ts`):
  ```ts
  export interface ChatMessage { role: 'user' | 'model'; text: string }
  export interface AiChat { send(text: string): AsyncIterable<string> }
  export interface AiClient { startChat(systemPrompt: string, history: ChatMessage[]): AiChat }
  export interface ChatHistoryStore {
    load(uid: string, attemptId: string, qid: number): Promise<ChatMessage[]>;
    save(uid: string, attemptId: string, qid: number, messages: ChatMessage[]): Promise<void>;
  }
  ```
- Produces (`src/ai/prompt.ts`): `buildSystemPrompt(question: Question, order: string[]): string`, `trimHistory(messages: ChatMessage[], max = 40): ChatMessage[]`, `export const HISTORY_LIMIT = 40`.
- Produces (`src/data/html-text.ts`): `htmlToText(html: string): string` (same body as today's).

- [ ] **Step 1: Write failing tests** in `src/ai/prompt.test.ts`:
  - `dùng nhãn theo thứ tự hiển thị`: question options A..D, answer `['B']`, order `['C','A','B','D']` → prompt contains `A. <text of C>` and `C. <text of B>`, and a line `Đáp án đúng: C`.
  - `câu nhiều đáp án liệt kê đủ nhãn`: answer `['A','D']`, order `['D','C','B','A']` → `Đáp án đúng: A, D`.
  - `câu main chuyển HTML sang chữ`: `makeMainQuestion(10101)` → prompt contains `Main stem 10101`, contains no `<p>`.
  - `có chỉ dẫn trả lời tiếng Việt`: prompt contains `tiếng Việt`.
  - `trimHistory giữ 40 tin gần nhất`: 45 messages → length 40, first is message #6; 3 messages → unchanged.
- [ ] **Step 2:** `npx vitest run src/ai/prompt.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement. Prompt sections (Vietnamese): role (trợ giảng luyện thi AWS SAA-C03), stem + prompt text (`htmlToText` when `question.html`), options `X. text` one per line, `Đáp án đúng: …`, the instruction list from Global Constraints.
- [ ] **Step 4:** `npm run check` → PASS (parse-main tests still green).
- [ ] **Step 5: Commit** `feat(ai): prompt builder and chat types`.

### Task 2: Firebase adapters, config, rules, wiring

**Files:**
- Create: `src/ai/gemini.ts`, `src/test/fake-ai.ts`
- Modify: `src/sync/config.ts`, `src/sync/config.test.ts`, `src/sync/firebase.ts`, `src/app/context.tsx`, `src/main.tsx`, `database.rules.json`, `.env.example`, `docs/firebase-setup.md`, `CLAUDE.md` (one bullet under Kiến trúc for `src/ai/`)

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `FirebaseConfig` gains optional `recaptchaSiteKey?: string` and `geminiModel?: string` (from `VITE_RECAPTCHA_SITE_KEY`, `VITE_GEMINI_MODEL`; empty → undefined; their absence never makes `readFirebaseConfig` return null).
  - `createFirebaseClients(config)` returns `{ auth, remote, chats: ChatHistoryStore, app: FirebaseApp }`; initializes App Check right after `initializeApp` when `recaptchaSiteKey` is set.
  - `createGeminiClient(app: FirebaseApp, model: string): AiClient` in `src/ai/gemini.ts`: `getAI(app, { backend: new GoogleAIBackend() })`, `getGenerativeModel`, `startChat({ systemInstruction, history: trimHistory(history).map(m => ({ role: m.role, parts: [{ text: m.text }] })) })`, `send` yields `chunk.text()` from `sendMessageStream(text).stream`.
  - `AppDeps` gains `ai?: AiClient; chats?: ChatHistoryStore` (doc comment: chỉ có khi cấu hình Firebase).
  - `src/test/fake-ai.ts`: `fakeAi(): AiClient & { calls: { systemPrompt: string; history: ChatMessage[]; sent: string[] }[]; reply: string[] | Error; failAfter?: number }` — `send` yields `reply` chunks; if `reply` is an Error throws before first chunk; if `failAfter` = n, throws after n chunks. `fakeChats(initial?: Record<string, ChatMessage[]>): ChatHistoryStore & { saved: { key: string; messages: ChatMessage[] }[]; loadError?: Error }`, key `${uid}/${attemptId}/${qid}`.

- [ ] **Step 1: Write failing tests** in `config.test.ts`: `đọc VITE_RECAPTCHA_SITE_KEY và VITE_GEMINI_MODEL khi có`; `thiếu hai biến này vẫn trả cấu hình, trường là undefined`.
- [ ] **Step 2:** `npx vitest run src/sync/config.test.ts` → FAIL.
- [ ] **Step 3:** Implement config, adapters, fakes, `AppDeps`, `main.tsx` (`ai: clients ? createGeminiClient(clients.app, config.geminiModel ?? 'gemini-2.5-flash') : undefined`, `chats: clients?.chats`). `chats` in firebase.ts: `get`/`set` on the path from Global Constraints; `load` returns `[]` when missing and drops malformed JSON (returns `[]`).
- [ ] **Step 4:** `database.rules.json`: under `$uid`, add `"aiChats": { "$attemptId": { "$qid": { ".validate": "newData.hasChildren(['json', 'updatedAt']) && newData.child('json').isString() && newData.child('json').val().length < 200000 && newData.child('updatedAt').isNumber()" } } }`. Docs: enable Firebase AI Logic (Gemini Developer API) in console, deploy rules, optional App Check with reCAPTCHA Enterprise key; `.env.example` adds both variables with comments.
- [ ] **Step 5:** `npm run check` and `npm run build` → PASS.
- [ ] **Step 6: Commit** `feat(ai): Firebase AI Logic adapter and chat history store`.

### Task 3: Safe Markdown renderer

**Files:**
- Create: `src/components/Markdown.tsx`, `src/components/Markdown.test.tsx`

**Interfaces:**
- Produces: `Markdown({ text }: { text: string }): JSX.Element` — React elements only.

Supported: paragraphs (blank-line separated), `**bold**`, `` `inline code` ``, fenced ``` code blocks → `<pre><code>`, `- `/`* ` bullet lists, `1. ` numbered lists, `#`–`###` headings → `<strong>` paragraph. Anything else is plain text (HTML tags appear literally).

- [ ] **Step 1: Write failing tests**: `in đậm` (`**S3**` → `<strong>S3</strong>`); `danh sách` (`- a\n- b` → 2 `li`); `khối code` (fenced JSON → `pre` with text); `không render HTML` (`<img src=x onerror=alert(1)>` → no `img` element, text visible); `chữ đang stream dở` (`**abc` without closing → text `**abc` shown, no crash).
- [ ] **Step 2:** `npx vitest run src/components/Markdown.test.tsx` → FAIL.
- [ ] **Step 3:** Implement (no new dependency).
- [ ] **Step 4:** test file PASS, `npm run check` PASS.
- [ ] **Step 5: Commit** `feat(ui): minimal safe Markdown renderer`.

### Task 4: Gemini button + chat popup in Practice

**Files:**
- Create: `src/components/GeminiChat.tsx` (button + modal), `src/components/GeminiChat.test.tsx`
- Modify: `src/pages/ExamPage.tsx`, `src/styles.css`, `src/test/fixtures.tsx` (only if helpers needed)

**Interfaces:**
- Consumes: `AiClient`, `ChatHistoryStore`, `ChatMessage`, `buildSystemPrompt` (Task 1); `fakeAi`, `fakeChats` (Task 2); `Markdown` (Task 3); `fakeAuth`/fake sync from `src/test/fake-sync.ts`.
- Produces: `GeminiButton({ attemptId, number, question, order, onFirstReply }: { attemptId: string; number: number; question: Question; order: string[]; onFirstReply: () => void })` — renders nothing unless `ai`, `chats` and a signed-in user exist (helper `signedInUser(state: SyncState): SyncUser | null` exported from the same file). ExamPage renders it in practice mode for the current question, always (whether or not the guide is revealed), next to the guide button/panel, with `onFirstReply={() => update(markGuideOpened(attempt, aq.qid))}` (use the latest attempt).

Behavior: button with inline Gemini SVG icon, `aria-label="Hỏi Gemini"`. Click → full-screen dialog (pattern of `ServiceModal`: `role="dialog"`, Esc/close button, body scroll lock) titled `Hỏi Gemini · Câu {n}` (n = `number`, 1-based position in the attempt); shows the first ~80 chars of the stem text. On open: `chats.load(uid, attemptId, qid)` → show messages; on failure show `Không tải được lịch sử trò chuyện.` and continue with `[]`. Send: trim; empty → ignore; append user message, `ai.startChat(buildSystemPrompt(...), history)` (one chat per open popup, history = messages before this send), stream chunks into a model message; first chunk → `onFirstReply()`; on completion `chats.save(uid, attemptId, qid, allMessages)`; on error show `Gemini chưa trả lời được, thử gửi lại nhé.` and do not save; input and send disabled while streaming. Sign-out while open → dialog unmounts (button returns null).

- [ ] **Step 1: Write failing tests** in `GeminiChat.test.tsx` (render through `renderApp('#/exam/…')` or directly with `AppProvider` + deps containing `fakeAi`, `fakeChats`, and a sync controller in `synced` state from fake-sync):
  - `ẩn khi chưa đăng nhập` / `ẩn khi không có ai` / `ẩn ở Thi thật` (ExamPage real attempt) → no `Hỏi Gemini` button.
  - `hiện ở Thi thử khi đã đăng nhập` → button present.
  - `gửi câu hỏi: prompt có đề + đáp án, câu trả lời stream hiện ra` → reply chunks `['Vì ', 'S3']` → text `Vì S3` visible; `calls[0].systemPrompt` contains `Đáp án đúng:`; `calls[0].sent` = `['Tại sao?']`.
  - `câu được gắn nhãn khi có chữ đầu tiên` → after reply, stored attempt `guideOpened` contains qid; only opening popup → not contained.
  - `lỗi trước chữ đầu tiên không gắn nhãn` → reply Error → error text visible, `guideOpened` not containing qid, `saved` empty.
  - `lỗi giữa chừng giữ chữ đã nhận` → reply `['Một ', 'hai']`, `failAfter: 1` → `Một` visible, error visible, `saved` empty, qid marked.
  - `lưu lịch sử sau mỗi lượt` → `saved[0]` = `{ key: 'u1/<attemptId>/<qid>', messages: [{role:'user',text:'Tại sao?'},{role:'model',text:'Vì S3'}] }`.
  - `mở lại thấy lịch sử cũ và gửi kèm cho model` → `fakeChats({ 'u1/<id>/<qid>': [user,model] })` → old texts visible; next send → `calls[0].history` length 2.
  - `lỗi tải lịch sử vẫn chat được` → `loadError` → notice visible, send works.
  - `bỏ qua tin nhắn rỗng` → type `'   '`, send → `calls` empty.
  - `không gửi khi đang trả lời` → while streaming (deferred fake), send button disabled.
  - `đăng xuất thì đóng popup` → emit `null` user → dialog gone.
- [ ] **Step 2:** `npx vitest run src/components/GeminiChat.test.tsx` → FAIL.
- [ ] **Step 3:** Implement component, ExamPage wiring, CSS (reuse modal/dialog tokens; messages: user right-aligned, model left; works at phone width).
- [ ] **Step 4:** `npm run check` → PASS; `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(ui): ask Gemini about a question in practice mode`.

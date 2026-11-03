# Gemini: tìm lại câu đã làm + mở lại cuộc trò chuyện cũ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho Gemini một tool tìm lại câu người học đã trả lời trong cùng đề, và cho khung chat mở lại các cuộc trò chuyện cũ.

**Architecture:** Hàm tìm thuần `searchAnswered` (`src/ai/search.ts`) chạy trên `AttemptStore` + `Bank`; một vòng function-calling thuần (`src/ai/tool-loop.ts`) mà adapter `gemini.ts` dùng, nên test được không cần mạng. `ChatHistoryStore` có thêm `list()`; `GeminiChat.tsx` có màn danh sách (bố cục A) và chuyển cuộc trò chuyện trong cùng khung.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library, `firebase@13.1.0` (`firebase/ai`, `firebase/database`).

**Spec:** [docs/superpowers/specs/2026-11-03-gemini-tools-design.md](../specs/2026-11-03-gemini-tools-design.md) (bổ sung cho [2026-11-02-gemini-chat-design.md](../specs/2026-11-02-gemini-chat-design.md)).

## Global Constraints

- Chỉ `src/ai/gemini.ts` import `firebase/ai`; chỉ `src/sync/firebase.ts` import `firebase/database`. Test không gọi mạng (dùng `src/test/fake-ai.ts`).
- Phạm vi tool: lượt có cùng `setId` với lượt của cuộc trò chuyện, `status !== 'incompatible'`, **bỏ lượt `mode === 'real'` còn `in-progress`**, chỉ câu có `answers[qid].length > 0`.
- Không tìm thấy: Gemini trả lời đúng câu **"Bạn chưa làm câu nào như vậy trong đề này."**
- Kết quả tool không dùng nhãn A/B/C; lựa chọn là chữ (HTML → `htmlToText`).
- Tối đa **5** câu mỗi lần tìm; tối đa **3** vòng gọi tool mỗi tin nhắn.
- Dòng chờ khi gọi tool: **"Gemini đang tìm trong các câu bạn đã làm…"**
- Câu tool trả về thuộc lượt **Thi thử chưa nộp** → `markGuideOpened` ở đúng lượt đó (lấy bản mới nhất `store.get`, rồi `store.save`). Lượt đã nộp không sửa.
- Lịch sử lưu Firebase vẫn chỉ là `ChatMessage[]` chữ; không lưu function call/response. Không sửa `database.rules.json`.
- Danh sách cuộc trò chuyện: đọc thẳng `users/{uid}/aiChats`; ẩn mục có lượt không còn trong store hoặc câu không còn trong lượt/bank; trống thì **"Chưa có cuộc trò chuyện nào."**
- Hỏi tiếp ở cuộc trò chuyện cũ không đánh dấu câu đang làm; lượt cũ đã nộp không đổi; lượt cũ Thi thử còn dở thì đánh dấu như bình thường.
- Không dùng chữ A/B/C trong giải thích (quy tắc dự án). Giao diện chat tiếng Việt.
- `npm run check` pass trước mỗi commit.

## Review Focus

1. Gemini gửi truy vấn tiếng Việt hoặc rỗng (`""`, `"   "`) → trả `[]`, không ném lỗi. (Task 1)
2. Gemini gọi tên tool không tồn tại hoặc `args` sai kiểu → trả `functionResponse` `{ error: 'unknown tool' }` / tìm với chuỗi rỗng, không làm hỏng lượt chat. (Task 2)
3. Câu main (HTML) trong kết quả không còn thẻ HTML. (Task 1)
4. Đăng xuất khi đang ở màn danh sách hoặc cuộc trò chuyện cũ → khung đóng như hiện nay. (Task 4)
5. Lượt cũ trong danh sách đã bị xóa khỏi store → ẩn, không crash khi mở. (Task 4)

---

## File Structure

- Create `src/ai/search.ts` + `src/ai/search.test.ts` — `searchAnswered` (thuần) và `createSearchTool` (bọc thành `AiTool`, đánh dấu guideOpened).
- Create `src/ai/tool-loop.ts` + `src/ai/tool-loop.test.ts` — vòng function-calling thuần.
- Modify `src/ai/types.ts` — `AiTool`, `ChatOptions`, `ChatSummary`, `ChatHistoryStore.list`.
- Modify `src/ai/gemini.ts` — khai báo tool cho SDK, dùng `toolLoop`.
- Modify `src/ai/prompt.ts` (+ test) — chỉ dẫn dùng tool.
- Modify `src/test/fake-ai.ts` — fake hỗ trợ tool và `list`.
- Modify `src/sync/firebase.ts` — `chats.list`.
- Modify `src/components/GeminiChat.tsx` (+ test), `src/styles.css`.
- Modify `CLAUDE.md` (mục `src/ai/`).

---

### Task 1: Hàm tìm câu đã làm `searchAnswered`

**Files:**
- Create: `src/ai/search.ts`
- Test: `src/ai/search.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SearchTry {
    attemptId: string;
    /** Vị trí câu trong lượt, bắt đầu từ 1. */
    position: number;
    /** 'YYYY-MM-DD' theo giờ máy, từ submittedAt ?? startedAt. */
    date: string;
    mode: Mode;
    submitted: boolean;
    chosen: string[];   // chữ của lựa chọn đã chọn
    correct: boolean;   // isCorrect(answers[qid], question.answer)
  }
  export interface SearchHit {
    qid: number;
    /** "Đề 3 · Câu 12" theo lần làm mới nhất (setLabel + position). */
    label: string;
    /** true nếu (attemptId, qid) hiện tại có trong tries. */
    current: boolean;
    question: string;   // stem + '\n' + prompt, đã htmlToText nếu html
    options: { text: string; correct: boolean }[];  // thứ tự gốc
    services: string[]; // tên service (registry name) từ meta
    tries: SearchTry[]; // mới nhất trước
  }
  export interface SearchContext { setId: number; attemptId: string; qid: number }
  export const SEARCH_LIMIT = 5;
  export function searchAnswered(
    query: string,
    ctx: SearchContext,
    attempts: Attempt[],
    bank: Pick<Bank, 'questions' | 'meta' | 'services'>,
    limit?: number,
  ): SearchHit[];
  ```

- [ ] **Step 1: Viết test thất bại** trong `src/ai/search.test.ts`. Dựng bank nhỏ bằng `makeQuestion`/`makeMainQuestion` (`src/test/fixtures.tsx`) và câu tùy biến có stem chứa "multipart upload"; meta câu 1 có `services: ['s3']`, registry `{ id: 's3', name: 'Amazon S3' }`. Các test:
  - `tìm theo chữ trong đề, trả đề, lựa chọn và lần làm` — hit có `question` chứa đề, `options[i].correct` đúng, `tries[0].chosen` là chữ lựa chọn, `correct` đúng.
  - `chỉ tìm trong cùng setId` — lượt `setId: 2` có câu khớp → không có trong kết quả.
  - `bỏ lượt Thi thật đang làm, giữ Thi thật đã nộp`.
  - `bỏ lượt incompatible và câu chưa trả lời` (answers rỗng hoặc `[]`).
  - `gộp một câu làm ở nhiều lượt, mới nhất trước` — 2 lượt cùng qid → 1 hit, `tries.length === 2`, `tries[0]` là lượt mới hơn; `label` theo lượt mới nhất.
  - `đánh dấu câu đang làm` — ctx trùng (attemptId, qid) → `current: true`.
  - `khớp theo tên service trong meta` — truy vấn `"amazon s3"` khớp câu 1 dù đề không có chữ đó.
  - `không phân biệt hoa thường; giới hạn 5` — 7 câu khớp → 5 hit.
  - `truy vấn rỗng hoặc chỉ khoảng trắng trả []`.
  - `câu main HTML không còn thẻ` — `question` không chứa `<p>`.
  - `không có nhãn A/B/C` — `JSON.stringify(hits)` không chứa `"key"`.

- [ ] **Step 2: Chạy để thấy thất bại**
  Run: `npx vitest run src/ai/search.test.ts` — Expected: FAIL (module chưa có).

- [ ] **Step 3: Cài đặt `searchAnswered`** trong `src/ai/search.ts`. So khớp:
  ```
  tokens = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2), bỏ trùng
  haystack(câu) = lowercase(question + options + service names + service ids)
  score = số token có trong haystack + (haystack.includes(query đã chuẩn hóa khoảng trắng) ? 2 : 0)
  giữ câu có score >= max(1, ceil(tokens.length / 2)); sắp score giảm dần, rồi lần làm mới nhất trước
  ```
  Dùng `isCorrect` (`src/engine/scoring.ts`), `htmlToText` (`src/data/html-text.ts`), `setLabel` (`src/app/format.ts`).

- [ ] **Step 4: Chạy test** — `npx vitest run src/ai/search.test.ts` → PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/ai/search.ts src/ai/search.test.ts
  git commit -m "feat(ai): search answered questions within the same set"
  ```

---

### Task 2: Function calling (types, vòng tool, adapter, fake, prompt)

**Files:**
- Create: `src/ai/tool-loop.ts`, `src/ai/tool-loop.test.ts`
- Modify: `src/ai/types.ts`, `src/ai/gemini.ts`, `src/test/fake-ai.ts`, `src/ai/prompt.ts`, `src/ai/prompt.test.ts`

**Interfaces:**
- Produces (trong `src/ai/types.ts`):
  ```ts
  export interface AiTool {
    name: string;
    description: string;
    /** Tham số chuỗi: tên → mô tả. Tất cả bắt buộc. */
    params: Record<string, string>;
    run(args: Record<string, unknown>): Promise<object> | object;
  }
  export interface ChatOptions {
    tools?: AiTool[];
    /** Gọi mỗi lần mô hình yêu cầu chạy tool (để hiện dòng chờ). */
    onToolCall?: (name: string) => void;
  }
  export interface AiClient {
    startChat(systemPrompt: string, history: ChatMessage[], options?: ChatOptions): AiChat;
  }
  ```
- Produces (trong `src/ai/tool-loop.ts`):
  ```ts
  export const MAX_TOOL_ROUNDS = 3;
  export interface FunctionCallLike { name: string; args: Record<string, unknown> }
  export type ToolTurn = string | { name: string; response: object }[];
  export interface TurnResult { chunks: AsyncIterable<string>; calls(): Promise<FunctionCallLike[]> }
  export function toolLoop(send: (turn: ToolTurn) => Promise<TurnResult>, text: string, options?: ChatOptions): AsyncIterable<string>;
  ```
- Produces (fake): `FakeAi.toolCalls?: FunctionCallLike[]` — nếu đặt, lượt `send` đầu tiên của mỗi chat chạy các tool này qua `toolLoop` trước khi trả `reply`; `FakeAi.calls[i].toolResults: object[]` ghi kết quả.

- [ ] **Step 1: Test thất bại** `src/ai/tool-loop.test.ts`:
  - `không có function call: stream chữ rồi dừng` — một lượt, ra đúng các đoạn.
  - `có function call: chạy tool, gửi functionResponse, stream câu trả lời cuối` — lượt 2 nhận `[{ name: 'find', response: <kết quả run> }]`; `onToolCall` được gọi với `'find'`.
  - `tool không tồn tại trả { error: 'unknown tool' }`.
  - `vượt 3 vòng thì ném lỗi` — send luôn trả call → sau lượt thứ 4 không gửi nữa, iterator ném `Error`.
  Và trong `src/ai/prompt.test.ts`: `có chỉ dẫn dùng tool tìm câu` — prompt chứa `'Bạn chưa làm câu nào như vậy trong đề này.'` và `'find_answered_questions'`.

- [ ] **Step 2: Chạy để thấy thất bại**
  Run: `npx vitest run src/ai/tool-loop.test.ts src/ai/prompt.test.ts` — Expected: FAIL.

- [ ] **Step 3: Cài đặt**
  - `toolLoop`: lượt đầu gửi `text`; mỗi lượt yield các đoạn chữ khác rỗng; lấy `calls()`; rỗng → kết thúc; còn → `onToolCall(name)` từng call, chạy `tool.run(args)` (thiếu tool → `{ error: 'unknown tool' }`), gửi mảng response. Quá `MAX_TOOL_ROUNDS` lượt có call → `throw new Error('too many tool calls')`.
  - `gemini.ts`: `startChat` truyền `tools: [{ functionDeclarations: tools.map(t => ({ name, description, parameters: Schema.object({ properties: <Schema.string({ description }) cho từng params> }) })) }]` khi có tool; `send(text)` = `toolLoop(turn => …, text, options)`, trong đó chuỗi → `session.sendMessageStream(turn)`, mảng → `session.sendMessageStream(turn.map(r => ({ functionResponse: r })))`; `chunks` từ `stream` map `c.text()`, `calls()` = `(await response).functionCalls() ?? []` (map `{ name, args: (args ?? {}) as Record<string, unknown> }`).
  - `fake-ai.ts`: `startChat(systemPrompt, history, options)` lưu `options`; `send` dùng `toolLoop` với một `send` giả: lượt chữ đầu trả `toolCalls` (nếu có) và không chữ, lượt response ghi `toolResults` rồi trả `reply` như cũ (giữ nguyên `hold`, `failAfter`, `reply instanceof Error`).
  - `prompt.ts`: thêm vào cuối `buildSystemPrompt` các dòng:
    ```
    '- Khi người học muốn tìm lại một câu đã làm, gọi tool find_answered_questions với từ khóa tiếng Anh hoặc tên dịch vụ AWS.',
    '- Tool trả về rỗng thì chỉ trả lời: "Bạn chưa làm câu nào như vậy trong đề này." Không bịa câu hỏi.',
    '- Tìm thấy thì nêu đề, các lựa chọn, người học đã chọn gì, đúng hay sai, đáp án đúng, rồi phân tích tình huống và so sánh với câu đang làm. Nhiều câu thì liệt kê ngắn để người học chọn.',
    '- Không dùng chữ cái A/B/C để chỉ lựa chọn của câu tìm được; nhắc bằng nội dung lựa chọn.',
    ```

- [ ] **Step 4: Chạy** `npm run check` → PASS (test GeminiChat cũ vẫn xanh vì `options` tùy chọn).

- [ ] **Step 5: Commit**
  ```bash
  git add src/ai src/test/fake-ai.ts
  git commit -m "feat(ai): function-calling loop for Gemini tools"
  ```

---

### Task 3: Gắn tool tìm câu vào khung chat

**Files:**
- Modify: `src/ai/search.ts`, `src/ai/search.test.ts`, `src/components/GeminiChat.tsx`, `src/components/GeminiChat.test.tsx`

**Interfaces:**
- Consumes: `searchAnswered`, `SearchContext` (Task 1); `AiTool`, `ChatOptions`, `FakeAi.toolCalls` (Task 2).
- Produces:
  ```ts
  export const SEARCH_TOOL = 'find_answered_questions';
  export function createSearchTool(store: AttemptStore, bank: Pick<Bank, 'questions' | 'meta' | 'services'>, ctx: SearchContext): AiTool;
  ```
  `params: { query: 'Từ khóa tiếng Anh hoặc tên dịch vụ AWS của câu cần tìm' }`. `run({ query })` → `{ results: SearchHit[] }`; với mỗi `try` có `mode === 'practice' && !submitted`, lấy `store.get(attemptId)`, nếu chưa có qid trong `guideOpened` thì `store.save(markGuideOpened(latest, qid))`.

- [ ] **Step 1: Test thất bại**
  - `search.test.ts`: `tool đánh dấu đã xem hướng dẫn ở lượt Thi thử chưa nộp, không sửa lượt đã nộp` — dùng `createStore(memoryStorage())`.
  - `search.test.ts`: `args không phải chuỗi thì coi như rỗng` — `run({ query: 5 })` → `{ results: [] }`.
  - `GeminiChat.test.tsx`: `Gemini gọi tool tìm câu: hiện dòng chờ, kết quả gửi lại cho mô hình` — `s.ai.toolCalls = [{ name: 'find_answered_questions', args: { query: 'Stem' } }]`, `s.ai.hold = true`; sau khi gửi thấy `'Gemini đang tìm trong các câu bạn đã làm…'`; `release()` xong `s.ai.calls[0].toolResults[0]` có `results`.
  - `GeminiChat.test.tsx`: `startChat nhận tool find_answered_questions` — `s.ai.calls[0]` lưu `options.tools[0].name`.

- [ ] **Step 2: Chạy** `npx vitest run src/ai/search.test.ts src/components/GeminiChat.test.tsx` → FAIL.

- [ ] **Step 3: Cài đặt** `createSearchTool`; trong `ChatDialog` (`GeminiChat.tsx`) truyền `{ tools: [createSearchTool(store, bank, { setId, attemptId, qid })], onToolCall: () => setSearching(true) }` vào `ai.startChat`; tắt `searching` khi có đoạn chữ đầu hoặc khi kết thúc/lỗi. Dòng chờ hiện khi `searching`, dùng class `hint` như dòng "Gemini đang trả lời…". `setId` lấy từ `store.get(attemptId)`.

- [ ] **Step 4: Chạy** `npm run check` → PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/ai/search.ts src/ai/search.test.ts src/components/GeminiChat.tsx src/components/GeminiChat.test.tsx
  git commit -m "feat(ui): Gemini can find questions you already answered in this set"
  ```

---

### Task 4: Mở lại cuộc trò chuyện cũ (bố cục A)

**Files:**
- Modify: `src/ai/types.ts`, `src/sync/firebase.ts`, `src/test/fake-ai.ts`, `src/components/GeminiChat.tsx`, `src/components/GeminiChat.test.tsx`, `src/styles.css`, `CLAUDE.md`

**Interfaces:**
- Consumes: `createSearchTool` (Task 3).
- Produces:
  ```ts
  export interface ChatSummary { attemptId: string; qid: number; updatedAt: number; /** Tin cuối, đã cắt ~80 ký tự. */ last: string }
  export interface ChatHistoryStore { load(…); save(…); list(uid: string): Promise<ChatSummary[]> }
  ```
  `fakeChats`: `list` trả các key đã có trong `data` (initial + đã save), `updatedAt` tăng dần theo thứ tự ghi; thêm `listError?: Error`.

- [ ] **Step 1: Test thất bại** (`GeminiChat.test.tsx`; tạo thêm lượt Thi thử `e0` cùng `setId` với chat `u1/e0/<qid>` trong `fakeChats` initial):
  - `nút Trò chuyện cũ hiện danh sách, câu đang làm đứng đầu` — bấm nút `aria-label="Trò chuyện cũ"` → thấy `"(câu đang làm)"` ở mục đầu và mục `"Đề 1 · Câu 1"` của lượt `e0` với đoạn trích.
  - `mở cuộc trò chuyện cũ: hiện tin cũ, có dải quay lại; quay lại thì về câu đang làm` — dải `"← Quay lại Đề 1 · Câu 1"`; tiêu đề dialog đổi; bấm dải → về cuộc trò chuyện hiện tại.
  - `hỏi tiếp ở cuộc trò chuyện cũ: lưu vào đúng (attempt, qid) cũ, không đánh dấu câu đang làm` — `s.chats.saved.at(-1).key === 'u1/e0/<qid>'`; `guideOpened` của `e1` không đổi; `e0` (Thi thử dở) có qid trong `guideOpened`.
  - `lượt cũ đã nộp: hỏi tiếp không sửa lượt đó`.
  - `ẩn cuộc trò chuyện của lượt đã xóa` — chat `u1/gone/1` không hiện.
  - `chưa có cuộc trò chuyện khác` — không có chat nào ngoài câu đang làm (hoặc `listError` đặt) → vẫn có mục câu đang làm, bên dưới là `"Chưa có cuộc trò chuyện nào."`, không crash.
  - `đăng xuất khi đang ở danh sách thì đóng khung` (Review Focus 4).

- [ ] **Step 2: Chạy** `npx vitest run src/components/GeminiChat.test.tsx` → FAIL.

- [ ] **Step 3: Cài đặt**
  - `firebase.ts`: `list(uid)` = `get(ref(db, \`users/${uid}/aiChats\`))`, duyệt `attemptId → qid → { json, updatedAt }`, parse `json` như `load`, bỏ bản hỏng, `last` = tin cuối cắt 80 ký tự.
  - `GeminiChat.tsx`: `ChatDialog` giữ `home: { attemptId, qid, onFirstReply }` (từ props) và state `target: { attemptId, qid }` + `view: 'chat' | 'list'`. Phần nội dung một cuộc trò chuyện tách thành component con `<Conversation key={\`${attemptId}/${qid}\`} …>` (messages, chatRef, busy… như hiện nay) để đổi target là làm mới trạng thái. Với target khác home: dựng `question`, `order`, `number` từ `store.get(attemptId)` + `bank.questions`; `onFirstReply` = nếu lượt đó `mode === 'practice' && status === 'in-progress'` thì `store.save(markGuideOpened(store.get(id)!, qid))`, ngược lại không làm gì. `Conversation` nhận tool `createSearchTool(store, bank, { setId: <setId của lượt target>, attemptId, qid })`, nên phạm vi tìm là đề của lượt cũ. Tiêu đề `"Hỏi Gemini · <setLabel> · Câu <n>"` khi khác home, giữ `"Hỏi Gemini · Câu <n>"` cho home (test cũ dựa vào tên này). Nút 🕘 cạnh nút mở rộng, `aria-label="Trò chuyện cũ"`. Mục danh sách là `<button>` với `"<setLabel> · Câu <n>"`, ngày `formatDate(updatedAt)`, `last`; sắp `updatedAt` giảm dần, home đứng đầu kèm `"(câu đang làm)"`.
  - `styles.css`: `.gemini__list`, `.gemini__item`, `.gemini__back` theo mockup A (mục viền mảnh, mục hiện tại nền `--selected-bg`; dải quay lại nền nhạt, chữ màu `--link`).
  - `CLAUDE.md` mục `src/ai/`: thêm `search.ts` (tool `find_answered_questions`, phạm vi cùng đề, đánh dấu guideOpened), `tool-loop.ts` (vòng function calling, tối đa 3), `ChatHistoryStore.list`.

- [ ] **Step 4: Chạy** `npm run check` → PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/ai/types.ts src/sync/firebase.ts src/test/fake-ai.ts src/components/GeminiChat.tsx src/components/GeminiChat.test.tsx src/styles.css CLAUDE.md
  git commit -m "feat(ui): reopen previous Gemini conversations from the chat panel"
  ```

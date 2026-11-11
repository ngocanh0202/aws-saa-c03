# AI tô từ khóa + câu hỏi gợi ý tiếp theo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat AI có tool `highlight_keywords` tô cụm chữ trong đề (Thi thử đang làm) và sau mỗi câu trả lời hiện 2–3 câu hỏi gợi ý tiếp theo do AI viết.

**Architecture:** Logic thuần (tìm cụm → highlight, tách gợi ý khỏi câu trả lời) nằm ở `src/ai/highlight-tool.ts` và `src/ai/followups.ts`, có test. `GeminiChat` chỉ nối: thêm tool khi lượt là Thi thử đang làm, ẩn phần gợi ý khi stream, lưu `suggestions` trên tin AI, hiện gợi ý AI trước gợi ý cố định.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (jsdom), `src/test/fake-ai.ts`.

**Spec:** docs/superpowers/specs/2026-11-11-ai-highlight-followups-design.md

## Global Constraints

- Không đưa đáp án vào prompt khi chưa xem hướng dẫn (giữ nguyên `buildSystemPrompt`).
- Tool tên `highlight_keywords`, tham số `phrases` (mỗi cụm một dòng); tối đa 8 cụm/lần, cụm > 120 ký tự hoặc rỗng bỏ qua.
- Tool chỉ có khi lượt của câu đang chat là `mode === 'practice' && status === 'in-progress'` (trước hay sau xem hướng dẫn đều được).
- Đoạn AI tô: `note` rỗng; cụm chồng lên đoạn đã có thì bỏ qua (không gộp); lưu theo `bank.canonical(qid)`.
- Dấu tách gợi ý: `<<GOI_Y>>`; tối đa 3 gợi ý, mỗi gợi ý cắt 100 ký tự.
- Gợi ý cố định mới: `'Tô từ khóa quan trọng trong đề'`, đứng ngay sau `'Đề này đang hỏi gì?'`, chỉ khi có tool.
- Dòng chờ khi tool tô chạy: `` `${brand} đang tô từ khóa…` ``.
- Comment/chữ tiếng Việt: kiểm tra không có mojibake (grep `ềE`, `�`) trước khi commit.
- Chạy test bằng PowerShell (Vitest lỗi dưới Git Bash). `npm run check` xanh ở cuối.

## Review Focus

1. Cụm AI gửi khác hoa/thường hoặc xuống dòng/khoảng trắng so với đề → vẫn tô đúng đoạn trong đề (Task 1 test).
2. Câu main `html: true` → offset đo trên textContent giống Highlighter, mark hiện đúng chỗ (Task 1 test qua `partText`).
3. Stream dừng giữa dấu tách (`…<<GO`) → khung chat không hiện mẩu dấu (Task 2 test `visibleReply`).
4. Lượt đã nộp trong lúc phiên chat còn mở → tool chạy trả lỗi, không ghi highlight (Task 1 test).
5. Bản chat cũ có `suggestions` hỏng kiểu → vẫn tải được cuộc chat, bỏ gợi ý (Task 2 test `parseChat`).

---

### Task 1: Tool `highlight_keywords`

**Files:**
- Create: `src/notes/part-text.ts` (chuyển `partText` từ `src/pages/NotesPage.tsx:10-20`, export), sửa NotesPage import nó.
- Create: `src/ai/highlight-tool.ts`, test `src/ai/highlight-tool.test.ts`.

**Interfaces:**
- Produces:
  - `partText(q: Question, part: HighlightPart): string` (src/notes/part-text.ts)
  - `HIGHLIGHT_TOOL = 'highlight_keywords'`
  - `findPhrase(text: string, phrase: string): { start: number; end: number } | null` — khớp không phân biệt hoa/thường, mọi chuỗi khoảng trắng coi như một; trả offset trong `text` gốc.
  - `highlightPhrases(notes: QuestionNotes | undefined, question: Question, canonicalQid: number, phrases: string[], newId: () => string, now: number): { notes: QuestionNotes; highlighted: string[]; skipped: string[]; notFound: string[] }` — thử `stem` rồi `prompt`; chồng lên highlight cùng part (kể cả vừa thêm trong lần gọi này) → `skipped`; thêm bằng `addHighlight` (note rỗng).
  - `createHighlightTool(deps: { notes: NotesStore; isOpen: () => boolean; question: Question; canonicalQid: number; newId: () => string; now: () => number }): AiTool` — `run` tách `args.phrases` theo dòng, trim, bỏ rỗng/>120, lấy 8 đầu; `isOpen()` false → `{ error: 'Chỉ tô được khi đang làm Thi thử.' }`; có cụm được tô thì `notes.save`.

- [ ] **Step 1: Write failing tests** (`highlight-tool.test.ts`, dùng `makeQuestion`/`makeMainQuestion`, `createNotesStore(memoryStorage())`):
  - `findPhrase('Least  Operational\noverhead x', 'least operational overhead')` → `{ start: 0, end: 27 }`.
  - `highlightPhrases` trên stem: tô cụm có trong stem → `highlighted` chứa cụm, highlight `part: 'stem'`, `note: ''`, `text` = chữ trong đề.
  - Cụm chỉ có trong `prompt` → `part: 'prompt'`.
  - Cụm chồng đoạn có sẵn (note `'của tôi'`) → `skipped`, highlight cũ giữ nguyên (cùng start/end/note).
  - Hai cụm chồng nhau trong cùng lần gọi → cụm sau `skipped`.
  - Cụm không có → `notFound`.
  - Câu main: offset khớp `partText(q,'stem')` (`partText(q,'stem').slice(h.start,h.end) === h.text`).
  - Tool: `isOpen` false → trả `{ error }`, store không đổi; 10 cụm → chỉ xét 8; cụm 121 ký tự bỏ; thành công → `notes.get(canonicalQid)` có highlight và kết quả có `highlighted`.
- [ ] **Step 2:** `npx vitest run src/ai/highlight-tool.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Implement `part-text.ts`, `highlight-tool.ts`; NotesPage dùng `partText` mới. Mô tả tool cho mô hình: tô các cụm then chốt (ràng buộc chi phí, vận hành, thời gian, quy mô, bảo mật…) chép nguyên văn từ đề bài/dòng câu hỏi, không tô lựa chọn.
- [ ] **Step 4:** `npx vitest run src/ai/highlight-tool.test.ts src/pages` → PASS.
- [ ] **Step 5:** Commit `feat(ai): highlight_keywords tool marks key phrases in the stem`.

### Task 2: Gợi ý tiếp theo — phần thuần, prompt, kiểu dữ liệu

**Files:**
- Create: `src/ai/followups.ts`, test `src/ai/followups.test.ts`.
- Modify: `src/ai/types.ts` (`ChatMessage.suggestions?: string[]`), `src/ai/prompt.ts` + test, `src/ai/suggestions.ts` + test, `src/ai/similar.ts` + test, `src/sync/firebase.ts` (`parseChat`).

**Interfaces:**
- Produces:
  - `FOLLOWUP_MARK = '<<GOI_Y>>'`, `FOLLOWUP_MAX = 3`, `FOLLOWUP_LEN = 100`.
  - `splitFollowups(raw: string): { text: string; suggestions: string[] }` — trước dấu = `text` (trimEnd); sau dấu: các dòng, bỏ tiền tố `- `/`* `/`1. `, trim, bỏ rỗng, cắt 100, lấy 3. Không có dấu → `{ text: raw, suggestions: [] }`.
  - `visibleReply(partial: string): string` — chữ hiện khi đang stream: cắt từ dấu tách; nếu đuôi là tiền tố dở của dấu (vd `<<GO`) thì cắt đuôi đó.
  - `pickFollowups(ai: string[], fixed: string[], asked: string[]): string[]` — bỏ câu `similarity ≥ SIMILAR_THRESHOLD` với một câu trong `fixed` hoặc `asked`, bỏ trùng nhau.
  - `chatSuggestions(serviceIds, services, opts?: { highlight?: boolean })` — thêm `'Tô từ khóa quan trọng trong đề'` sau `'Đề này đang hỏi gì?'` khi `highlight`.
  - `PromptExtra` thêm `highlightTool?: boolean`, `fixedSuggestions?: string[]`. Prompt luôn có luật gợi ý: cuối câu trả lời viết dòng `<<GOI_Y>>` rồi 2–3 câu hỏi tiếp theo (mỗi câu một dòng `- `, ≤ 100 ký tự, viết như lời người học, giúp đi tiếp tới đáp án; chưa xem hướng dẫn thì không ngầm chỉ đáp án), không trùng các câu trong `fixedSuggestions` (liệt kê). `highlightTool` → thêm luật: người học nhờ tô từ khóa/gợi ý thì gọi `highlight_keywords`, rồi giải thích ngắn vì sao các cụm quan trọng; không tô lựa chọn.
  - `findCachedReply(...)` đổi kiểu trả về thành `ChatMessage | null` (tin model gốc, để mang theo `suggestions`).
- [ ] **Step 1: Write failing tests:**
  - `splitFollowups('Trả lời.\n<<GOI_Y>>\n- Câu 1?\n- Câu 2?\n\n- Câu 3?\n- Câu 4?')` → `{ text: 'Trả lời.', suggestions: ['Câu 1?','Câu 2?','Câu 3?'] }`; câu 150 ký tự → độ dài 100; không có dấu → nguyên văn, `[]`.
  - `visibleReply('Abc\n<<GO')` → `'Abc\n'`; `visibleReply('Abc <<GOI_Y>>\n- x')` → `'Abc '`; `visibleReply('a < b')` → `'a < b'`.
  - `pickFollowups(['Dịch đề và các lựa chọn sang tiếng Việt.', 'S3 Glacier khác gì?', 'S3 Glacier khác gì?'], ['Dịch đề và các lựa chọn sang tiếng Việt'], [])` → `['S3 Glacier khác gì?']`.
  - `chatSuggestions([], new Map(), { highlight: true })` có `'Tô từ khóa quan trọng trong đề'` ở index 2; không có opts → không có.
  - `buildSystemPrompt`: luôn chứa `<<GOI_Y>>` và mỗi câu `fixedSuggestions`; `highlightTool: true` → chứa `highlight_keywords`; false → không.
  - `findCachedReply` trả tin có `suggestions`.
  - `parseChat` (test cạnh firebase nếu có, không thì tách `parseChat` ra hàm export thuần trong `src/sync/firebase.ts` hoặc file nhỏ `src/ai/chat-json.ts` để test): tin có `suggestions: 5` → vẫn tải, tin đó không có `suggestions`.
- [ ] **Step 2:** chạy các test trên → FAIL.
- [ ] **Step 3:** Implement; sửa chỗ gọi `findCachedReply` trong `GeminiChat.tsx` dùng `.text` (+ giữ `suggestions`) để typecheck xanh.
- [ ] **Step 4:** `npx vitest run src/ai src/sync` + `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(ai): follow-up suggestion parsing and prompt rules`.

### Task 3: Nối vào GeminiChat

**Files:**
- Modify: `src/components/GeminiChat.tsx`, `src/styles.css` (nếu cần), `CLAUDE.md` (mục `src/ai/`).
- Test: `src/components/GeminiChat.test.tsx`.

**Interfaces:**
- Consumes: Task 1 `createHighlightTool`, `HIGHLIGHT_TOOL`, `newHighlightId` (hiện là hàm nội bộ ở `src/notes/Highlighter.tsx:80` — chuyển sang `src/notes/model.ts` và export, Highlighter import lại); Task 2 toàn bộ.

- [ ] **Step 1: Write failing tests** (`GeminiChat.test.tsx`, theo kiểu test hiện có với `fakeAi().toolCalls`):
  - Lượt Thi thử đang làm: `ai.calls[0].options.tools` có `highlight_keywords`; gợi ý cố định có `'Tô từ khóa quan trọng trong đề'`. Lượt Thi thật / trang xem lại: không có cả hai.
  - Mô hình gọi `highlight_keywords` với một cụm trong stem → `deps.notes.get(bank.canonical(qid))` có highlight note rỗng; trong lúc chờ hiện `'… đang tô từ khóa…'`.
  - Câu trả lời `'OK\n<<GOI_Y>>\n- Hỏi tiếp A?\n- Dịch đề và các lựa chọn sang tiếng Việt'` → khung chat hiện `OK`, không hiện `<<GOI_Y>>`; nhóm "Câu hỏi gợi ý" có nút `'Hỏi tiếp A?'` đứng trước gợi ý cố định, và chỉ một nút "Dịch đề…"; tin lưu (`chats.saved`) có `text: 'OK'`, `suggestions: ['Hỏi tiếp A?', 'Dịch đề và các lựa chọn sang tiếng Việt']`.
  - Bấm `'Hỏi tiếp A?'` → gửi đúng câu đó; sau câu trả lời mới không có gợi ý → nút `'Hỏi tiếp A?'` biến mất (chỉ gợi ý của tin mới nhất).
- [ ] **Step 2:** `npx vitest run src/components/GeminiChat.test.tsx` → FAIL.
- [ ] **Step 3:** Implement:
  - `canHighlight` = lượt `store.get(attemptId)` là Thi thử đang làm; tool dựng như `createSearchTool` với `isOpen` đọc lại store mỗi lần chạy, `canonicalQid = bank.canonical(qid)`. `canHighlight` đổi thì bỏ phiên (`chatRef.current = null`) như khi đổi `revealed`.
  - `onToolCall`: `HIGHLIGHT_TOOL` → cờ `highlighting` (giống `searching`), dòng chờ `` `${brand} đang tô từ khóa…` ``.
  - Stream: `progress` hiện `visibleReply(reply)`; xong thì `splitFollowups(reply)` → `modelMsg(text)` + `suggestions` (bỏ field khi rỗng); `text` rỗng sau tách → lỗi như trả rỗng.
  - Cache: dùng tin cache (giữ `suggestions`).
  - Hiển thị: `pickFollowups(lastModel.suggestions ?? [], fixedAll, askedUserTexts)` đứng trước danh sách gợi ý cố định đã lọc; prompt nhận `fixedSuggestions` = gợi ý cố định đầy đủ (chưa lọc), `highlightTool = canHighlight`.
  - CLAUDE.md: một đoạn ngắn về tool tô và gợi ý `<<GOI_Y>>`.
- [ ] **Step 4:** `npm run check` → validate 0 lỗi, mọi test PASS, typecheck 0.
- [ ] **Step 5:** Commit `feat(chat): AI highlights keywords and suggests follow-up questions`.

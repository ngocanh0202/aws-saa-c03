# Khung ghi chú theo câu, ghi chú tự do và nút đổi chế độ AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa nút Ghi chú thành nút nổi cạnh nút Hỏi AI. Nút mở một khung liệt kê, sửa, xóa và thêm ghi chú của câu, có AI hỗ trợ viết. Trang Ghi chú tạo được ghi chú tự do không gắn câu. Khung chat có nút chuyển Gemini ↔ AI local.

**Architecture:**
- Ghi chú tự do là bản ghi `QuestionNotes` với `qid < 0`, nên store, sync và rules không đổi.
- AI hỗ trợ form là một luồng mới `draftFormNote`, chạy qua `aiGate` với `kind: 'form'`. Luồng này trả chữ về form, không tự lưu.
- UI tách thành các khối dùng chung:
  - `NoteSheet`: popup trên máy tính, bottom sheet có thanh kéo trên điện thoại.
  - `NoteForm`: form tiêu đề + nội dung + nút AI.
  - `NoteEntryCard`: một mục ghi chú, có sửa/xóa.
- Các khối này được ghép thành `NotePanel` (khung của một câu) và form ghi chú tự do trên `NotesPage`.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom), CSS thuần trong `src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-11-13-note-panel-standalone-notes-design.md`

## Global Constraints

- Giao diện tiếng Việt. Thi thật đang làm không có ghi chú và không có nút Ghi chú.
- Dữ liệu gửi AI **không bao giờ** chứa đáp án (`question.answer`), giải thích (`question.explanation`), `data/vi` hay `meta.note`, kể cả khi đã mở hướng dẫn hay bài đã nộp.
- Không đổi định dạng `QuestionNotes`/`NoteItem`, không đổi `database.rules.json`, không đổi popup tô đề và `draftNote`.
- Giới hạn dung lượng: `TITLE_MAX = 200`, `ITEM_CONTENT_MAX = 10_000`, `NOTE_MAX` (nội dung đoạn tô), `fitsLimit` + `TOO_LONG_MESSAGE` cho mọi lần thêm/sửa.
- Điện thoại = `MOBILE_QUERY` (`src/notes/Highlighter.tsx`, dưới 640px).
- Chữ cố định:
  - nhóm/nhãn ghi chú tự do: `Ghi chú chung`
  - nút trang Ghi chú: `Ghi chú mới`
  - danh sách trống: `Chưa có ghi chú nào cho câu này.`
  - nút AI trong form: aria-label `AI hỗ trợ viết ghi chú`
  - nút chat: `Chuyển sang AI thử nghiệm` / `Chuyển sang Gemini`
- Test: Vitest + Testing Library, `renderApp`/`makeDeps` (`src/test/fixtures.tsx`), `fakeAi` (`src/test/fake-ai.ts`). Chạy `npm run check` bằng **PowerShell** (Vitest hỏng dưới Git Bash).
- Commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Xóa ghi chú cuối cùng của một ghi chú tự do: mục biến mất, không còn nhóm "Ghi chú chung (0)" hay bản ghi rỗng hiện ra. Test thuộc Task 1 và Task 5.
2. AI trả kết quả sau khi người học đã gõ thêm vào ô Nội dung: kết quả nối vào nội dung **hiện tại**, không đè bằng bản chụp lúc bấm. Test thuộc Task 3.
3. Khung chat đang trả lời (gate bận): nút AI trong form bị khóa. Khung chat đang `busy`: nút đổi chế độ bị khóa. Test thuộc Task 3 và Task 7.
4. Câu đã mở hướng dẫn hoặc bài đã nộp: prompt AI của form vẫn không có đáp án hay giải thích. Test thuộc Task 2.
5. Khóa âm đi qua store, sync, `toEntries`, `sortEntries`, `groupEntries`, `matchesEntry` mà không bị lọc mất hay hiện nhãn "Kho dự phòng". Test thuộc Task 1.

---

### Task 1: Ghi chú tự do trong model và entries

**Files:**
- Modify: `src/notes/model.ts`, `src/notes/entries.ts`
- Test: `src/notes/model.test.ts`, `src/notes/entries.test.ts`, `src/notes/store.test.ts` (hoặc file test store/sync đang có)

**Interfaces:**
- Produces:
  - `isFreeNote(qid: number): boolean` (`qid < 0`) trong `model.ts`.
  - `newFreeQid(now: number, rand?: () => number): number`: trả `-(now * 1000 + Math.floor(rand() * 1000))`, luôn là số nguyên âm an toàn.
  - `createFreeNote(qid: number, value: { title: string; content: string }, id: string, now: number): QuestionNotes`: bản ghi có `highlights: []`, đúng một item `kind: 'manual'`.
  - `FREE_LABEL = 'Ghi chú chung'` trong `entries.ts`.

- [ ] **Step 1: Write failing tests**
  - `model.test.ts`:
    - `isFreeNote(-5) === true`, `isFreeNote(10101) === false`.
    - `newFreeQid(1_700_000_000_000, () => 0.5)` bằng `-1_700_000_000_000_500` và `Number.isSafeInteger` đúng.
    - `createFreeNote(-7, {title:'T', content:''}, 'i1', 9)` → `{ qid: -7, highlights: [], items: [{ id:'i1', kind:'manual', title:'T', content:'', createdAt:9, updatedAt:9 }], updatedAt: 9 }`.
  - `entries.test.ts`, dùng `free = createFreeNote(-7, …)` cùng một bản ghi câu thường:
    - `noteLabel(-7, sets) === 'Ghi chú chung'`.
    - `groupEntries(toEntries([free, q]), ['set'], sets)` có nhóm label `Ghi chú chung` đứng **sau** mọi nhóm đề và sau `Kho dự phòng` khi các mục đã qua `sortEntries(…, 'question', sets)`.
    - Gộp theo `['question']` cho mọi ghi chú tự do vào **một** nhóm `Ghi chú chung` (hai bản ghi -7 và -8 → một nhóm, count 2).
    - `matchesEntry(entry, 'ghi chu chung', sets) === true`.
  - Test store (round-trip): `save(createFreeNote(-7,…))` rồi `get(-7)` trả lại đúng. Một store mới đọc cùng storage cũng có `list()` chứa `qid: -7`. Sau `removeItem` item duy nhất rồi `save`, `list()` không còn `-7` (Review Focus 1).

- [ ] **Step 2:** `npx vitest run src/notes` → FAIL (chưa có hàm).
- [ ] **Step 3: Implement**
  - Thêm ba hàm vào `model.ts`.
  - Trong `entries.ts`:
    - `noteLabel`, `groupOf` (cả `set` lẫn `question` → key `'free'`, label `FREE_LABEL`) và `questionOrder` (free → `[Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`, sau kho dự phòng) đều xử lý `isFreeNote` trước.
    - `noteSetId` trả `null` cho free nhưng không còn được dùng để đặt nhãn free.
  - Nếu `store.list()` hiện vẫn trả bản ghi có `items: []` và `highlights: []` thì lọc bỏ ở đó.
- [ ] **Step 4:** `npx vitest run src/notes` → PASS.
- [ ] **Step 5: Commit** `feat(notes): free notes (negative qid) in model and entries`

### Task 2: Luồng AI hỗ trợ viết ghi chú trong form

**Files:**
- Create: `src/notes/form-ai.ts`, `src/notes/form-ai.test.ts`
- Modify: `src/ai/gate.ts` (`AiJob.kind` thêm `'form'`), `src/components/AiDoneToast.tsx` (bỏ qua `kind === 'form'`), `src/components/AiDoneToast.test.tsx`

**Interfaces:**
- Consumes:
  - `AiClient` (`src/ai/types.ts`), `createIdleWatchdog` (`src/ai/watchdog.ts`), `AiBusyError` (`src/ai/retry.ts`), `AiUserError`, `Cooldown`.
  - Cách làm của `draftNote` trong `src/notes/note-ai.ts`: chép mẫu watchdog, `retry.onWait`, `onThinking`, cooldown.
- Produces:
  - `FORM_AI_REQUEST = 'Soạn nội dung cho ghi chú.'`
  - `canDraftForm(title: string, content: string): boolean`: true khi ít nhất một ô khác rỗng sau `trim`.
  - `buildFormNotePrompt(input: { question?: Question; title: string; content: string }): string`
  - `interface FormDraftDeps { gate: AiGate; client: AiClient; settings?: LocalAiSettings; cooldown: Cooldown; now: () => number }`
  - `interface FormDraftJob { question?: Question; qid: number; label: string; title: string; content: string }`
  - `draftFormNote(deps: FormDraftDeps, job: FormDraftJob): Promise<string>`
    - Chạy `gate.run({ kind: 'form', label, target: { page: 'notes', qid, highlightId: 'form' } }, …)` và trả chữ AI đã `trim`.
    - Gate bận thì ném `AiGateBusyError`.
    - Lỗi khác thì ném `AiUserError` có `userMessage`: `'AI đang quá tải hoặc hết lượt, thử lại sau ít phút.'` cho `AiBusyError`, giữ nguyên với `AiUserError`, còn lại `'AI không soạn được ghi chú. Thử lại sau.'`. Trả lời rỗng tính là lỗi.

- [ ] **Step 1: Write failing tests** (`form-ai.test.ts`, dùng `fakeAi` và `createAiGate`)
  - `canDraftForm('', '  ') === false`, `canDraftForm('a', '') === true`, `canDraftForm('', 'b') === true`.
  - Có `question` (dùng `makeQuestion` với explanation và answer đặt chuỗi dễ nhận ra): prompt chứa stem, prompt và chữ từng lựa chọn, `title` và `content`. Prompt **không** chứa chuỗi explanation, **không** có dòng nào đánh dấu lựa chọn đúng (Review Focus 4).
  - Không có `question`: prompt không có mục "Đề bài", chỉ có title và content.
  - Ba nhánh yêu cầu trong prompt: content rỗng → câu dặn "viết nội dung cho tiêu đề"; content có → câu dặn "trả lời câu hỏi nếu có, không thì bổ sung, không lặp lại". Assert theo từ khóa có trong chữ bạn viết.
  - `draftFormNote` trả `'Kết quả'` khi fake trả `['Kết ', 'quả  ']`. Trong lúc chạy `gate.current()?.kind === 'form'`.
  - Fake ném `AiBusyError` thì promise reject `AiUserError` có message quá tải. Gate đang bận (một `gate.run` khác chưa xong) thì reject `AiGateBusyError`.
  - `AiDoneToast.test.tsx`: job `kind: 'form'` xong thì không hiện toast.
- [ ] **Step 2:** `npx vitest run src/notes/form-ai.test.ts src/components/AiDoneToast.test.tsx` → FAIL.
- [ ] **Step 3: Implement**
  - Prompt theo luật của `buildNotePrompt` (`src/notes/ai-prompt.ts`), dùng `htmlToText` cho câu `html`:
    - mở đầu vai trợ giảng SAA-C03;
    - có câu thì kèm đề, dòng câu hỏi, lựa chọn không nhãn;
    - "Tiêu đề ghi chú" và "Nội dung hiện có" trong `"""…"""`;
    - yêu cầu: tiếng Việt 1–5 câu, giữ thuật ngữ AWS tiếng Anh, không nói lựa chọn nào đúng/sai, hỏi đáp án thì nhắc bấm "Xem hướng dẫn", không chào hỏi/tiêu đề/LaTeX.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5: Commit** `feat(notes): AI draft for note forms (form-ai)`

### Task 3: NoteSheet, NoteForm và nút AI trong form

**Files:**
- Create:
  - `src/notes/use-mobile.ts`: chuyển `useMobile` từ `Highlighter.tsx` sang, export, `Highlighter` import lại.
  - `src/notes/NoteSheet.tsx`, `src/notes/NoteForm.tsx`, `src/notes/NoteAiAssist.tsx`
  - `src/notes/NoteForm.test.tsx`
- Modify: `src/notes/Highlighter.tsx` (import `useMobile`), `src/styles.css`

**Interfaces:**
- Consumes: `draftFormNote`, `canDraftForm` (Task 2); `useActiveAi` (`src/components/GeminiChat.tsx`); `usePopupResize` (`src/notes/usePopupResize.ts`); cooldown và settings như `NoteAiButton.tsx` (`Ready`).
- Produces:
  - `NoteSheet({ title: ReactNode; ariaLabel: string; onClose: () => void; children: ReactNode })`
    - Máy tính: `.dialog` + `role="dialog" aria-modal` ở giữa màn hình.
    - Điện thoại: bottom sheet có nút thanh kéo `aria-label="Kéo để đổi cỡ khung ghi chú"`, gắn `usePopupResize` (`openKey` = `note-sheet:m`/`note-sheet:d`, kéo xuống quá cỡ nhỏ nhất thì `onClose`).
    - Có nút Đóng (`aria-label="Đóng"`). Esc trên `document` đóng, trừ khi `event.defaultPrevented`.
    - Bấm nền thì đóng.
  - `NoteForm({ question?: Question; qid: number; label: string; initial?: { title: string; content: string }; contentOnly?: boolean; contentMax?: number; onSave: (v: { title: string; content: string }) => boolean; onCancel?: () => void; resetOnSave?: boolean })`
    - Trả form có ô `Tiêu đề` (ẩn khi `contentOnly`), ô `Nội dung`, `NoteAiAssist`, nút `Lưu` và nút `Hủy` (chỉ khi có `onCancel`).
    - `onSave` trả false thì hiện `TOO_LONG_MESSAGE` (`role="alert"`).
    - `resetOnSave` thì xóa trống sau khi lưu thành công.
    - Esc trong form (khi có `onCancel`) gọi `preventDefault()` rồi `onCancel`.
  - `NoteAiAssist({ question?: Question; qid: number; label: string; title: string; content: string; onDraft: (text: string) => void })`
    - Không có `useActiveAi()` thì trả null.
    - Nút icon AI `aria-label="AI hỗ trợ viết ghi chú"`, bị khóa khi `!canDraftForm` hoặc `useAiGate() !== null` hoặc đang cooldown.
    - Đang chạy việc của chính nút thì hiện `AI đang soạn…`.
    - Lỗi thì hiện `role="alert"` với `userMessage` kèm nút `Thử lại`.
    - Component đã unmount thì bỏ kết quả.
  - Trong `NoteForm`, `onDraft` nối bằng setState dạng hàm: `c => c.trim() ? c.replace(/\s+$/, '') + '\n\n' + text : text`.

- [ ] **Step 1: Write failing tests** (`NoteForm.test.tsx`, render trong provider của `renderApp`/`makeDeps` với `ai` = `fakeAi()` và người dùng đã đăng nhập, theo cách `NoteAiButton.test.tsx` đang dựng)
  - Tiêu đề và nội dung trống thì nút `AI hỗ trợ viết ghi chú` bị disabled. Gõ tiêu đề thì nút enabled.
  - Bấm AI (fake `hold = true`), gõ thêm `" thêm"` vào Nội dung, rồi nhả fake với reply `'AI viết'`. Ô Nội dung phải là `'<chữ cũ> thêm\n\nAI viết'` (Review Focus 2).
  - Gate đang bận bởi một `aiGate.run({kind:'chat',…})` chưa xong thì nút AI disabled (Review Focus 3).
  - Không có AI (deps không có `ai`/chưa đăng nhập) thì không có nút AI.
  - `onSave` trả false thì hiện `Ghi chú của câu này đã quá dài, hãy xóa bớt.`.
  - `NoteSheet`: Esc gọi `onClose`. Esc khi đang focus trong `NoteForm` có `onCancel` thì chỉ gọi `onCancel`, không gọi `onClose`.
- [ ] **Step 2:** `npx vitest run src/notes/NoteForm.test.tsx` → FAIL.
- [ ] **Step 3: Implement** các component trên.
  - CSS: tái dùng `.note-form__*`.
  - Thêm class `.note-sheet` (desktop như `.note-form__box`; dưới 639px như `.hl-sheet`: dính đáy, bo góc trên, `max-height` theo `SHEET_MAX_VH`) và thanh kéo như `.hl-sheet__grip`. Đọc CSS của `.hl-sheet` để đồng bộ.
- [ ] **Step 4:** `npx vitest run src/notes` → PASS (kể cả test Highlighter cũ).
- [ ] **Step 5: Commit** `feat(notes): NoteSheet, NoteForm with AI assist`

### Task 4: NoteEntryCard dùng chung và NotePanel của một câu

**Files:**
- Create: `src/notes/NoteEntryCard.tsx` (chuyển `Entry` + `EntryEditor` + `SOURCE_ICON` từ `src/pages/NotesPage.tsx`), `src/notes/NotePanel.tsx`, `src/notes/NotePanel.test.tsx`
- Modify: `src/pages/NotesPage.tsx` (import component đã chuyển), `src/notes/NoteFormDialog.tsx`

**Interfaces:**
- Consumes: `NoteSheet`, `NoteForm` (Task 3); `isFreeNote`, `noteLabel` (Task 1).
- Produces:
  - `NoteEntryCard({ entry: NoteEntry; label?: string; question?: Question; onOpen?: (qid: number) => void })`
    - Giữ đúng giao diện hiện tại của `Entry`.
    - `label` có thì hiện trong dòng meta.
    - "Mở câu hỏi" chỉ hiện khi có `onOpen` và `!isFreeNote(entry.qid)`.
    - Sửa dùng `NoteForm` (`initial`, `contentOnly` + `contentMax = NOTE_MAX` cho đoạn tô, `ITEM_CONTENT_MAX` cho item, `question` để AI có đề, `onCancel`).
    - Với `contentOnly`, `NoteForm` vẫn gửi `initial.title` (chữ tô) cho AI, nên nút AI luôn bật với đoạn tô.
    - Xóa giữ bước xác nhận. Esc khi đang xác nhận thì `preventDefault()` và hủy xác nhận.
  - `NotePanel({ qid: number; label: string; question: Question; onClose: () => void })`
    - `NoteSheet` có tiêu đề `Ghi chú · {label}`.
    - Danh sách là `sortEntries(toEntries([notes.get(qid)]), 'newest', …)` hiển thị bằng `NoteEntryCard` không có `onOpen`.
    - Rỗng thì hiện `Chưa có ghi chú nào cho câu này.`.
    - Dưới cùng là `NoteForm` thêm mới (`resetOnSave`, `onSave` = `addItem(…, {kind:'manual'}, …)` + `fitsLimit`).
  - `NoteButton({ qid: number; label: string; question: Question; className?: string; compact?: boolean })`
    - Mở `NotePanel`.
    - `compact` thì chỉ hiện icon kèm `aria-label="Ghi chú"`; không thì hiện icon + chữ `Ghi chú`.
    - `NoteFormDialog` cũ bị xóa nếu không còn ai dùng (Task 5 dùng `NoteSheet` + `NoteForm` trực tiếp).

- [ ] **Step 1: Write failing tests** (`NotePanel.test.tsx`)
  - Câu có một đoạn tô có note, một đoạn tô không note, một item `ai`, một item `manual`. Panel hiện đúng 3 mục, mới nhất trước, và không có nút "Mở câu hỏi".
  - Thêm ghi chú: gõ tiêu đề rồi Lưu. Mục mới xuất hiện trong danh sách, form trống lại, panel vẫn mở.
  - Sửa đoạn tô: không có ô Tiêu đề. Lưu thì nội dung đổi.
  - Xóa: bấm `Xóa ghi chú`, Esc thì hủy xác nhận và panel vẫn mở. Bấm lại rồi `Xóa` thì mục mất.
  - Câu chưa có gì thì hiện `Chưa có ghi chú nào cho câu này.`.
- [ ] **Step 2:** `npx vitest run src/notes/NotePanel.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** `NotesPage` chỉ đổi import, hành vi giữ nguyên. Sửa `NoteFormDialog.test.tsx` thành test của `NoteButton` mở `NotePanel`, hoặc xóa nếu đã trùng `NotePanel.test.tsx`.
- [ ] **Step 4:** `npx vitest run src/notes src/pages/NotesPage.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(notes): per-question note panel with list, edit, delete`

### Task 5: Trang Ghi chú — ghi chú tự do

**Files:**
- Modify: `src/pages/NotesPage.tsx`, `src/pages/NotesPage.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `createFreeNote`, `newFreeQid`, `isFreeNote`, `FREE_LABEL` (Task 1); `NoteSheet`, `NoteForm` (Task 3); `NoteEntryCard` (Task 4).

- [ ] **Step 1: Write failing tests** (`NotesPage.test.tsx`)
  - Trang trống vẫn có nút `Ghi chú mới`.
  - Bấm nút, gõ tiêu đề `Ôn VPC` và nội dung, Lưu. Mục hiện với nhãn `Ghi chú chung`, nguồn `Tự ghi chú`, **không** có nút `Mở câu hỏi`.
  - Form ghi chú tự do không gửi đề cho AI: bấm AI và kiểm tra prompt của `fakeAi` không chứa stem của câu nào (có thể kiểm tra không có chữ `Đề bài`).
  - Gộp theo `Đề` thì có nhóm `Ghi chú chung` đứng cuối. Tìm `on vpc` thì ra mục đó.
  - Sửa tiêu đề ghi chú tự do được. Xóa nó thì mục và nhóm `Ghi chú chung` biến mất (Review Focus 1).
- [ ] **Step 2:** `npx vitest run src/pages/NotesPage.test.tsx` → FAIL.
- [ ] **Step 3: Implement**
  - Bộ lọc `bank.questions.has(e.qid)` đổi thành `isFreeNote(e.qid) || bank.questions.has(e.qid)`.
  - Nút `Ghi chú mới` (`btn-primary`) đứng đầu `notes-tools` và cũng hiện khi trang trống.
  - Form: `NoteSheet` + `NoteForm` không có `question`, `onSave` = `createFreeNote(newFreeQid(now()), v, newHighlightId(), now())` + `fitsLimit`, đóng sau khi lưu.
  - Chữ trang trống: `Chưa có ghi chú. Tô đề rồi ghi chú, đánh dấu câu trả lời của AI, bấm "Ghi chú" khi làm bài, hoặc tạo "Ghi chú mới".`
  - `NoteEntryCard` cho ghi chú tự do nhận `label = FREE_LABEL`.
- [ ] **Step 4:** `npx vitest run src/pages/NotesPage.test.tsx src/notes` → PASS.
- [ ] **Step 5: Commit** `feat(notes): standalone notes on the notes page`

### Task 6: Nút Ghi chú nổi ở Thi thử, nút ở trang xem lại

**Files:**
- Modify: `src/pages/ExamPage.tsx`, `src/pages/ResultPage.tsx`, `src/styles.css`, test ExamPage hiện có (tìm file test có `Nộp bài`/`NoteButton`, ví dụ `src/pages/ExamPage.test.tsx`), `src/pages/ResultPage.test.tsx` hoặc `src/pages/ResultGemini.test.tsx`

**Interfaces:**
- Consumes: `NoteButton` (Task 4).

- [ ] **Step 1: Write failing tests**
  - Thi thử: không còn nút `Ghi chú` trong `header.exam__bar`.
  - Có `.exam-dock` chứa nút `Ghi chú` (theo role/name) và nút `Hỏi Gemini` (khi có AI và đã đăng nhập), đúng thứ tự Ghi chú trước.
  - Không có AI thì `.exam-dock` chỉ có nút Ghi chú.
  - Bấm Ghi chú thì mở dialog `Ghi chú · Câu 1`.
  - Thi thật đang làm: không có nút Ghi chú.
  - Trang xem lại: bấm nút Ghi chú của một câu thì mở `NotePanel` của câu đó.
- [ ] **Step 2:** chạy các test đó → FAIL.
- [ ] **Step 3: Implement**
  - `ExamPage`:
    - Bỏ `NoteButton` khỏi `exam__bar-actions`, giữ nút nộp bài.
    - Thêm `<div className="exam-dock">` (chỉ Thi thử) chứa `<NoteButton key={aq.qid} qid={bank.canonical(aq.qid)} label={`Câu ${index + 1}`} question={question} className="btn-note--fab" compact={narrow} />` rồi tới `GeminiButton`. `GeminiButton` chuyển khỏi `.exam__assist`, phần `Xem hướng dẫn` ở lại.
    - `narrow` dùng `window.matchMedia('(max-width: 900px)')`, cùng điểm ngắt `.btn-gemini`/`.exam-fab` trong CSS, đặt thành hook nhỏ cạnh `useMobile`.
  - CSS:
    - `.exam-dock { position: fixed; right: 20px; bottom: 24px; z-index: 12; display: flex; gap: 10px; align-items: center; }`.
    - `.exam-dock .btn-gemini { position: static; }`.
    - `.btn-note--fab` cùng kiểu viên thuốc với `.btn-gemini`. Dưới 900px: `.exam-dock { right: 16px; }`, `.btn-note--fab` là nút tròn 56px.
    - Ở 320px, nút danh sách câu (`.exam-fab`, trái), nút Ghi chú và nút AI không chồng nhau ở vị trí mặc định. Kiểm tra bằng mắt ở bước 4.
  - `ResultPage`: truyền `question` cho `NoteButton`.
- [ ] **Step 4:** `npx vitest run src/pages` → PASS. Chạy `npm run dev`, mở một lượt Thi thử ở chiều rộng 1280px và 320px, rồi chụp màn hình kiểm tra vị trí ba nút nổi và bottom sheet có thanh kéo.
- [ ] **Step 5: Commit** `feat(exam): floating note button next to the AI button`

### Task 7: Nút đổi chế độ AI trong khung chat

**Files:**
- Modify: `src/components/GeminiChat.tsx`, `src/components/LocalAiMode.test.tsx`

**Interfaces:**
- Consumes: `openAfterSwitch`, `keyOf`, `aiMode`, `localAi`, `ai` trong `GeminiChat.tsx`; `RobotIcon`, `GeminiIcon`.

- [ ] **Step 1: Write failing tests** (`LocalAiMode.test.tsx`, dùng helper đang có với `withLocal`)
  - Khung Gemini mở có nút `Chuyển sang AI thử nghiệm`. Bấm thì `aiMode.get() === 'local'`, dialog chat vẫn mở, có nút `Chuyển sang Gemini`, và gửi tin thì `localAi.calls` tăng.
  - Bấm `Chuyển sang Gemini` thì về Gemini, khung vẫn mở.
  - Đang trả lời (`ai.hold = true` sau khi gửi) thì nút đổi chế độ disabled (Review Focus 3).
  - Không có `aiMode`/`localAi` thì không có nút.
  - Trang xem lại có 2 câu: đổi ở khung câu 2 thì chỉ khung câu 2 mở lại.
- [ ] **Step 2:** `npx vitest run src/components/LocalAiMode.test.tsx` → FAIL.
- [ ] **Step 3: Implement**
  - Trong `gemini__tools` (trước ⚙), khi `aiMode && localAi && ai`, thêm nút `icon-btn`:
    - Icon `RobotIcon` khi brand Gemini, `GeminiIcon` khi brand AI.
    - `aria-label`/`title` là `Chuyển sang AI thử nghiệm` hoặc `Chuyển sang Gemini`.
    - `disabled={busy}`.
    - onClick: `openAfterSwitch = keyOf(attemptId, question.id); aiMode.set(brand === 'Gemini' ? 'local' : 'gemini')`.
  - Sửa chú thích của `openAfterSwitch` cho cả hai chiều. `switchToLocal` có sẵn giữ nguyên.
- [ ] **Step 4:** `npx vitest run src/components` → PASS.
- [ ] **Step 5: Commit** `feat(ai): switch Gemini/local AI from the chat header`

### Task 8: Tài liệu và kiểm tra toàn bộ

**Files:**
- Modify: `CLAUDE.md` (mục `src/notes/` và mục `src/ai/`)

- [ ] **Step 1:** Cập nhật `CLAUDE.md`:
  - Nút Ghi chú nổi cạnh nút AI ở Thi thử mở `NotePanel` (danh sách + sửa/xóa + thêm).
  - `NoteForm` có AI hỗ trợ (`form-ai.ts`, job `kind: 'form'`, không toast, không gửi đáp án; ghi chú tự do chỉ gửi chữ đã gõ).
  - Ghi chú tự do `qid < 0` (`isFreeNote`, nhóm "Ghi chú chung"), tạo ở trang Ghi chú.
  - Nút đổi chế độ trong khung chat.
  - Bỏ câu "nút Ghi chú bên trái nút Nộp bài".
- [ ] **Step 2:** `npm run check` (PowerShell) → 0 lỗi validate, mọi test PASS, typecheck sạch. `npm run build` → OK.
- [ ] **Step 3: Commit** `docs: note panel, standalone notes, chat mode toggle`

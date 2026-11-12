# Ghi chú tiêu đề + nội dung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghi chú gồm tiêu đề + nội dung từ ba nguồn (tô đề, đánh dấu câu trả lời AI, tự ghi chú); trang Ghi chú liệt kê, tìm, sắp xếp, gộp tự do, sửa, xóa, mở khung xem câu (có đáp án + hướng dẫn).

**Architecture:** `QuestionNotes` thêm `items?: NoteItem[]`; logic thuần (thêm/sửa/xóa item, dựng danh sách mục, sắp xếp, gộp nhiều tầng, kiểm tra dung lượng) ở `src/notes/entries.ts` + `src/notes/model.ts`. UI: `NoteFormDialog` (tự ghi chú), nút bookmark trong `GeminiChat`, `ResultPage` bật tô đề + nút ghi chú, `NotesPage` viết lại.

**Tech Stack:** React + TypeScript, Vitest + Testing Library.

**Spec:** docs/superpowers/specs/2026-11-12-notes-title-content-design.md

## Global Constraints

- Lưu theo `bank.canonical(qid)`; giới hạn tiêu đề 200, nội dung item 10 000 ký tự; JSON một câu > 90 000 ký tự thì không lưu, báo `Ghi chú của câu này đã quá dài, hãy xóa bớt.`
- Được ghi chú khi: lượt Thi thử đang làm, hoặc lượt đã nộp (Thi thật lẫn Thi thử). Thi thật đang làm: không.
- Trang Ghi chú chỉ liệt kê đoạn tô có `note` không rỗng.
- Gộp tự do: tiêu chí `'set' | 'question' | 'source'`, thứ tự = thứ tự bật; sắp xếp `'newest' | 'oldest' | 'question'`; lưu localStorage key `saa-c03:notes-view:v1` (try/catch).
- Giao diện tiếng Việt, icon có `aria-label`, theme sáng/tối, điện thoại một cột. Kiểm tra mojibake (grep `ềE`, `�`) trước commit.
- Chạy test bằng PowerShell. Cuối cùng `npm run check` xanh, `npm run build` OK; cập nhật `CLAUDE.md` mục `src/notes/`.

## Review Focus

1. Bản ghi cũ không có `items` → trang và đồng bộ vẫn chạy (Task 1 test).
2. Đánh dấu câu trả lời AI hai lần → không tạo trùng, lần hai bỏ đánh dấu (Task 3 test).
3. Câu trùng (twin) giữa hai đề → một bản ghi theo canonical, nhãn câu lấy từ canonical (Task 1 test `noteLabel`).
4. Gộp theo câu hỏi khi chưa bật đề → nhóm theo câu, không bắt buộc đề (Task 1 test `groupEntries`).
5. Sửa ghi chú đoạn tô ở trang Ghi chú → chỉ sửa nội dung, tiêu đề vẫn là chữ trong đề (Task 4 test).

---

### Task 1: Mô hình + hàm thuần

**Files:** Modify `src/notes/model.ts` (+test). Create `src/notes/entries.ts`, `src/notes/entries.test.ts`.

**Interfaces (Produces):**
- `model.ts`: `NoteItem = { id: string; kind: 'ai' | 'manual'; title: string; content: string; createdAt: number; updatedAt: number }`; `QuestionNotes.items?: NoteItem[]`; `TITLE_MAX = 200`, `ITEM_CONTENT_MAX = 10_000`, `NOTES_JSON_MAX = 90_000`;
  `addItem(notes: QuestionNotes | undefined, qid: number, item: { kind; title; content }, id: string, now: number): QuestionNotes` (cắt giới hạn, trim tiêu đề);
  `updateItem(notes, id, patch: { title?: string; content?: string }, now): QuestionNotes`; `removeItem(notes, id, now): QuestionNotes`;
  `findItem(notes, kind, title, content): NoteItem | undefined`; `fitsLimit(notes: QuestionNotes): boolean` (`JSON.stringify(notes).length <= NOTES_JSON_MAX`).
  `store.list()` hiện lọc `highlights.length > 0` → đổi thành "có highlight hoặc có item".
- `entries.ts`:
  `type NoteSource = 'highlight' | 'ai' | 'manual'`;
  `NoteEntry = { key: string; qid: number; source: NoteSource; id: string; title: string; content: string; updatedAt: number }`;
  `toEntries(list: QuestionNotes[]): NoteEntry[]` (đoạn tô chỉ khi `note.trim() !== ''`; `key = \`${qid}:${id}\``);
  `noteSetId(qid: number, sets: SetsFile): number | null` (main ≥ 10000 → `Math.floor(qid/100)`; sub → id đề chứa qid trong `sets.sets[].questionIds`, không có → null);
  `noteLabel(qid, sets): string` (`setLabel(set) · Câu N` với N = vị trí trong đề / `qid%100` cho main; không đề → `Kho dự phòng · Câu ${qid}`);
  `sortEntries(entries, by: 'newest'|'oldest'|'question', sets): NoteEntry[]`;
  `type GroupKey = 'set' | 'question' | 'source'`;
  `interface EntryGroup { key: string; label: string; count: number; groups?: EntryGroup[]; entries?: NoteEntry[] }`;
  `groupEntries(entries, keys: GroupKey[], sets): EntryGroup[]` — đệ quy theo `keys`, giữ thứ tự mục đã sắp, thứ tự nhóm = thứ tự xuất hiện đầu tiên; nhãn: đề `setLabel`/`Kho dự phòng`, câu `noteLabel`, nguồn `Tô đề`/`Câu trả lời AI`/`Tự ghi chú`.
  `matchesEntry(e, needle, sets)` dùng `normalizeSearch` trên tiêu đề + nội dung + nhãn câu.

- [ ] **Step 1: Failing tests** — `addItem` cắt tiêu đề 200/nội dung 10 000, giữ highlights; `updateItem`/`removeItem` đổi `updatedAt`; `findItem`; `fitsLimit` false khi nội dung lớn; `toEntries` bỏ đoạn tô note rỗng, đọc bản ghi không có `items`; `noteSetId`/`noteLabel` cho sub trong đề, sub dự phòng, main (dùng `makeBank()`/`makeBank({ main: true })`); `sortEntries` ba kiểu; `groupEntries(e, ['question'])` một tầng theo câu; `['source','set']` hai tầng nguồn→đề, `count` đúng; `[]` → một nhóm? **Không**: `[]` trả `[]` và trang hiện danh sách phẳng; `store.list()` có bản chỉ có item.
- [ ] **Step 2:** `npx vitest run src/notes` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/notes` + `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(notes): note items (title + content), entries, sort and free grouping`.

### Task 2: Tự ghi chú + tô đề ở trang xem lại

**Files:** Create `src/notes/NoteFormDialog.tsx` (+test). Modify `src/pages/ExamPage.tsx`, `src/pages/ResultPage.tsx`, `src/styles.css`; tests `src/pages/ExamPanel.test.tsx` hoặc file test ExamPage hiện có, `src/pages/ResultPage*.test.tsx`.

**Interfaces:**
- Consumes: Task 1 `addItem`, `fitsLimit`, `TITLE_MAX`, `ITEM_CONTENT_MAX`, `newHighlightId` (dùng làm id).
- Produces: `NoteFormDialog({ qid: number /* canonical */, label: string, onClose: () => void, initial?: { title: string; content: string }, onSave?: (v: { title: string; content: string }) => boolean })` — mặc định (không `onSave`) thêm item `manual` vào `notes` store; tiêu đề rỗng → nút Lưu bị khóa; vượt `fitsLimit` → hiện câu báo, không đóng. Dialog `role="dialog"` tên "Ghi chú"; điện thoại dùng lớp bottom sheet như `.hl-sheet`.
  `NoteButton({ qid, label, className? })` — icon `IconNote` + chữ "Ghi chú", mở `NoteFormDialog`.

- [ ] **Step 1: Failing tests:** ExamPage Thi thử: header có nút "Ghi chú" đứng ngay trước nút Nộp bài (`t.end`); điền tiêu đề + nội dung, Lưu → `notes.get(canonical)` có item `manual`. Thi thật đang làm: không có nút. ResultPage (Thi thật đã nộp): mỗi câu có nút "Ghi chú"; `QuestionCard` có Highlighter (bôi chọn → thanh công cụ tô hiện, như test Highlighter hiện có).
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** Implement. ResultPage: `annotate={{ qid: bank.canonical(aq.qid), label: \`Câu ${index + 1}\`, target: (hl) => ({ page: 'attempt', attemptId: attempt.id, qid: aq.qid, highlightId: hl }) }}`; nút đặt cạnh `GeminiButton inline`.
- [ ] **Step 4:** test liên quan + typecheck → PASS.
- [ ] **Step 5:** Commit `feat(notes): manual notes and highlighting on the review page`.

### Task 3: Đánh dấu câu trả lời AI

**Files:** Modify `src/components/GeminiChat.tsx`, `src/components/icons.tsx` (thêm `IconBookmark` nếu chưa có), `src/styles.css`; test `src/components/GeminiChat.test.tsx`, `src/pages/ResultGemini.test.tsx`.

**Interfaces:** Consumes Task 1 `addItem`, `removeItem`, `findItem`, `fitsLimit`.

- [ ] **Step 1: Failing tests:** Thi thử: sau câu trả lời `ok` cho câu `Tại sao?`, tin AI có nút "Lưu vào ghi chú" (`aria-pressed=false`); bấm → item `ai` tiêu đề `Tại sao?` nội dung `ok`, nút `aria-pressed=true`, tên "Bỏ khỏi ghi chú"; bấm lần nữa → item bị xóa. Đang trả lời (hold) → chưa có nút. Trang xem lại Thi thật đã nộp: có nút và lưu được.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement: `canNote` = lượt (store) là Thi thử đang làm hoặc `status === 'submitted'`; tiêu đề = tin `user` gần nhất phía trước; đọc `notes` qua `useSyncExternalStore` để cập nhật trạng thái nút; vượt giới hạn → câu báo `role="alert"` trong khung chat.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(chat): bookmark AI answers into notes`.

### Task 4: Trang Ghi chú mới

**Files:** Rewrite `src/pages/NotesPage.tsx`, `src/pages/NotesPage.css`/styles; test `src/pages/NotesPage.test.tsx` (sửa test cũ theo giao diện mới).

**Interfaces:** Consumes Task 1 (entries, sort, group, match), Task 2 `NoteFormDialog` (sửa item: `initial` + `onSave` gọi `updateItem`), `GuidePanel`, `QuestionCard`, `Markdown`.

- [ ] **Step 1: Failing tests:**
  - Liệt kê mục từ cả ba nguồn, mới nhất trước; đoạn tô note rỗng không hiện; trống → "Chưa có ghi chú."
  - Tìm không dấu theo tiêu đề/nội dung.
  - Sắp xếp "Cũ nhất" đảo thứ tự.
  - Bật gộp "Câu hỏi" → nhóm theo câu (tiêu đề nhóm + số), không cần bật "Đề"; bật "Nguồn" rồi "Đề" → nhóm nguồn chứa nhóm đề; nút gộp hiện số tầng; chọn được nhớ sau khi render lại (localStorage).
  - Sửa item `manual`: đổi tiêu đề + nội dung, Lưu → store cập nhật; sửa mục đoạn tô: chỉ có ô nội dung → `note` đổi, `text` giữ.
  - Xóa: item bị xóa; mục đoạn tô → highlight bị xóa.
  - "Mở câu hỏi" → dialog có đề, đáp án đúng được tô (`reveal`) và `GuidePanel` ("Hướng dẫn"); đóng được.
  - Toast đích `{ page: 'notes', qid, highlightId }` (dùng `aiGate.requestOpen`) → dialog câu đó mở và popup đoạn tô mở.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. Nội dung AI hiện bằng `Markdown`; khác giữ xuống dòng (`white-space: pre-wrap`).
- [ ] **Step 4:** `npm run check` + `npm run build` → PASS; cập nhật `CLAUDE.md`.
- [ ] **Step 5:** Commit `feat(notes): notes page with search, sort, free grouping, edit and question dialog`.

# Danh sách chat, Gemini ở trang xem lại, tool mở hướng dẫn, favicon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hoàn thiện danh sách "Trò chuyện cũ" (lọc/tìm/đổi tên), thêm Gemini ở trang xem lại bài, thay "chữ đầu tiên mở hướng dẫn" bằng tool `open_guide` kèm dữ liệu đối chiếu, thêm favicon.

**Architecture:** Prompt và tool mới ở `src/ai/` (hàm thuần, có test); `ChatHistoryStore` thêm `rename` + `title`; `GeminiChat.tsx` đổi `onFirstReply` thành `onOpenGuide`/`revealed`, thêm biến thể nút inline cho `ResultPage`, và một bộ điều phối "chỉ một khung mở".

**Tech Stack:** React 18 + TS, Vitest + Testing Library, `firebase@13.1.0`.

**Spec:** [docs/superpowers/specs/2026-11-03-chat-list-design.md](../specs/2026-11-03-chat-list-design.md)

## Global Constraints

- Chỉ `src/ai/gemini.ts` import `firebase/ai`; chỉ `src/sync/firebase.ts` import `firebase/database`. Không sửa `database.rules.json`.
- Tool mới tên đúng `open_guide`; chỉ gửi khi lượt là Thi thử `in-progress`.
- Không còn `markGuideOpened` khi có chữ đầu tiên.
- Lượt đã nộp không bao giờ bị sửa từ khung chat.
- Prompt không dùng nhãn A/B/C gốc: phần giải thích VI đổi sang nhãn hiển thị theo `order`.
- `save` dùng `update` (giữ `title`); tên tối đa 100 ký tự; đổi tên không đổi `updatedAt`.
- Tìm kiếm: không phân biệt hoa thường và dấu; khớp tên hiển thị, tên mặc định, `formatDate(updatedAt)`; khi có chữ thì bỏ qua lọc.
- `npm run check` pass trước mỗi commit.

## Review Focus

1. Câu không có `data/vi` (câu main, câu sub chưa soạn) → prompt không có phần VI, không lỗi.
2. Gemini gọi `open_guide` khi hướng dẫn đã mở → không lưu lại lượt (không đổi gì).
3. Đổi tên với chuỗi toàn khoảng trắng → coi như xóa tên.
4. Mở khung ở câu A rồi bấm nút ở câu B trên trang xem lại → khung A đóng, chỉ còn B.
5. Lưu lịch sử sau khi đã đổi tên → tên vẫn còn.

---

### Task 1: Prompt đối chiếu + tool `open_guide`, bỏ mở hướng dẫn khi có chữ đầu

**Files:** `src/ai/prompt.ts`, `src/ai/prompt.test.ts`, create `src/ai/guide-tool.ts` (+ test), `src/ai/gemini.ts`, `src/components/GeminiChat.tsx`, `src/components/GeminiChat.test.tsx`, `src/pages/ExamPage.tsx`

**Interfaces:**
- `buildSystemPrompt(question: Question, order: string[], extra?: { vi?: QuestionVi; note?: string; revealed?: boolean }): string`
- `export const OPEN_GUIDE_TOOL = 'open_guide'; export function createGuideTool(open: () => void): AiTool` — `params: {}`, `run` gọi `open()` rồi trả `{ opened: true }`.
- `GeminiButton` Props: bỏ `onFirstReply`; thêm `onOpenGuide?: () => void` và `revealed?: boolean`. `Target` tương tự.
- `gemini.ts` `declare()`: tool không có tham số thì bỏ `parameters`.

- [ ] Test (RED): prompt có giải thích VI theo nhãn hiển thị (`order` đảo → lý do của key gốc `B` đứng sau nhãn hiển thị tương ứng), có `note`, có cờ `review`; không có vi thì không có mục "Giải thích tiếng Việt"; `revealed: false` có câu dặn không nói đáp án và `open_guide`; `revealed: true` có "đã thấy đáp án". `guide-tool.test.ts`: `run` gọi `open` và trả `{ opened: true }`. `GeminiChat.test.tsx`: thay 3 test "chữ đầu tiên…" bằng: có chữ trả lời thì **không** gắn nhãn; `s.ai.toolCalls = [{ name: 'open_guide', args: {} }]` → câu được gắn nhãn và khung hướng dẫn hiện; tools gửi cho `startChat` gồm `find_answered_questions` và `open_guide`. Cập nhật test chạy nền và test cuộc trò chuyện cũ không còn kỳ vọng nhãn từ chữ đầu.
- [ ] Test thêm (RED): đang chat, người học bấm nút hướng dẫn của trang → lần gửi sau `s.ai.calls.length === 2` và prompt mới chứa "đã thấy đáp án".
- [ ] Cài đặt; `ExamPage` truyền `onOpenGuide`; `Conversation` nhớ `revealed` của phiên, khác `target.revealed` thì bỏ `chatRef` để mở phiên mới (bản mới nhất trong store → `markGuideOpened`) và `revealed`.
- [ ] `npm run check` → PASS; commit `feat(ai): open_guide tool and answer cross-check context`.

### Task 2: Dữ liệu tên cuộc trò chuyện

**Files:** `src/ai/types.ts`, `src/sync/firebase.ts`, `src/test/fake-ai.ts`, test mới `src/test/fake-ai.test.ts` không cần — kiểm qua UI ở Task 3.

**Interfaces:** `ChatSummary.title?: string`; `ChatHistoryStore.rename(uid, attemptId, qid, title: string | null): Promise<void>`; `fakeChats` có `titles: Map<string,string>`, `renameError?: Error`, `save` giữ title (như `update`).

- [ ] Cài đặt (`firebase.ts`: `save` → `update(chatRef, { json, updatedAt })`; `rename` → `set(child(chatRef,'title'), title)`; `list` đọc `title` chuỗi).
- [ ] `npm run check` → PASS; commit `feat(sync): chat titles`.

### Task 3: Danh sách lọc / tìm / đổi tên

**Files:** `src/components/GeminiChat.tsx`, `src/components/GeminiChat.test.tsx`, `src/styles.css`

**Interfaces:** hàm thuần trong `GeminiChat.tsx` (export để test nếu cần): `normalizeSearch(s: string): string` (bỏ dấu, `đ→d`, lowercase, gộp khoảng trắng).

- [ ] Test (RED): mặc định chỉ hiện chat cùng `qid` + cùng `setId` (chat câu khác cùng đề và chat cùng `qid` ở đề khác không hiện), trống thì "Chưa có cuộc trò chuyện nào về câu này."; bỏ chọn "Chỉ câu này" → có tiêu đề nhóm "Đề 1"; tìm "cau 3" (không dấu) ra "Đề 1 · Câu 3" dù đang lọc; tìm ngày; không có kết quả → "Không tìm thấy cuộc trò chuyện nào."; đổi tên: ✎ → nhập → Enter → hiện tên mới + tên mặc định phụ, `fakeChats.titles` có tên; Esc hủy; chuỗi rỗng → xóa tên; `renameError` → báo "Không đổi được tên." và giữ tên cũ; mục câu đang làm chưa có lịch sử không có ✎; lưu lịch sử sau đổi tên không mất tên.
- [ ] Cài đặt theo spec (nhóm theo hoạt động gần nhất; mục câu đang làm chỉ ghim khi lọc + ô tìm trống).
- [ ] `npm run check` → PASS; commit `feat(ui): filter, search and rename old chats`.

### Task 4: Gemini ở trang xem lại + một khung mở + favicon

**Files:** `src/components/GeminiChat.tsx`, `src/pages/ResultPage.tsx`, test `src/pages/ResultPage.test.tsx` (hoặc file test hiện có của trang), `src/styles.css`, create `public/favicon.svg`, `index.html`, `CLAUDE.md`

**Interfaces:** Props `inline?: boolean` (class `btn-gemini btn-gemini--inline`, không `position: fixed`). Bộ điều phối module-level: mở một `Launcher` thì phát id, các `Launcher` khác đóng.

- [ ] Test (RED): trang xem lại (đăng nhập + có ai) có nút "Hỏi Gemini" ở mỗi câu; không đăng nhập thì không có; lượt Thi thật đã nộp: mở câu 1, gửi → lưu `u1/<attemptId>/<qid>`, lượt không đổi; `startChat` không có tool `open_guide`; mở câu 2 thì chỉ còn một dialog.
- [ ] Cài đặt; favicon SVG (navy `#232f3e`, cam `#ff9900`, chữ "SAA"); `index.html` `<link rel="icon" type="image/svg+xml" href="./favicon.svg">`; cập nhật mục `src/ai/` trong CLAUDE.md.
- [ ] `npm run check` → PASS; commit `feat(ui): Gemini on the review page, single chat panel, favicon`.

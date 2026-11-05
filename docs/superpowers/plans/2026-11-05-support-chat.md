# Khung chat hỗ trợ "Liên hệ admin" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người học nhắn cho admin (`buihngocanh2@gmail.com`) từ menu tài khoản hoặc từ nút "Liên hệ admin" cạnh câu báo lỗi (lỗi đính kèm, chỉ gửi khi bấm Gửi); admin đọc/trả lời trong "Hộp thư hỗ trợ".

**Architecture:** Hàm thuần + kiểu dữ liệu ở `src/support/`; một store `SupportStore` (adapter Firebase trong `src/sync/firebase.ts`, bản giả `src/test/fake-support.ts`) đi qua `AppDeps.support`. Một `SupportDock` gắn trong `Layout` hiện khung chat (người học) hoặc hộp thư (admin), mở từ bất kỳ đâu qua `openSupport()`. Hai nhánh database mới `support/` và `supportIndex/`, rules riêng; `users/` không đổi.

**Tech Stack:** Vite + React 18 + TypeScript, Vitest + Testing Library, Firebase Auth + Realtime Database (modular SDK).

**Spec:** [docs/superpowers/specs/2026-11-05-support-chat-design.md](../specs/2026-11-05-support-chat-design.md)

## Global Constraints

- Admin = `auth.token.email === 'buihngocanh2@gmail.com' && auth.token.email_verified === true` (rules); web dùng cùng điều kiện từ `SyncUser.email` + `SyncUser.emailVerified`.
- Không tự động gửi lỗi; chỉ gửi khi người học bấm Gửi.
- Admin không đọc được `users/**`; rules của `users/` giữ nguyên từng ký tự.
- Giới hạn: `text` ≤ 4000; `error.message` ≤ 1000; `error.code` ≤ 100; `error.page` ≤ 500; `name` ≤ 100; `email` ≤ 200; `last` ≤ 80.
- Tin đã gửi không sửa/xóa (`!data.exists()`); người học ~1 tin / 3 giây (`updatedAt` mới ≥ cũ + 3000, ≤ `now` + 60000).
- Chỉ `src/sync/firebase.ts` import Firebase SDK. UI lấy store qua `useApp()`.
- Màn hình Thi thật chữ tiếng Anh (`english` prop như `AccountMenu`), trang khác tiếng Việt.
- Tiêu đề mailto: `Lỗi trên web luyện thi SAA-C03`.
- Mỗi lúc một khung chat: mở khung hỗ trợ thì khung Hỏi Gemini/AI đóng, và ngược lại.
- Chạy `npm run check` trước mỗi commit; commit message kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Người học gửi khi mất mạng / rules từ chối → chữ còn trong ô, hiện câu báo + link mailto (test ở Task 5).
- Lỗi đính kèm rất dài (> 1000 ký tự) hoặc page dài → bị cắt, không làm rules từ chối (test ở Task 2).
- Admin mở cuộc trò chuyện của người chưa có `supportIndex` (hiếm, dữ liệu dở) → không tạo bản ghi rỗng, không crash (test ở Task 3, fake `markRead` bỏ qua).
- Đăng xuất / đổi tài khoản khi khung đang mở → khung đóng, không gửi tin dưới uid cũ (test ở Task 5).
- Bấm "Liên hệ admin" lần hai với lỗi khác khi khung đang mở → thẻ đính kèm đổi sang lỗi mới, chữ đang gõ giữ nguyên (test ở Task 5).

---

### Task 1: Nhận diện admin và email của user

**Files:**
- Create: `src/support/admin.ts`, `src/support/admin.test.ts`
- Modify: `src/sync/types.ts` (`SyncUser`), `src/sync/firebase.ts` (`onUserChanged`)

**Interfaces:**
- Produces: `ADMIN_EMAIL = 'buihngocanh2@gmail.com'`; `isAdmin(user: SyncUser | null | undefined): boolean`; `SyncUser` thêm `email?: string; emailVerified?: boolean`.

- [ ] **Step 1: Test `isAdmin`** — `src/support/admin.test.ts`:
  - `isAdmin({ uid: 'a', name: 'x', email: 'buihngocanh2@gmail.com', emailVerified: true })` → `true`
  - email đúng nhưng `emailVerified: false` hoặc thiếu → `false`
  - email `'BUIHNGOCANH2@gmail.com'` + verified → `true` (so không phân biệt hoa thường)
  - email khác, `null`, `undefined` → `false`
- [ ] **Step 2:** `npx vitest run src/support/admin.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Viết `admin.ts`; thêm hai trường vào `SyncUser`; adapter điền `email: u.email ?? undefined, emailVerified: u.emailVerified`.
- [ ] **Step 4:** Test PASS; `npm run typecheck` sạch.
- [ ] **Step 5: Commit** `feat(support): admin identity from verified email`

### Task 2: Kiểu dữ liệu và hàm thuần

**Files:**
- Create: `src/support/model.ts`, `src/support/model.test.ts`

**Interfaces:**
- Produces:
  - `interface ErrorReport { message: string; code?: string; page: string; at: number }`
  - `interface SupportMessage { id: string; from: 'user' | 'admin'; text: string; at: number; error?: ErrorReport }`
  - `interface SupportThread { uid: string; name: string; email?: string; updatedAt: number; last: string; lastFrom: 'user' | 'admin'; unreadByAdmin: boolean; unreadByUser: boolean }`
  - `const LIMITS = { text: 4000, errorMessage: 1000, errorCode: 100, page: 500, name: 100, email: 200, last: 80 }`
  - `makeErrorReport(input: { message: string; code?: string }, page: string, at: number): ErrorReport` — cắt theo LIMITS, bỏ `code` rỗng.
  - `lastText(text: string, error?: ErrorReport): string` — gộp khoảng trắng, cắt ≤ 80 ký tự + `…`; text rỗng mà có lỗi → `⚠ ${error.message}` (cắt).
  - `mailtoHref(error?: ErrorReport): string` — `mailto:buihngocanh2@gmail.com?subject=…&body=…`, `encodeURIComponent`; body gồm các dòng `Lỗi: …`, `Mã: …` (nếu có), `Trang: …`, `Lúc: <ISO>`; không có lỗi thì body rỗng.

- [ ] **Step 1: Tests** — `model.test.ts`:
  - `makeErrorReport({ message: 'x'.repeat(1200), code: '' }, '#/a', 5)` → `message.length === 1000`, không có key `code`, `page === '#/a'`, `at === 5`.
  - page dài 600 ký tự → cắt còn 500.
  - `lastText('  a\n b  ')` → `'a b'`; text 100 ký tự → dài 81 và kết thúc `…`; `lastText('', { message: 'Hỏng', page: '#/', at: 0 })` → `'⚠ Hỏng'`.
  - `mailtoHref(makeErrorReport({ message: 'Không lưu được', code: 'auth/x' }, '#/exam/1', Date.UTC(2026, 10, 5)))` bắt đầu bằng `mailto:buihngocanh2@gmail.com?subject=` và `decodeURIComponent` của phần body chứa `Lỗi: Không lưu được`, `Mã: auth/x`, `Trang: #/exam/1`, `2026-11-05T00:00:00.000Z`.
  - `mailtoHref()` có subject `Lỗi trên web luyện thi SAA-C03`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(support): message model and mailto helper`

### Task 3: SupportStore, adapter Firebase, bản giả, rules

**Files:**
- Create: `src/support/types.ts`, `src/test/fake-support.ts`, `src/test/fake-support.test.ts`
- Modify: `src/sync/firebase.ts` (thêm `support` vào kết quả `createFirebaseClients`), `src/app/context.tsx` (`AppDeps.support?: SupportStore`), `src/main.tsx` (truyền `clients?.support`), `database.rules.json`

**Interfaces:**
- Consumes: Task 2 types.
- Produces (`src/support/types.ts`):
  ```ts
  export interface SupportStore {
    /** Tin của một cuộc trò chuyện, theo thứ tự `at`; gọi lại mỗi khi đổi. */
    listenThread(uid: string, cb: (messages: SupportMessage[]) => void, onError: (e: Error) => void): () => void;
    /** Bản ghi supportIndex của chính uid (null nếu chưa có) — cho chấm chưa đọc. */
    listenOwnIndex(uid: string, cb: (thread: SupportThread | null) => void): () => void;
    /** Admin: mọi cuộc trò chuyện, mới nhất trước. */
    listenInbox(cb: (threads: SupportThread[]) => void, onError: (e: Error) => void): () => void;
    /** Ghi tin + cập nhật supportIndex/{uid} trong một update nhiều đường dẫn. */
    send(uid: string, msg: { from: 'user' | 'admin'; text: string; error?: ErrorReport }, who: { name: string; email?: string }): Promise<void>;
    /** Đặt unreadByUser/unreadByAdmin = false (đường dẫn con); bỏ qua nếu chưa có bản ghi. */
    markRead(uid: string, reader: 'user' | 'admin'): Promise<void>;
  }
  ```
  - `send` từ `'user'`: đặt `name`, `email` (chỉ khi người gửi là user), `updatedAt`, `last`, `lastFrom`, `unreadByAdmin: true`. Từ `'admin'`: không đụng `name`/`email`, đặt `unreadByUser: true`. `at`/`updatedAt` = `serverTimestamp()`.
  - Fake: `fakeSupport()` lưu trong bộ nhớ, gọi listener đồng bộ, có `sendError?: Error` (lần send kế tiếp ném), `sent: {uid, msg}[]`.

- [ ] **Step 1: Test fake** (`fake-support.test.ts`) để chốt hành vi mà UI test dựa vào: user send → `listenThread` nhận 1 tin, `listenInbox` có thread `unreadByAdmin: true`, `last` theo `lastText`; admin send → `unreadByUser: true`, `name` giữ nguyên; `markRead('u9','admin')` khi chưa có thread không tạo thread; `sendError` làm `send` reject và không ghi gì.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Viết `types.ts`, fake, adapter (dùng `push` để lấy key, `update(ref(db), {...})`, `onValue`, `query(ref(db,'supportIndex'), orderByChild('updatedAt'))`), nối `AppDeps`/`main.tsx`. **Step 4:** Run → PASS, typecheck sạch.
- [ ] **Step 5: Rules** — thêm vào `database.rules.json` (cạnh `users`, không sửa `users`), với `ADMIN` = `auth.token.email === 'buihngocanh2@gmail.com' && auth.token.email_verified === true`:
  - `support/$uid`: `.read`: `auth != null && (auth.uid === $uid || ADMIN)`; `messages/$id`: `.write`: `auth != null && !data.exists() && ((newData.child('from').val() === 'user' && auth.uid === $uid) || (newData.child('from').val() === 'admin' && ADMIN))`; `.validate` các trường (`from` ∈ user/admin, `text` string ≤ 4000, `at` number ≤ now + 60000, `error` tùy chọn với `message` ≤ 1000, `code` ≤ 100, `page` ≤ 500, `at` number), `$other` false.
  - `supportIndex`: `.read`: `ADMIN`, `.indexOn`: `["updatedAt"]`; `supportIndex/$uid`: `.read`/`.write`: `auth != null && (auth.uid === $uid || ADMIN)`; con: `name` string ≤ 100; `email` string ≤ 200 và (ADMIN hoặc `=== auth.token.email`); `updatedAt` number ≤ now + 60000 và (ADMIN hoặc `!data.exists()` hoặc `newData.val() >= data.val() + 3000`); `last` ≤ 80; `lastFrom` ∈ user/admin; `unreadByAdmin`/`unreadByUser` boolean; `$other` false.
  - Kiểm tra JSON hợp lệ: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'))"`.
- [ ] **Step 6:** `java -version`. Có Java: thêm `firebase-tools` + `@firebase/rules-unit-testing` (devDependencies), script `npm run test:rules` chạy emulator, test 6 ca ở Step 7. Không có Java: bỏ qua, ghi 6 ca vào docs ở Task 8.
- [ ] **Step 7 (ca rules bắt buộc):** A đọc/ghi `support/B` → từ chối; người thường đọc `supportIndex` → từ chối; tài khoản `email_verified: false` email admin đọc `supportIndex` → từ chối; người học ghi tin `from: 'admin'` → từ chối; ghi đè tin đã có → từ chối; admin đọc `users/B/attempts` → từ chối.
- [ ] **Step 8: Commit** `feat(support): support store, firebase adapter and rules`

### Task 4: Điều phối mở khung (một khung chat mỗi lúc)

**Files:**
- Create: `src/components/chat-focus.ts`, `src/support/open.ts`, `src/support/open.test.ts`
- Modify: `src/components/GeminiChat.tsx` (thay `openListeners` cục bộ bằng `chat-focus`)

**Interfaces:**
- Produces:
  - `chat-focus.ts`: `claimChatFocus(id: string): void` (báo mọi người nghe khác đóng), `onChatFocus(listener: (id: string) => void): () => void`.
  - `open.ts`: `type SupportRequest = { error?: ErrorReport }`; `openSupport(req?: SupportRequest): void`; `onOpenSupport(listener: (req: SupportRequest) => void): () => void`; `errorReportHere(input: { message: string; code?: string }): ErrorReport` (dùng `location.hash || '#/'` và `Date.now()`).

- [ ] **Step 1: Test** `open.test.ts`: `onOpenSupport` nhận đúng `req`; hủy đăng ký thì không nhận; `claimChatFocus('a')` gọi listener với `'a'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; đổi `GeminiChat.tsx` dùng `claimChatFocus`/`onChatFocus` (giữ nguyên hành vi). **Step 4:** `npx vitest run src/support src/components/GeminiChat.test.tsx src/components/LocalAiMode.test.tsx` → PASS.
- [ ] **Step 5: Commit** `refactor(chat): shared chat focus; openSupport channel`

### Task 5: Khung chat của người học

**Files:**
- Create: `src/components/SupportDock.tsx`, `src/components/SupportDock.test.tsx`
- Modify: `src/components/Layout.tsx` (gắn `<SupportDock english={english} />`), `src/styles.css`

**Interfaces:**
- Consumes: `SupportStore` (Task 3), `openSupport`/`onOpenSupport`, `claimChatFocus`/`onChatFocus` (Task 4), `isAdmin` (Task 1), `lastText`/`mailtoHref` (Task 2), `signedInUser` (từ `GeminiChat.tsx`).
- Produces: `SupportDock({ english }: { english: boolean })` — không render gì khi không có `sync`/`support` hoặc chưa đăng nhập; mở khi có `openSupport`; người thường thấy `SupportThreadView`, admin thấy hộp thư (Task 6). Export `SupportThreadView({ uid, reader, title, onBack? })` để Task 6 dùng lại.

- [ ] **Step 1: Tests** (render app bằng `renderApp` + `fakeSupport` + sync giả đã đăng nhập `{ uid: 'u1', name: 'An', email: 'an@x.com', emailVerified: true }`):
  - `act(() => openSupport())` → dialog tên `Liên hệ admin`; gõ "Xin chào" + Gửi → `support.sent[0]` = `{ uid: 'u1', msg: { from: 'user', text: 'Xin chào' } }`; tin hiện bên phải (class `gemini__msg--user`).
  - `openSupport({ error: report })` → thẻ `⚠ Lỗi đính kèm: <message>`; bấm "Gỡ lỗi đính kèm" → thẻ biến mất; mở lại với lỗi, Gửi khi ô trống → gửi `{ text: '', error: report }`; sau khi gửi thẻ biến mất.
  - Đang gõ "abc", gọi `openSupport({ error: other })` → ô vẫn `abc`, thẻ hiện lỗi mới.
  - `support.sendError = new Error('denied')` → Gửi → ô vẫn giữ chữ, `role="alert"` chứa `Không gửi được` và có link `href` bắt đầu `mailto:buihngocanh2@gmail.com`.
  - Tin admin từ fake → hiện bên trái; mở khung → `markRead('u1','user')` đã gọi.
  - Mở khung Hỏi AI/Gemini thì khung hỗ trợ đóng; `openSupport()` khi khung Gemini mở thì khung Gemini đóng.
  - Đăng xuất khi khung mở → dialog biến mất, không gọi `send`.
  - Màn hình Thi thật: tiêu đề `Contact admin`, nút `Send`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (dùng lại class `gemini-dock`, `gemini__log`, `gemini__msg`, `gemini__form` cho giống Hỏi AI; Esc/✕ đóng; tin có `error` hiện khối lỗi: câu báo, mã, trang, giờ). **Step 4:** Run → PASS; `npm run check`.
- [ ] **Step 5: Commit** `feat(support): user support chat dock`

### Task 6: Hộp thư của admin

**Files:**
- Create: `src/components/SupportInbox.tsx`, `src/components/SupportInbox.test.tsx`
- Modify: `src/components/SupportDock.tsx` (admin → `SupportInbox`)

**Interfaces:**
- Consumes: `SupportThreadView` (Task 5), `SupportStore.listenInbox`, `markRead`.
- Produces: `SupportInbox({ english })`.

- [ ] **Step 1: Tests** (user admin `{ uid: 'adm', email: 'buihngocanh2@gmail.com', emailVerified: true }`; fake có thread của `u1` và `u2`, `u2` mới hơn và `unreadByAdmin`):
  - `openSupport()` → dialog `Hộp thư hỗ trợ`, danh sách `u2` trước `u1`, dòng `u2` có chấm chưa đọc, hiện tên, email, `last`.
  - Bấm `u2` → mở cuộc trò chuyện, `markRead('u2','admin')`; trả lời "Đã sửa" → `sent` có `{ uid: 'u2', msg: { from: 'admin', text: 'Đã sửa' } }`; nút `← Danh sách` quay lại.
  - Danh sách rỗng → `Chưa có cuộc trò chuyện nào.`
- [ ] **Step 2–4:** FAIL → implement → PASS; `npm run check`.
- [ ] **Step 5: Commit** `feat(support): admin inbox`

### Task 7: Mục trong menu tài khoản

**Files:**
- Modify: `src/components/AccountMenu.tsx`, `src/components/AccountMenu.test.tsx`

**Interfaces:**
- Consumes: `openSupport`, `isAdmin`, `SupportStore.listenOwnIndex`, `listenInbox`.

- [ ] **Step 1: Tests:**
  - Người thường đã đồng bộ: nút `💬 Liên hệ admin` gọi mở khung (dialog `Liên hệ admin` xuất hiện); `listenOwnIndex` báo `unreadByUser: true` → nút có nhãn phụ `(có tin mới)` (aria-label `Liên hệ admin, có tin mới`).
  - Admin: nút `📥 Hộp thư hỗ trợ (2)` khi 2 thread `unreadByAdmin`; không có `Liên hệ admin`.
  - Không có `support` trong deps → không có hai mục này.
  - Thi thật: `💬 Contact admin`, `📥 Support inbox`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(support): account menu entries`

### Task 8: Nút "Liên hệ admin" ở các chỗ báo lỗi + tài liệu

**Files:**
- Create: `src/components/ContactAdminButton.tsx`, `src/components/ContactAdminButton.test.tsx`
- Modify: `src/components/AccountMenu.tsx` (lỗi `state.kind === 'error'`), `src/components/SignInDialog.tsx` (lỗi form), `src/components/GeminiChat.tsx` (`failMessage`/`sendFailed`, `loadFailed`, `saveFailed`), `src/components/LocalSettingsDialog.tsx` (lưu lỗi), `docs/firebase-setup.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `openSupport`, `errorReportHere`, `mailtoHref`, `signedInUser`.
- Produces: `ContactAdminButton({ message, code, english }: { message: string; code?: string; english?: boolean })` — đã đăng nhập (sync có user) và có `support`: `<button>` gọi `openSupport({ error: errorReportHere({ message, code }) })`; ngược lại `<a href={mailtoHref(errorReportHere(...))}>`. Nhãn `Liên hệ admin` / `Contact admin`.

- [ ] **Step 1: Tests:**
  - `ContactAdminButton` khi đăng nhập → bấm mở dialog `Liên hệ admin` có thẻ lỗi đúng `message`; khi chưa đăng nhập → là link, `href` chứa `mailto:` và message đã mã hóa; không có Firebase → link.
  - Mỗi chỗ trong bảng của spec có nút: AccountMenu lỗi (link mailto); SignInDialog lỗi `Email hoặc mật khẩu không đúng.` (link mailto); Hỏi AI gửi lỗi `LOCAL_CONNECT_ERROR` → nút mở khung với lỗi đó (và khung Hỏi AI đóng); LocalSettingsDialog lưu lỗi → nút.
- [ ] **Step 2–4:** FAIL → implement → PASS; `npm run check`.
- [ ] **Step 5: Docs:** `docs/firebase-setup.md` thêm mục "Hỗ trợ (Liên hệ admin)": publish lại rules; đăng nhập admin bằng Google (email đã xác nhận); 6 ca kiểm tra rules ở Task 3 Step 7 cho Rules Playground nếu chưa có emulator test. `CLAUDE.md` mục Kiến trúc: một dòng về `src/support/`, `support/`, `supportIndex/`, `SupportDock`.
- [ ] **Step 6: Commit** `feat(support): contact admin buttons on error notices; docs`

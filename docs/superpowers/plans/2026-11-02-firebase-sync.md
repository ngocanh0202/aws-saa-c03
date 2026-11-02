# Đồng bộ Firebase (đăng nhập Google) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đăng nhập Google để lượt thi được lưu lên Firebase Realtime Database và đồng bộ realtime giữa các thiết bị. Chưa đăng nhập thì web chạy bằng `localStorage` như hiện nay.

**Architecture:** `AttemptStore` (`localStorage`) trở thành nguồn dữ liệu duy nhất mà UI đọc. Store được gắn thêm metadata (`owner`, `updatedAt`), có thể lắng nghe thay đổi (`subscribe`), và lọc theo tài khoản đang xem. Một `SyncController` thuần TypeScript nối store với hai interface nhỏ, `AuthClient` và `RemoteAttempts`. Quy tắc gộp nằm trong hàm thuần `src/sync/merge.ts`. Chỉ `src/sync/firebase.ts` import Firebase SDK, nên test dùng bản giả và không bao giờ gọi mạng.

**Tech Stack:** Vite 8 + React 19 + TypeScript + Vitest/Testing Library, `firebase` (modular SDK: `firebase/app`, `firebase/auth`, `firebase/database`).

**Spec:** [docs/superpowers/specs/2026-11-02-firebase-sync-design.md](../specs/2026-11-02-firebase-sync-design.md). Đọc spec trước khi làm bất kỳ task nào.

## Global Constraints

- Cấu trúc dữ liệu trên cloud: `/users/{uid}/attempts/{attemptId} = { json: string /* JSON.stringify(Attempt) */, updatedAt: number }`.
- Key metadata trong `localStorage`: `saa-c03:owners:v1`, giá trị `{ [attemptId]: { owner?: string; updatedAt: number } }`. Key lượt thi `saa-c03:attempts:v1` và kiểu `Attempt` **giữ nguyên**.
- Biến môi trường: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Thiếu bất kỳ biến nào thì tắt đồng bộ và ẩn nút đăng nhập.
- Đăng nhập bằng `signInWithPopup` với `GoogleAuthProvider`.
- Nội dung chữ trên UI bằng tiếng Việt. Riêng màn hình Thi thật (`/exam/:id` với `mode === 'real'`) dùng tiếng Anh: "Sign in with Google", "Sign out".
- Không đồng bộ theme. Không lưu nội dung đề lên cloud.
- Code của file test và Vitest **không bao giờ** import `firebase/*` hay `src/sync/firebase.ts`.
- Tên test viết bằng tiếng Việt, theo phong cách các file `*.test.ts(x)` hiện có. Chạy `npm run check` trước mỗi commit.

## Review Focus

1. **Máy offline giữ bản `in-progress` cũ trong khi lượt đó đã nộp hoặc hết giờ ở máy khác:** bản `submitted` phải thắng, lượt thi không được "hồi sinh". Test ở Task 3 (`pickWinner`) và Task 4 (controller).
2. **Đăng xuất tài khoản A rồi đăng nhập B trên cùng máy:** lượt thi của A bị ẩn, không bị xóa, không bị đẩy lên B và không gây hộp thoại xung đột. Đăng nhập lại A thì thấy lại. Test ở Task 1 (lọc theo viewer) và Task 4.
3. **Tải lại trang trước khi chọn trong hộp thoại xung đột:** dữ liệu khách không đổi, không có gì bị đẩy lên, và hộp thoại hiện lại. Test ở Task 4.
4. **Lượt thi đang mở trên máy này bị đổi hoặc nộp từ máy khác:** `ExamPage` phải hiện ngay đáp án mới, và chuyển sang trang kết quả khi lượt thi đã bị nộp. Test ở Task 2.
5. **Thiếu cấu hình Firebase (chạy dev không có `.env.local`, chạy test):** web chạy như cũ, không có nút đăng nhập, không lỗi. Test ở Task 5 (Layout) và Task 6 (`readFirebaseConfig`).

---

### Task 1: Store có metadata, lắng nghe được và lọc theo tài khoản

**Files:**
- Modify: `src/storage/storage.ts`
- Test: `src/storage/storage.test.ts`

**Interfaces:**
- Produces (export từ `src/storage/storage.ts`):
  ```ts
  export const OWNERS_KEY = 'saa-c03:owners:v1';
  export interface RecordMeta { owner?: string; updatedAt: number }
  export interface StoreEntry { attempt: Attempt; meta: RecordMeta }
  export interface AttemptStore {
    readonly available: boolean;
    list(): Attempt[];                 // đã lọc theo viewer
    get(id: string): Attempt | undefined; // đã lọc theo viewer
    save(attempt: Attempt): boolean;   // lưu cục bộ: meta = { owner: viewer ?? undefined, updatedAt: now() }; gọi onSave + subscribe
    version(): number;                 // tăng mỗi khi dữ liệu thấy được có thể đã đổi
    subscribe(listener: () => void): () => void;
    onSave(listener: (entry: StoreEntry) => void): () => void; // CHỈ khi gọi save()
    setViewer(uid: string | null): void;
    entries(): StoreEntry[];           // tất cả, KHÔNG lọc
    put(entry: StoreEntry): void;      // ghi từ đồng bộ: không gọi onSave, có gọi subscribe
    remove(ids: string[]): void;
  }
  export function looksLikeAttempt(value: unknown): value is Attempt; // export cái đang có
  export function createStore(storage: Storage | null, opts?: { now?: () => number; watch?: boolean }): AttemptStore;
  ```
- Quy tắc lọc: khi `viewer !== null`, ẩn những entry có `meta.owner !== undefined && meta.owner !== viewer`. Khi `viewer === null`, hiện tất cả (theo spec: chế độ khách thấy mọi dữ liệu trên máy).
- Lượt thi cũ chưa có metadata thì mặc định: `{ updatedAt: attempt.submittedAt ?? attempt.startedAt }`, không có `owner`.
- `watch: true` thì gắn `window.addEventListener('storage', …)`. Khi key là `STORAGE_KEY` hoặc `OWNERS_KEY`, tăng version và gọi listener. Đây là đồng bộ giữa các tab.
- Listener của `subscribe` được gọi **đồng bộ** (synchronous).

- [ ] **Step 1: Viết test thất bại** trong `storage.test.ts`. Dùng lại `fakeStorage`, và truyền `now` cố định.
  - `save gắn owner theo viewer và updatedAt = now()`: `setViewer('u1')`, `save(a)` → `entries()[0].meta` là `{ owner: 'u1', updatedAt: 500 }`. Khi viewer là `null` thì `owner` là `undefined`.
  - `ẩn lượt thi của tài khoản khác khi đang đăng nhập`: `put` một entry có owner `'A'`, một entry có owner `'B'`, một entry không có owner. `setViewer('B')` → `list()` có id của B và của khách. `get(idA)` → `undefined`. `setViewer(null)` → thấy cả 3.
  - `metadata sống qua tải lại trang`: save với viewer `'u1'`, tạo store mới trên cùng storage → `entries()[0].meta.owner === 'u1'`.
  - `lượt thi cũ không có metadata dùng submittedAt/startedAt`.
  - `subscribe được gọi khi save, put, remove, setViewer; version tăng; hủy đăng ký thì thôi gọi`.
  - `onSave chỉ chạy khi save, không chạy khi put`.
  - `remove xóa cả lượt thi lẫn metadata khỏi storage`.
  - `watch: sự kiện storage của tab khác làm subscribe chạy`: `window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))`.
- [ ] **Step 2: Chạy** `npx vitest run src/storage/storage.test.ts`. Kết quả mong đợi: FAIL (`setViewer`/`entries`… chưa có).
- [ ] **Step 3: Cài đặt** theo Interfaces. Metadata đọc và ghi cùng cách như lượt thi: đọc lại storage mỗi lần, trộn với `memory`, và khi ghi lỗi thì `available = false`.
- [ ] **Step 4: Chạy** `npx vitest run src/storage` → PASS (cả các test cũ).
- [ ] **Step 5: Commit** `feat(storage): track owner/updatedAt and notify subscribers`

---

### Task 2: Các trang đọc store theo kiểu reactive

**Files:**
- Create: `src/app/use-store.ts`
- Modify: `src/storage/finalize.ts`, `src/pages/HomePage.tsx`, `src/pages/SetStatsPage.tsx`, `src/pages/ExamPage.tsx`, `src/pages/ResultPage.tsx`
- Test: `src/storage/finalize.test.ts` (tạo mới), `src/pages/ExamPage.test.tsx`, `src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `AttemptStore.subscribe/version` (Task 1).
- Produces:
  - `useStoreVersion(): number` trong `src/app/use-store.ts`. Gọi `useSyncExternalStore(store.subscribe, store.version)` với `store` lấy từ `useApp()`. Trang nào gọi hook này sẽ vẽ lại khi store đổi.
  - `viewFinalized(attempts: Attempt[], now: number): Attempt[]` trong `finalize.ts`. Hàm thuần, không lưu: trả về danh sách trong đó các lượt Thi thật đã hết giờ được thay bằng `submitAttempt(a, now)`. `finalizeExpiredRealAttempts` giữ nguyên.
- Vì sao: `save` giờ gọi listener đồng bộ, nên không được gọi `save` trong lúc render. Đã có `useSyncExternalStore` của trang khác (như `Layout`) đăng ký, nên React sẽ cảnh báo "Cannot update a component while rendering". HomePage và SetStatsPage dùng `viewFinalized(store.list(), now())` khi render, và gọi `finalizeExpiredRealAttempts(store, now())` trong `useEffect`.
- ExamPage: bỏ `useState<Attempt>` và đọc `store.get(id)` mỗi lần render (sau `useStoreVersion()`). `update(next)` chỉ cần gọi `store.save(next)`. Effect điều hướng sang `/result/:id` khi `status === 'submitted'` giữ nguyên, nên tự xử lý được trường hợp nộp từ máy khác.
- ResultPage gọi `useStoreVersion()`.

- [ ] **Step 1: Viết test thất bại.**
  - `finalize.test.ts` › `viewFinalized nộp lượt Thi thật hết giờ mà không lưu`: store có lượt `real` với `endsAt` < now → kết quả có `status: 'submitted'`, và `store.get(id).status` vẫn là `'in-progress'`. Lượt `practice` và lượt chưa hết giờ giữ nguyên.
  - `ExamPage.test.tsx` › `đáp án đổi từ máy khác hiện ngay`: render `/exam/e1`, rồi trong `act(() => deps.store.put({ attempt: { ...a, answers: { [qid]: [key] } }, meta: { updatedAt: 2 } }))` → lựa chọn tương ứng có `aria-checked="true"`.
  - `ExamPage.test.tsx` › `lượt thi bị nộp ở máy khác thì chuyển sang kết quả`: `put` bản `submitAttempt(a, now)` → thấy `getByTestId('result-page')`.
  - `HomePage.test.tsx` › `lượt Thi thật hết giờ hiện trong lịch sử và được lưu là đã nộp`: sau render, `deps.store.get(id).status === 'submitted'`, và mục lịch sử hiện ra.
- [ ] **Step 2: Chạy** `npx vitest run src/storage/finalize.test.ts src/pages` → FAIL ở các test mới.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy** `npm test` → PASS toàn bộ, kể cả `hết giờ thì tự nộp` và các test cũ của trang. Console không có cảnh báo "Cannot update a component".
- [ ] **Step 5: Commit** `refactor(pages): re-render from store subscriptions`

---

### Task 3: Quy tắc gộp (hàm thuần)

**Files:**
- Create: `src/sync/merge.ts`
- Test: `src/sync/merge.test.ts`

**Interfaces:**
- Consumes: `StoreEntry`, `RecordMeta` (Task 1).
- Produces:
  ```ts
  export interface RemoteRecord { attempt: Attempt; updatedAt: number }
  export type RemoteSnapshot = Map<string, RemoteRecord>;
  export function sameAttempt(a: Attempt, b: Attempt): boolean; // so JSON.stringify
  export function pickWinner(local: { attempt: Attempt; updatedAt: number }, remote: RemoteRecord): 'local' | 'remote';
  export function findGuestConflicts(local: StoreEntry[], remote: RemoteSnapshot): string[];
  export interface SyncPlan { apply: StoreEntry[]; push: StoreEntry[] }
  export function planSync(local: StoreEntry[], remote: RemoteSnapshot, uid: string): SyncPlan;
  ```
- `pickWinner`: (1) bản `submitted` thắng bản `in-progress`, bất kể thời gian. (2) Nếu không, `updatedAt` lớn hơn thắng. (3) Bằng nhau thì `'remote'` thắng.
- `findGuestConflicts`: trả về id của các entry **không có owner** mà remote không có id đó, hoặc có nhưng `!sameAttempt`. Entry có owner (bất kỳ uid nào) không bao giờ bị tính.
- `planSync(local, remote, uid)` chỉ xét entry có `owner === uid`, cộng thêm entry khách giống hệt bản remote cùng id:
  - Remote có mà local không có → `apply` với `meta = { owner: uid, updatedAt }`.
  - Cả hai đều có và khác nhau → dùng `pickWinner`: remote thắng thì `apply`, local thắng thì `push`.
  - Cả hai giống nhau → `apply` chỉ khi meta cần đổi owner thành `uid` (nhận lại bản khách giống hệt), nếu không thì bỏ qua.
  - Local có `owner === uid` mà remote không có → `push`.
  - Entry của tài khoản khác hoặc entry khách khác remote → không đụng tới.

- [ ] **Step 1: Viết test thất bại** trong `merge.test.ts`:
  - `submitted thắng in-progress dù in-progress mới hơn` (cả hai chiều local/remote).
  - `cùng trạng thái thì updatedAt mới hơn thắng; bằng nhau thì remote thắng`.
  - `findGuestConflicts: khách không có trên cloud là xung đột; khách giống hệt cloud thì không; có owner thì không bao giờ`.
  - `planSync: cloud có, máy không có → apply với owner uid`.
  - `planSync: lượt của uid có trên máy mà cloud không có → push` (trường hợp làm offline rồi đóng tab).
  - `planSync: không đụng lượt của tài khoản khác`.
  - `planSync: echo giống hệt và đã đúng owner → không apply, không push`.
- [ ] **Step 2: Chạy** `npx vitest run src/sync/merge.test.ts` → FAIL (chưa có module).
- [ ] **Step 3: Cài đặt** `src/sync/merge.ts` theo Interfaces.
- [ ] **Step 4: Chạy** lại → PASS.
- [ ] **Step 5: Commit** `feat(sync): pure merge rules for cloud/local attempts`

---

### Task 4: SyncController

**Files:**
- Create: `src/sync/types.ts`, `src/sync/controller.ts`, `src/test/fake-sync.ts`
- Test: `src/sync/controller.test.ts`

**Interfaces:**
- Consumes: Task 1 (`AttemptStore`), Task 3 (`planSync`, `findGuestConflicts`, `sameAttempt`, `RemoteSnapshot`).
- Produces (`src/sync/types.ts`):
  ```ts
  export interface SyncUser { uid: string; name: string; photoURL?: string }
  export interface AuthClient {
    onUserChanged(cb: (user: SyncUser | null) => void): () => void;
    signIn(): Promise<void>;
    signOut(): Promise<void>;
  }
  export interface RemoteAttempts {
    listen(uid: string, cb: (snapshot: RemoteSnapshot) => void): () => void; // snapshot đầy đủ mỗi lần (onValue)
    write(uid: string, attempt: Attempt, updatedAt: number): Promise<void>;
    onConnected(cb: (online: boolean) => void): () => void;
    serverOffset(): number;
  }
  export type SyncState =
    | { kind: 'signed-out' }
    | { kind: 'loading'; user: SyncUser }
    | { kind: 'conflict'; user: SyncUser; count: number }
    | { kind: 'synced'; user: SyncUser; online: boolean; pending: number }
    | { kind: 'error'; message: string };
  export interface SyncController {
    getState(): SyncState;
    subscribe(listener: () => void): () => void;
    signIn(): Promise<void>;     // lỗi (popup bị chặn…) → state 'error' với thông báo tiếng Việt, sau đó quay về 'signed-out' khi người dùng bấm lại
    signOut(): Promise<void>;
    resolveConflict(choice: 'cloud' | 'push'): void;
    serverOffset(): number;
  }
  ```
  `src/sync/controller.ts`: `export function createSyncController(deps: { store: AttemptStore; auth: AuthClient; remote: RemoteAttempts }): SyncController`.
  `src/test/fake-sync.ts`: `fakeAuth()` (có `emit(user)`, đếm số lần `signIn`/`signOut`) và `fakeRemote()` (có `emit(uid, snapshot)`, `writes: {uid, attempt, updatedAt}[]`, `setOnline(b)`).
- Luồng xử lý:
  1. `onUserChanged(user)` → `'loading'`, mở `remote.listen(user.uid)`, và **chưa** `setViewer`.
  2. Snapshot đầu tiên → `findGuestConflicts(store.entries(), snap)`. Nếu khác rỗng → `'conflict'` với `count`, dừng ở đây: không ghi gì vào store hay cloud. Nếu rỗng → `start(snap)`.
  3. `resolveConflict('cloud')` → `store.remove(conflictIds)` (tính lại theo `store.entries()` lúc bấm), rồi `start`. `resolveConflict('push')` → mỗi entry khách xung đột mà remote **không có** id đó: `put` với `owner = uid` (sẽ được đẩy lên ở bước `start`). Mỗi entry khách mà remote có cùng id: `put` bản remote (cloud thắng), rồi `start`.
  4. `start(snap)`: `store.setViewer(uid)`, chạy `planSync`, `put` từng mục trong `apply`, `write` từng mục trong `push`, và đăng ký `store.onSave`. Mỗi lần `save` có `meta.owner === uid` thì gọi `write`. State là `'synced'`, `pending` = số lần ghi chưa xong.
  5. Snapshot tiếp theo khi đang `'synced'` → `planSync` rồi `apply`/`push` như trên. Bản ghi giống hệt thì bỏ qua (không lặp vô hạn).
  6. User thành `null` (đăng xuất, hoặc phiên hết hạn) → hủy listen và onSave, `setViewer(null)`, `'signed-out'`. Store giữ nguyên.

- [ ] **Step 1: Viết test thất bại** trong `controller.test.ts`, dùng `createStore(memoryStorage(), { now })` cùng hai bản giả:
  - `máy không có dữ liệu khách: đăng nhập là đồng bộ ngay, dữ liệu cloud vào store`.
  - `có lượt thi khách: vào trạng thái conflict với count đúng và chưa đổi gì` (store.entries và remote.writes không đổi).
  - `tải lại trang trước khi chọn: store không đổi, controller mới lại báo conflict` (tạo controller thứ hai trên cùng storage).
  - `chọn cloud: lượt thi khách bị xóa, chỉ còn dữ liệu cloud`.
  - `chọn push: lượt thi khách được gắn owner và ghi lên cloud; trùng id thì giữ bản cloud`.
  - `save khi đã đồng bộ thì ghi lên cloud; snapshot echo lại không gây ghi thêm` (`writes.length` đúng 1).
  - `snapshot cloud có bản submitted ghi đè bản in-progress trên máy dù máy mới hơn`.
  - `đăng xuất giữ nguyên localStorage; đăng nhập tài khoản khác thì lượt của A bị ẩn, không bị đẩy lên, không gây conflict`. Sau đó đăng nhập lại A → `store.list()` thấy lại.
  - `signIn lỗi → state error có thông báo`.
- [ ] **Step 2: Chạy** `npx vitest run src/sync/controller.test.ts` → FAIL.
- [ ] **Step 3: Cài đặt** `types.ts`, `controller.ts`, `fake-sync.ts`.
- [ ] **Step 4: Chạy** `npx vitest run src/sync` → PASS.
- [ ] **Step 5: Commit** `feat(sync): sync controller with sign-in conflict handling`

---

### Task 5: Giao diện tài khoản, trạng thái đồng bộ và hộp thoại xung đột

**Files:**
- Modify: `src/app/context.tsx` (thêm `sync?: SyncController` vào `AppDeps`), `src/components/Layout.tsx`, `src/styles.css`
- Create: `src/components/AccountMenu.tsx`, `src/components/ConflictDialog.tsx`
- Test: `src/components/AccountMenu.test.tsx`

**Interfaces:**
- Consumes: `SyncController`, `SyncState` (Task 4), `fakeAuth`/`fakeRemote` (Task 4), `makeDeps`/`renderApp` (`src/test/fixtures.tsx`).
- `AccountMenu({ english }: { english: boolean })` đọc state qua `useSyncExternalStore(sync.subscribe, sync.getState)` và render thẳng cạnh nút theme trong header. Không có `deps.sync` thì không render gì.
  - `signed-out` / `error`: nút "Đăng nhập Google" (`english`: "Sign in with Google"). Khi `error` thì hiện thêm thông báo lỗi.
  - `loading`: chữ "Đang tải…".
  - `synced`: ảnh đại diện (nếu có) và tên, cùng dấu trạng thái: "Đã đồng bộ" khi `online && pending === 0`, "Đang đồng bộ…" khi `pending > 0`, "Mất kết nối, sẽ đồng bộ khi có mạng" khi `!online`. Kèm nút "Đăng xuất" (`english`: "Sign out"). Dùng `<details>` như `topbar__menu` hiện có.
- `ConflictDialog`: render khi `state.kind === 'conflict'`, dùng lại class `.dialog` / `.dialog__box`, với `role="dialog" aria-modal="true"`. Không có nút đóng, và không đóng bằng Esc hay khi bấm ra ngoài. Nội dung chữ cố định:
  - Tiêu đề: "Máy này có dữ liệu chưa đăng nhập"
  - Nội dung: `Có ${count} lượt thi trên máy này chưa thuộc tài khoản ${user.name}. Bạn muốn xử lý thế nào?`
  - Nút: "Dùng dữ liệu trên cloud" → `resolveConflict('cloud')`. "Đưa dữ liệu trên máy này lên tài khoản" (class `btn-primary`) → `resolveConflict('push')`.
- `Layout`: `english = /^\/exam\/[^/]+$/.test(pathname) && store.get(id)?.mode === 'real'`. Render `<AccountMenu english={english} />` và `<ConflictDialog />`.

- [ ] **Step 1: Viết test thất bại** trong `AccountMenu.test.tsx`. Dựng `sync = createSyncController({ store: deps.store, auth, remote })` với các bản giả, rồi `renderApp('/', makeDeps({ sync, store }))`:
  - `không có cấu hình Firebase thì không có nút đăng nhập` (`makeDeps()` mặc định).
  - `chưa đăng nhập: bấm "Đăng nhập Google" gọi signIn`.
  - `đã đồng bộ: hiện tên và "Đăng xuất"; bấm thì gọi signOut`.
  - `màn hình Thi thật dùng "Sign in with Google"`.
  - `có xung đột: hộp thoại hiện số lượt thi; bấm "Dùng dữ liệu trên cloud" gọi resolveConflict('cloud')` (kiểm tra bằng state đổi sang `synced`).
  - `mất kết nối: hiện "Mất kết nối, sẽ đồng bộ khi có mạng"`.
- [ ] **Step 2: Chạy** `npx vitest run src/components/AccountMenu.test.tsx` → FAIL.
- [ ] **Step 3: Cài đặt** các component, sửa `AppDeps` và `Layout`, thêm CSS cho menu tài khoản theo kiểu của `.topbar__menu`/`.icon-btn`. Ảnh đại diện 24px, bo tròn.
- [ ] **Step 4: Chạy** `npm run check` → PASS.
- [ ] **Step 5: Commit** `feat(ui): Google sign-in menu, sync status and conflict dialog`

---

### Task 6: Kết nối Firebase thật, cấu hình, deploy và tài liệu

**Files:**
- Create: `src/sync/config.ts`, `src/sync/config.test.ts`, `src/sync/firebase.ts`, `.env.example`, `database.rules.json`, `docs/firebase-setup.md`
- Modify: `package.json` / `package-lock.json` (`npm install firebase`), `.gitignore` (thêm `.env.local`, `.env.*.local`), `src/main.tsx`, `.github/workflows/pages.yml`, `CLAUDE.md` (mục Kiến trúc và Lệnh), `docs/superpowers/specs/2026-09-24-saa-c03-exam-site-design.md` (mục lưu trữ: thêm một câu trỏ sang spec đồng bộ)

**Interfaces:**
- Consumes: `AuthClient`, `RemoteAttempts`, `createSyncController` (Task 4), `looksLikeAttempt`, `createStore(storage, { now, watch })` (Task 1).
- Produces:
  - `src/sync/config.ts`: `export interface FirebaseConfig { apiKey: string; authDomain: string; databaseURL: string; projectId: string; appId: string }` và `export function readFirebaseConfig(env: Record<string, string | undefined>): FirebaseConfig | null`. Trả `null` nếu thiếu hoặc rỗng bất kỳ biến nào trong 5 biến `VITE_FIREBASE_*`.
  - `src/sync/firebase.ts`: `export function createFirebaseClients(config: FirebaseConfig): { auth: AuthClient; remote: RemoteAttempts }`.
    - `listen`: `onValue(ref(db, \`users/${uid}/attempts\`))`. Mỗi con được `JSON.parse(json)` và lọc bằng `looksLikeAttempt`. Bản nào parse lỗi thì bỏ qua.
    - `write`: `set(ref(db, \`users/${uid}/attempts/${attempt.id}\`), { json: JSON.stringify(attempt), updatedAt })`.
    - `onConnected`: `.info/connected`. `serverOffset`: giá trị mới nhất của `.info/serverTimeOffset` (mặc định 0).
    - Auth: `onAuthStateChanged` ánh xạ sang `SyncUser { uid, name: displayName ?? email ?? 'Google', photoURL }`. `signIn` dùng `signInWithPopup(auth, new GoogleAuthProvider())`.
- `src/main.tsx`: `config = readFirebaseConfig(import.meta.env)`. Nếu có config thì tạo clients và controller. `now = () => Date.now() + (sync?.serverOffset() ?? 0)`, và cùng hàm `now` đó truyền vào `createStore(getBrowserStorage(), { now, watch: true })`. Controller cần store, store cần `now`, mà `now` lại cần controller: tạo `remote` trước rồi dùng `remote.serverOffset()` để tránh phụ thuộc vòng.
- `database.rules.json`: chép **nguyên văn** khối rules trong spec.
- `pages.yml`, bước "Build site": thêm `env:` với 5 biến `VITE_FIREBASE_*: ${{ vars.VITE_FIREBASE_* }}`.
- `docs/firebase-setup.md`: 6 bước trong mục "Hướng dẫn cài đặt Firebase" của spec, viết bằng tiếng Việt, chi tiết theo từng màn hình console. Ghi rõ authorized domain là `<user>.github.io`, và lấy tên user thật từ `git remote get-url origin`.

- [ ] **Step 1: Viết test thất bại** trong `config.test.ts`: `đủ 5 biến thì trả config`, `thiếu một biến thì null`, `biến rỗng thì null`.
- [ ] **Step 2: Chạy** `npx vitest run src/sync/config.test.ts` → FAIL.
- [ ] **Step 3: Cài đặt** `config.ts`. Chạy `npm install firebase`, rồi viết `firebase.ts` và sửa `main.tsx`.
- [ ] **Step 4: Chạy** `npm run check` rồi `npm run build`. Cả hai PASS, và `npm run build` không có `.env.local` vẫn build được.
- [ ] **Step 5: Tạo** `.env.example`, `database.rules.json`, `docs/firebase-setup.md`. Sửa `.gitignore`, `pages.yml`, `CLAUDE.md` và spec gốc.
- [ ] **Step 6: Kiểm tra thủ công** (cần người dùng làm theo `docs/firebase-setup.md` và có `.env.local`): `npm run dev`, mở hai trình duyệt khác nhau và đăng nhập cùng một tài khoản. Bắt đầu một lượt Thi thật ở trình duyệt 1, mở nó ở trình duyệt 2 từ mục "Đang làm dở". Chọn đáp án ở trình duyệt 1 thì trình duyệt 2 phải đổi ngay, và đồng hồ hai bên phải khớp nhau. Nếu chưa có cấu hình thì ghi rõ bước này **chưa làm**.
- [ ] **Step 7: Commit** `feat(sync): wire Firebase auth and Realtime Database`

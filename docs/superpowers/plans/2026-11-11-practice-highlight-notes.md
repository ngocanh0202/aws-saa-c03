# Thi thử: khóa đáp án, AI không lộ đáp án, highlight + ghi chú — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở Thi thử: khóa đáp án sau khi bấm "Xem hướng dẫn"; AI không bao giờ có/nói đáp án câu chưa thấy; người học tô đoạn trong đề, ghi chú từng đoạn (AI soạn được), ôn lại ở trang `#/notes`, đồng bộ Firebase.

**Architecture:** Logic thuần trong `src/engine/actions.ts`, `src/ai/prompt.ts`, `src/ai/search.ts` và thư mục mới `src/notes/` (model, store theo ngăn tài khoản, đồng bộ, DOM, prompt AI). UI: `QuestionCard` nhận prop `annotate` để gắn lớp highlight; `ExamPage` (chỉ Thi thử) và trang mới `NotesPage` dùng nó. Firebase adapter thêm `notes` (`users/{uid}/notes/{qid}`), có controller đồng bộ riêng.

**Tech Stack:** Vite + React + TypeScript, Vitest + Testing Library (jsdom), Firebase Realtime Database, Firebase emulator cho rules.

**Spec:** [docs/superpowers/specs/2026-11-11-practice-highlight-notes-design.md](../specs/2026-11-11-practice-highlight-notes-design.md)

## Global Constraints

- Chỉ Thi thử (`attempt.mode === 'practice'`) và trang `#/notes`. Thi thật, `ResultPage`, `#/q/:id`, External: không hiện highlight/ghi chú.
- Một màu tô. Biến CSS: `--hl-bg` `#ffe58a` / `#5a4612`, `--hl-text` `#1f2328` / `#fff3cf`, `--hl-line` `#d97706` / `#ffcf66` (sáng / tối), định nghĩa ở cả 3 nhánh theme trong `src/styles.css`.
- Chỉ tô trong `stem` và `prompt`, không tô trong lựa chọn.
- Nút chỉ icon SVG (`stroke="currentColor"`), mỗi nút có `aria-label` + `title` tiếng Việt. Mobile (< 640px): nút ≥ 44px, ô nhập `font-size: 16px`.
- Ghi chú tối đa `NOTE_MAX = 2000` ký tự.
- localStorage key: `saa-c03:notes:v1:<uid>` và `saa-c03:notes:v1:guest`. Firebase: `users/{uid}/notes/{qid}` = `{ json, updatedAt }`, `json` < 100000 ký tự.
- AI không được nhận đáp án/giải thích/`data/vi`/`note` của câu chưa thấy; prompt AI soạn ghi chú không bao giờ chứa chúng.
- Câu trả lời của AI cho đoạn tô vô nghĩa: đúng chuỗi `Không rõ bạn muốn ghi chú gì ở đoạn này.`
- Giao diện tiếng Việt; đề/lựa chọn tiếng Anh. Không dùng chữ A/B/C trong ghi chú cố định.
- Chạy `npm run check` trước mỗi commit; commit message kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Câu main HTML có thẻ lồng (`<strong>`, `<br>`, ảnh): bôi đen vắt qua nhiều thẻ vẫn tô đúng, không làm vỡ HTML hay mất ảnh → test trong Task 6.
2. Người học hỏi Gemini về chính câu đang làm (chưa xem hướng dẫn) mà câu đó có ở lượt cũ đã nộp: tool search phải ẩn đáp án → test trong Task 2.
3. Đổi tài khoản trên cùng máy: tài khoản B không thấy ghi chú của A; khách đăng nhập thì ghi chú khách gộp vào tài khoản rồi ngăn khách rỗng → test trong Task 4.
4. Bôi đen vắt từ đề bài sang lựa chọn hoặc sang dòng câu hỏi: không hiện thanh tô (không hợp lệ) → test trong Task 6.
5. Ghi chú đang gõ dở rồi chuyển sang câu khác/bấm ra ngoài: tự lưu, không mất chữ → test trong Task 7.

---

### Task 1: Khóa đáp án sau khi xem hướng dẫn

**Files:**
- Modify: `src/engine/actions.ts` (`selectOption`)
- Modify: `src/pages/ExamPage.tsx` (truyền `onSelect` có điều kiện, hiện 🔒)
- Create: `src/components/icons.tsx` (bộ icon SVG dùng chung cho cả kế hoạch)
- Modify: `src/styles.css` (`.qcard__lock`)
- Test: `src/engine/actions.test.ts`, `src/pages/ExamPage.test.tsx`

**Interfaces:**
- Produces: `selectOption` giữ nguyên chữ ký; `icons.tsx` export `IconHighlight, IconNote, IconAi, IconSave, IconDelete, IconClose, IconLock` — mỗi cái là `(props: { size?: number }) => JSX.Element`, `aria-hidden="true"`, `stroke="currentColor"`, viewBox 24.

- [ ] **Step 1: Test engine**

```ts
it('Thi thử: câu đã mở hướng dẫn không đổi được đáp án', () => {
  const a = { ...practiceAttempt(), answers: { 5: ['A'] }, guideOpened: [5] };
  expect(selectOption(a, 5, 'B', 1)).toBe(a);
});
it('Thi thử: câu khác vẫn chọn được', () => {
  const a = { ...practiceAttempt(), guideOpened: [5] };
  expect(selectOption(a, 6, 'B', 1).answers[6]).toEqual(['B']);
});
it('Thi thật không bị ảnh hưởng bởi guideOpened', () => {
  const a = { ...realAttempt(), guideOpened: [5] };
  expect(selectOption(a, 5, 'B', 1).answers[5]).toEqual(['B']);
});
```
(Dùng helper tạo attempt sẵn có trong `actions.test.ts`; thiếu thì tạo bằng `createAttempt` như các test hiện có.)

- [ ] **Step 2:** `npx vitest run src/engine/actions.test.ts` → FAIL ở test đầu.
- [ ] **Step 3:** Trong `selectOption`: `if (attempt.mode === 'practice' && attempt.guideOpened.includes(qid)) return attempt;`
- [ ] **Step 4: Test UI** trong `ExamPage.test.tsx`: tạo lượt Thi thử, chọn một lựa chọn, bấm nút hướng dẫn, rồi `expect(screen.getAllByRole('radio').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)`, có phần tử `getByLabelText('Đã xem hướng dẫn, không đổi được đáp án câu này nữa')`, và đáp án đã chọn vẫn `aria-checked="true"`.
- [ ] **Step 5:** `ExamPage`: `onSelect={revealed ? undefined : (key) => …}`; khi `revealed` render trước `QuestionCard` một `<p className="qcard__lock" role="note" aria-label="Đã xem hướng dẫn, không đổi được đáp án câu này nữa" title="…cùng chữ…"><IconLock /></p>`. CSS `.qcard__lock` dùng `--warn`/`--warn-bg`.
- [ ] **Step 6:** `npx vitest run src/engine/actions.test.ts src/pages/ExamPage.test.tsx` → PASS.
- [ ] **Step 7:** `npm run check`, commit `feat(practice): lock answers after opening the guide`.

---

### Task 2: AI không có đáp án câu chưa thấy; bỏ `open_guide`; search ẩn đáp án

**Files:**
- Modify: `src/ai/prompt.ts` (`buildSystemPrompt`)
- Delete: `src/ai/guide-tool.ts`, `src/ai/guide-tool.test.ts`
- Modify: `src/components/GeminiChat.tsx` (bỏ `onOpenGuide`, `createGuideTool`, `guideRequested`; `revealed` mặc định `true`; `resolve()` không còn `onOpenGuide`)
- Modify: `src/pages/ExamPage.tsx` (bỏ prop `onOpenGuide`, truyền `revealed`)
- Modify: `src/ai/search.ts` (`searchAnswered`, `createSearchTool`)
- Modify: `CLAUDE.md` (mục `src/ai/`), `docs/superpowers/specs/2026-11-02-gemini-tools-design.md` (thêm dòng "Đã thay bởi spec 2026-11-11: bỏ open_guide")
- Test: `src/ai/prompt.test.ts`, `src/ai/search.test.ts`, `src/components/GeminiChat.test.tsx`

**Interfaces:**
- Produces: `SearchHit` thêm `answerHidden: boolean`; khi `true` thì `options[i].correct` bị bỏ (kiểu thành `{ text: string; correct?: boolean }`) và `tries[i].correct` bị bỏ (`correct?: boolean`). `SearchContext` giữ nguyên `{ setId, attemptId, qid }`.

- [ ] **Step 1: Test prompt**

```ts
it('chưa xem hướng dẫn: prompt không có đáp án, giải thích, ghi chú review', () => {
  const p = buildSystemPrompt(q, order, { vi, note: 'NOTE-X', revealed: false });
  expect(p).not.toContain('Đáp án đúng');
  expect(p).not.toContain(vi.explanationVi);
  expect(p).not.toContain(vi.keyHint);
  expect(p).not.toContain(vi.options[0].reason);
  expect(p).not.toContain('NOTE-X');
  expect(p).not.toContain('open_guide');
  expect(p).toContain('Xem hướng dẫn');
});
it('đã xem: vẫn có đáp án và giải thích như cũ', () => {
  const p = buildSystemPrompt(q, order, { vi, revealed: true });
  expect(p).toContain('Đáp án đúng');
  expect(p).toContain(vi.explanationVi);
});
```
Sửa các test cũ đang mong `open_guide` trong prompt.

- [ ] **Step 2:** Chạy `npx vitest run src/ai/prompt.test.ts` → FAIL.
- [ ] **Step 3:** `buildSystemPrompt`: khi `!extra.revealed` bỏ dòng `Đáp án đúng`, bỏ `guideSection`, bỏ dòng "đối chiếu đáp án với giải thích"; `answerRules` chưa xem thành đúng hai dòng:
  - `- Người học chưa xem đáp án và bạn không được biết đáp án: không khẳng định lựa chọn nào đúng hay sai, chỉ gợi ý và giải thích khái niệm.`
  - `- Người học xin đáp án thì bảo họ bấm nút "Xem hướng dẫn" (bấm xong sẽ không đổi được đáp án câu này).`
  Thêm vào phần tool tìm câu: `- Câu tìm được có answerHidden thì không đoán và không nói đáp án câu đó.`
- [ ] **Step 4: Test search** (thêm vào `search.test.ts`, dùng helper `attempt()`/`real()` sẵn có):

```ts
it('câu trong lượt đang làm, chưa mở hướng dẫn: ẩn đáp án dù lượt cũ đã nộp có câu đó', () => {
  const cur = attempt('a1', { mode: 'practice', status: 'in-progress', answers: { 5: ['A'] }, guideOpened: [] });
  const old = attempt('a0', { status: 'submitted', answers: { 5: ['B'] } });
  const [hit] = searchAnswered('multipart', { ...CTX, attemptId: 'a1' }, [cur, old], bank());
  expect(hit.answerHidden).toBe(true);
  expect(hit.options.every((o) => o.correct === undefined)).toBe(true);
  expect(hit.tries.every((t) => t.correct === undefined)).toBe(true);
});
it('câu trong lượt đang làm đã mở hướng dẫn: có đáp án', () => { /* guideOpened: [5] → answerHidden false, có correct */ });
it('câu chỉ ở lượt khác đã nộp: có đáp án', () => { /* hiện tại là a9 không chứa câu 5 */ });
it('câu chỉ ở lượt Thi thử khác chưa nộp, chưa mở hướng dẫn: ẩn', () => {});
it('câu chỉ ở lượt Thi thử khác chưa nộp, đã mở hướng dẫn: có đáp án', () => {});
it('tool không sửa lượt thi nào', () => {
  const store = createStore(memoryStorage()); /* lưu 2 lượt Thi thử dở */
  const before = JSON.stringify(store.list());
  createSearchTool(store, bank(), CTX).run({ query: 'multipart' });
  expect(JSON.stringify(store.list())).toBe(before);
});
```
Xóa test cũ kiểm tra `markGuideOpened` từ tool.

- [ ] **Step 5:** Cài đặt trong `searchAnswered`. Thuật toán "đã thấy":

```ts
// ctxAttempt = attempts.find((a) => a.id === ctx.attemptId)
// inCurrent = ctxAttempt?.questions.some((q) => q.qid === qid)
// seenIn(a) = a.status === 'submitted' || (a.mode === 'practice' && a.guideOpened.includes(qid))
// visible = inCurrent ? seenIn(ctxAttempt) : attempts.some((a) => a.setId === ctx.setId && a.questions.some((q) => q.qid === qid) && seenIn(a))
```
Ẩn thì bỏ trường `correct` (không để `false`). `createSearchTool.run` bỏ vòng `markGuideOpened`; bỏ import.

- [ ] **Step 6: GeminiChat** — xóa `guide-tool.ts` + test; bỏ prop `onOpenGuide` khỏi `Props`/`Target`; `revealed: revealed ?? true`; `resolve()`: `revealed: open ? a.guideOpened.includes(qid) : true`. `ExamPage` truyền `revealed={revealed}` và bỏ `onOpenGuide`. Sửa test trong `GeminiChat.test.tsx` đang dùng `open_guide`/`onOpenGuide` (bỏ test mở hướng dẫn qua tool; thêm test: bấm "Xem hướng dẫn" khi khung đang mở thì lần gửi sau dùng prompt có `Đáp án đúng` — kiểm qua `fake-ai` ghi lại `systemPrompt`).
- [ ] **Step 7:** `npx vitest run src/ai src/components/GeminiChat.test.tsx src/pages` → PASS.
- [ ] **Step 8:** Cập nhật `CLAUDE.md`: thay đoạn "Hỏi Gemini không tự mở hướng dẫn: Gemini gọi tool `open_guide`…" bằng: "Câu chưa xem hướng dẫn thì prompt không chứa đáp án/giải thích/`note`; AI bảo người học bấm "Xem hướng dẫn" (không còn tool `open_guide`). Tool `find_answered_questions` ẩn đáp án (`answerHidden`) với câu chưa thấy: câu thuộc lượt đang hỏi chỉ xét `guideOpened` của lượt đó; câu khác thấy nếu thuộc lượt đã nộp hoặc đã mở hướng dẫn ở lượt nào đó; tool không sửa lượt thi." Bỏ cụm "câu tìm được thuộc lượt Thi thử chưa nộp bị gắn nhãn đã xem hướng dẫn".
- [ ] **Step 9:** `npm run check`, commit `feat(ai): never give the answer before the guide is opened; drop open_guide`.

---

### Task 3: Id gốc của câu (canonical) trong bank

**Files:**
- Modify: `src/data/bank.ts` (`Bank.canonical`, input `twins`)
- Modify: `src/data/load.ts` (truyền `twins` và `duplicates`)
- Test: `src/data/bank.test.ts` (tạo nếu chưa có)

**Interfaces:**
- Produces: `Bank.canonical: (qid: number) => number`. `buildBank` input thêm `twins?: [number, number][]` và `duplicates?: [number, number][]`.

- [ ] **Step 1: Test**

```ts
const b = buildBank({ ...minimalInput, twins: [[10101, 10201], [7, 3]] });
expect(b.canonical(10201)).toBe(10101);
expect(b.canonical(10101)).toBe(10101);
expect(b.canonical(7)).toBe(3);   // cặp sub: id nhỏ hơn
expect(b.canonical(3)).toBe(3);
expect(b.canonical(42)).toBe(42);
```
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Map dựng một lần. Hai input riêng: `twins` (main, có thứ tự `[orig, twin]` → map `twin → orig`) và `duplicates` (sub, không thứ tự → map `max → min`). Sửa test Step 1 cho đúng: `buildBank({ …, twins: [[10101, 10201]], duplicates: [[7, 3]] })`. `load.ts` truyền `twins: mainFile.twins, duplicates: sets.duplicates ?? []`. `makeBank` trong fixtures không cần đổi (mặc định rỗng).
- [ ] **Step 4:** PASS; `npm run check`; commit `feat(data): canonical question id for duplicate questions`.

---

### Task 4: Model ghi chú + NotesStore theo ngăn tài khoản

**Files:**
- Create: `src/notes/model.ts`, `src/notes/model.test.ts`
- Create: `src/notes/store.ts`, `src/notes/store.test.ts`
- Modify: `src/app/context.tsx` (`AppDeps.notes: NotesStore`), `src/test/fixtures.tsx` (`makeDeps` tạo `notes: createNotesStore(memoryStorage(), …)`), `src/main.tsx`

**Interfaces:**
- Produces (`model.ts`):
  - `type HighlightPart = 'stem' | 'prompt'`
  - `interface Highlight { id: string; part: HighlightPart; start: number; end: number; text: string; note: string; updatedAt: number }`
  - `interface QuestionNotes { qid: number; highlights: Highlight[]; updatedAt: number }`
  - `const NOTE_MAX = 2000`
  - `addHighlight(notes: QuestionNotes, h: { part; start; end; text }, partText: string, id: string, now: number): { notes: QuestionNotes; id: string }` — gộp với mọi đoạn cùng `part` chồng hoặc chạm nhau: `start=min`, `end=max`, `text=partText.slice(start,end)`, `note` nối các note không rỗng bằng `'\n\n'` (cắt `NOTE_MAX`), giữ `id` của đoạn đầu tiên bị gộp nếu có; trả về `id` của đoạn kết quả.
  - `setNote(notes, id, note, now): QuestionNotes` (cắt `NOTE_MAX`)
  - `removeHighlight(notes, id, now): QuestionNotes`
  - `locate(h: Highlight, partText: string): { start: number; end: number } | null` — đúng chỗ thì giữ; lệch thì tìm mọi lần xuất hiện `h.text`, chọn lần gần `h.start` nhất; không thấy → `null`.
  - `mergeNotes(local: QuestionNotes | undefined, remote: QuestionNotes | undefined): 'local' | 'remote' | 'same'` — `updatedAt` lớn hơn thắng; bằng nhau mà khác nội dung → `'remote'`; giống hệt → `'same'`.
- Produces (`store.ts`):

```ts
export const NOTES_KEY_PREFIX = 'saa-c03:notes:v1:';
export interface NotesStore {
  /** null = khách. */
  setOwner(uid: string | null): void;
  owner(): string | null;
  get(qid: number): QuestionNotes | undefined;          // ngăn hiện tại
  list(): QuestionNotes[];                               // ngăn hiện tại, updatedAt giảm dần, bỏ bản ghi rỗng
  save(notes: QuestionNotes): void;                      // ghi ngăn hiện tại, báo người nghe
  /** Ghi bản từ cloud vào ngăn uid (không báo "cần đẩy"). */
  applyRemote(uid: string, notes: QuestionNotes): void;
  /** Gộp ngăn khách vào ngăn uid theo mergeNotes, xóa ngăn khách; trả về các bản cần đẩy lên. */
  adoptGuest(uid: string): QuestionNotes[];
  all(uid: string): QuestionNotes[];                     // kể cả bản rỗng, cho đồng bộ
  subscribe(listener: () => void): () => void;
  /** Báo mỗi lần save() ở ngăn có owner (để đồng bộ đẩy lên). */
  onLocalChange(cb: (uid: string, notes: QuestionNotes) => void): () => void;
}
export function createNotesStore(storage: Storage | null): NotesStore;
```

- [ ] **Step 1: Test model** — các ca: thêm đoạn mới; gộp hai đoạn chồng (note nối `'a\n\nb'`); đoạn chạm nhau cũng gộp; đoạn khác `part` không gộp; `setNote` cắt 2000; `removeHighlight`; `locate` đúng chỗ, lệch (trả lần gần nhất trong 2 lần xuất hiện), không thấy → null; `mergeNotes` 3 ca.
- [ ] **Step 2:** FAIL → cài đặt → PASS.
- [ ] **Step 3: Test store**

```ts
it('tách ngăn: A không thấy ghi chú của B', () => {
  const s = createNotesStore(memoryStorage());
  s.setOwner('A'); s.save(notes(5, 'của A'));
  s.setOwner('B'); expect(s.get(5)).toBeUndefined();
  s.setOwner('A'); expect(s.get(5)?.highlights[0].note).toBe('của A');
});
it('adoptGuest gộp ngăn khách vào tài khoản rồi làm rỗng ngăn khách', () => {
  const s = createNotesStore(memoryStorage());
  s.setOwner(null); s.save(notes(5, 'khách', 200));
  s.applyRemote('A', notes(5, 'cloud', 100));
  const push = s.adoptGuest('A');
  expect(push.map((n) => n.qid)).toEqual([5]);
  s.setOwner('A'); expect(s.get(5)?.highlights[0].note).toBe('khách');
  s.setOwner(null); expect(s.list()).toEqual([]);
});
it('list bỏ câu không còn đoạn tô, all thì giữ', () => {});
it('storage null (bị chặn) vẫn chạy trong bộ nhớ', () => {});
it('dữ liệu hỏng trong localStorage bị bỏ qua', () => {});
```
- [ ] **Step 4:** Cài đặt; mỗi ngăn một key `NOTES_KEY_PREFIX + (uid ?? 'guest')`, giá trị `Record<qid, QuestionNotes>`; mọi `getItem/setItem` bọc `try/catch` như `ai-mode.ts`.
- [ ] **Step 5:** Thêm `notes: NotesStore` (bắt buộc) vào `AppDeps`; `makeDeps` và `main.tsx` tạo store. Chạy `npm run check` → PASS; commit `feat(notes): highlight model and per-account notes store`.

---

### Task 5: Đồng bộ ghi chú lên Firebase + rules

**Files:**
- Modify: `src/sync/types.ts` (`RemoteNotes`)
- Modify: `src/sync/firebase.ts` (thêm `notes: RemoteNotes` vào kết quả `createFirebaseClients`)
- Create: `src/notes/sync.ts`, `src/notes/sync.test.ts`
- Modify: `src/test/fake-sync.ts` (`fakeRemoteNotes()`)
- Modify: `src/main.tsx` (khởi động `startNotesSync` khi có `clients`)
- Modify: `database.rules.json`; Create: `rules-tests/notes.rules.test.ts`
- Modify: `docs/firebase-setup.md` (nhắc deploy lại rules)

**Interfaces:**
- Consumes: `NotesStore` (Task 4), `mergeNotes`.
- Produces:

```ts
export interface RemoteNotes {
  listen(uid: string, cb: (all: Map<number, QuestionNotes>) => void, onError: (err: Error) => void): () => void;
  write(uid: string, notes: QuestionNotes): Promise<void>;
}
export function startNotesSync(deps: { notes: NotesStore; auth: AuthClient; remote: RemoteNotes }): () => void;
```

- [ ] **Step 1: Test sync** (dùng `fakeAuth()` và `fakeRemoteNotes()`):
  - đăng nhập A → `notes.owner()==='A'`; bản cloud mới hơn được `applyRemote`; bản máy mới hơn được `write`.
  - khách có ghi chú, đăng nhập → `adoptGuest` chạy, bản gộp được `write`, ngăn khách rỗng.
  - đang đăng nhập, `notes.save()` → `write` được gọi với đúng uid.
  - đăng xuất → `owner()===null`, không `write` nữa.
  - cloud gửi bản rỗng (`highlights: []`) mới hơn → câu đó biến khỏi `list()`.
  - `write` lỗi không làm hỏng store (thử lại lần save sau là đủ).
- [ ] **Step 2:** FAIL → cài đặt `startNotesSync`: nghe `auth.onUserChanged`; user → `adoptGuest`, `setOwner(uid)`, `remote.listen` → với mỗi qid so `mergeNotes` với `notes.all(uid)` rồi `applyRemote` hoặc `write`; bản chỉ có ở máy thì `write`. `onLocalChange` → `write`. Không đụng `controller.ts`.
- [ ] **Step 3:** Adapter Firebase: `listen` dùng `onValue(ref(db, \`users/${uid}/notes\`))`, parse `json` bằng `JSON.parse` trong `try`, bỏ bản hỏng; `write` dùng `set(ref(…/notes/${qid}), { json: JSON.stringify(notes), updatedAt: notes.updatedAt })`.
- [ ] **Step 4: Rules** — thêm dưới `users/$uid` (trước `$other`):

```json
"notes": {
  "$qid": {
    ".validate": "newData.hasChildren(['json', 'updatedAt']) && newData.child('json').isString() && newData.child('json').val().length < 100000 && newData.child('updatedAt').isNumber()"
  }
}
```
- [ ] **Step 5: Test rules** `rules-tests/notes.rules.test.ts` (theo mẫu `support.rules.test.ts`): chủ ghi/đọc `users/A/notes/5` được; B đọc/ghi `users/A/notes` bị từ chối; thiếu `updatedAt` bị từ chối; `json` dài 100000 bị từ chối. Chạy `npm run test:rules` → PASS (cần Java; không có Java thì ghi rõ trong báo cáo là chưa chạy được).
- [ ] **Step 6:** `npm run check`, commit `feat(notes): sync notes to Firebase`.

---

### Task 6: Lớp DOM: vị trí đoạn chọn và bọc `<mark>`

**Files:**
- Create: `src/notes/dom.ts`, `src/notes/dom.test.ts`

**Interfaces:**
- Produces:

```ts
/** Đoạn chọn nằm trọn trong container và không rỗng → vị trí theo textContent; ngược lại null. */
export function selectionOffsets(container: HTMLElement, range: Range): { start: number; end: number; text: string } | null;
/** Bỏ mọi <mark data-hl> cũ (gộp lại text node), rồi bọc các đoạn mới. Không đụng thẻ khác/ảnh. */
export function applyHighlights(container: HTMLElement, marks: { id: string; start: number; end: number; hasNote: boolean }[]): void;
```
`<mark>` có `data-hl="<id>"`, `class="hl"` (+ `hl--note` khi có ghi chú), `tabindex="0"`, `role="button"`, `aria-label="Đoạn đã tô: <text>"`.

- [ ] **Step 1: Test** (jsdom):
  - `<p>Main stem <strong>10101</strong> text</p>`: chọn từ "stem" tới "101" → `{ start: 5, end: 13, text: 'stem 101' }`; `applyHighlights` tạo 2 `<mark>` cùng `data-hl` (một trong `<strong>`), `container.textContent` không đổi, `<strong>` vẫn còn.
  - Có `<img>`: ảnh vẫn còn sau `applyHighlights`.
  - Chọn vắt ra ngoài container (sang phần tử anh em) → `null`.
  - Chọn chỉ khoảng trắng → `null`.
  - Gọi `applyHighlights` hai lần → không lồng `<mark>`, `textContent` không đổi.
- [ ] **Step 2:** FAIL → cài đặt bằng `TreeWalker(NodeFilter.SHOW_TEXT)`; bỏ mark cũ bằng `replaceWith(...childNodes)` + `container.normalize()`; tách text node bằng `splitText`.
- [ ] **Step 3:** PASS; commit `feat(notes): DOM helpers for highlight offsets`.

---

### Task 7: UI highlight + popup ghi chú, gắn vào Thi thử

**Files:**
- Create: `src/notes/Highlighter.tsx` (thanh tô + popup), `src/notes/Highlighter.test.tsx`
- Modify: `src/components/QuestionCard.tsx` (prop `annotate?: { qid: number; label: string; target: (highlightId: string) => AiJobTarget }`, ref cho vùng stem và prompt; `label`/`target` chỉ dùng ở Task 8–9, Task 7 cứ truyền xuống `Highlighter`. `AiJobTarget` định nghĩa ở Task 8: nếu làm Task 7 trước thì tạm khai báo kiểu này trong `src/ai/gate.ts` đúng như Task 8)
- Modify: `src/pages/ExamPage.tsx` (Thi thử: `annotate={{ qid: bank.canonical(aq.qid), label: `Câu ${index + 1}`, target: (hl) => ({ page: 'attempt', attemptId: attempt.id, qid: aq.qid, highlightId: hl }) }}`)
- Modify: `src/styles.css` (biến `--hl-*` 3 nhánh theme; `.hl`, `.hl--note`, `.hl-toolbar`, `.hl-pop`, `.hl-sheet`, `.hl-backdrop`, media `(max-width: 639px)`)

**Interfaces:**
- Consumes: `NotesStore` qua `useApp().notes`; `model.ts`; `dom.ts`; icons (Task 1).
- Produces: `<Highlighter qid={number} question={Question} stemEl={HTMLElement | null} promptEl={HTMLElement | null} />` — `QuestionCard` render nó khi có `annotate`. Prop `aiSlot?: (ctx: { highlightId: string; text: string }) => ReactNode` để Task 9 cắm nút AI (AI tự lưu vào store, popup đọc lại từ store).

Hành vi (theo spec "Thao tác"):
- Lắng nghe `selectionchange` (document); đoạn chọn hợp lệ (qua `selectionOffsets` với stemEl hoặc promptEl) → hiện thanh 2 nút **Tô** (`aria-label="Tô"`) và **Tô + ghi chú** (`aria-label="Tô và ghi chú"`). Máy tính: đặt `position: absolute` ngay dưới `range.getBoundingClientRect()`. Mobile (`matchMedia('(max-width: 639px)')`): thanh cố định đáy màn hình.
- Bấm/Enter trên `<mark>` → mở popup của đoạn đó: máy tính là popover dưới dòng (mũi tên chỉ lên); mobile là bottom sheet + `.hl-backdrop`, đầu sheet trích `text`. Nút: AI (từ `aiSlot`), Xóa (`aria-label="Xóa đoạn tô"`), Lưu (`aria-label="Lưu ghi chú"`), mobile thêm Đóng (`aria-label="Đóng"`).
- Đóng bằng bấm ngoài / Esc / nền mờ / ✕ / đổi câu (unmount) → tự `setNote` nếu nội dung khác bản đã lưu.
- `textarea` có `maxLength={NOTE_MAX}`.
- Sau mỗi `save`, gọi `applyHighlights` với các đoạn đã `locate` được.

- [ ] **Step 1: Test** (`renderApp` lượt Thi thử; giả lập chọn bằng `document.createRange()` + `getSelection().addRange()` rồi `fireEvent(document, new Event('selectionchange'))`):
  - chọn "Stem" trong câu đầu → bấm `Tô` → có `mark.hl` chứa "Stem"; `deps.notes.get(qid)` có 1 đoạn.
  - bấm mark → gõ "ghi chú" → bấm `Lưu ghi chú` → note lưu; mark có `hl--note`.
  - gõ dở rồi bấm "Câu sau" → quay lại → note vẫn còn (Review Focus 5).
  - chọn vắt từ đề sang lựa chọn → không có nút `Tô` (Review Focus 4).
  - lượt Thi thật: chọn chữ → không có nút `Tô`; ghi chú đã có của câu đó không hiện.
  - `Xóa đoạn tô` → mark biến mất, `get(qid).highlights` rỗng.
- [ ] **Step 2:** FAIL → cài đặt → PASS.
- [ ] **Step 3:** Kiểm tra tay bằng `npm run dev` (skill `run` nếu có): theme sáng/tối, độ rộng 375px và 1280px, câu main có ảnh. Ghi lại những gì đã kiểm.
- [ ] **Step 4:** `npm run check`, commit `feat(notes): highlight and note popup in practice mode`.

---

### Task 8: Mỗi lúc một yêu cầu AI + thông báo khi xong (khung chat)

**Files:**
- Create: `src/ai/gate.ts`, `src/ai/gate.test.ts`
- Create: `src/components/AiDoneToast.tsx`, `src/components/AiDoneToast.test.tsx`
- Modify: `src/app/context.tsx` (`AppDeps.aiGate: AiGate`), `src/test/fixtures.tsx`, `src/main.tsx`
- Modify: `src/components/GeminiChat.tsx` (gửi tin đi qua gate; khóa ô nhập khi gate bận ở chỗ khác; báo "đang nhìn"; tự mở khi có yêu cầu mở)
- Modify: `src/pages/ExamPage.tsx`, `src/pages/ResultPage.tsx` (nhảy tới câu theo yêu cầu mở), `src/components/Layout.tsx` (gắn `AiDoneToast`)
- Modify: `src/styles.css` (`.ai-toast`, mobile < 640px)

**Interfaces:**
- Produces (`gate.ts`):

```ts
export type AiJobTarget =
  | { page: 'attempt'; attemptId: string; qid: number; highlightId?: string }   // chat (không highlightId) hoặc ghi chú trong lượt thi
  | { page: 'notes'; qid: number; highlightId: string };                        // ghi chú soạn từ trang #/notes
export interface AiJob { kind: 'chat' | 'note'; label: string; target: AiJobTarget } // label: "Câu 12" hoặc "Main 1 · Câu 5"
export class AiGateBusyError extends Error {}
export interface AiGate {
  current(): AiJob | null;
  /** Bận thì ném AiGateBusyError ngay, không chạy fn. Xong (resolve/reject) thì nhả và báo onFinished. */
  run<T>(job: AiJob, fn: () => Promise<T>): Promise<T>;
  subscribe(listener: () => void): () => void;
  onFinished(cb: (job: AiJob, ok: boolean) => void): () => void;
  /** Chỗ người học đang nhìn (khung chat/ popup đang mở); null khi đóng. */
  setViewing(key: string | null): void;
  viewing(): string | null;
  /** Yêu cầu mở sau khi điều hướng; nơi đích gọi take() với key của mình. */
  requestOpen(target: AiJobTarget): void;
  takeOpen(match: (t: AiJobTarget) => boolean): AiJobTarget | null;
  /** Xem yêu cầu mở đang chờ mà không xóa (ExamPage/ResultPage dùng để nhảy tới câu). */
  peekOpen(): AiJobTarget | null;
}
export function targetKey(t: AiJobTarget): string; // 'attempt:<id>:<qid>' | 'attempt:<id>:<qid>:<hl>' | 'notes:<qid>:<hl>'
export function createAiGate(): AiGate;
export function useAiGate(): AiJob | null; // useSyncExternalStore trên gate trong useApp()
```

- [ ] **Step 1: Test gate** — `run` khi rảnh chạy fn và `current()` là job trong lúc chạy, `null` sau đó; `run` thứ hai khi bận ném `AiGateBusyError` và không gọi fn; fn reject vẫn nhả gate và `onFinished(job, false)`; `takeOpen` trả target khớp đúng một lần rồi `null`; `targetKey` 3 dạng.
- [ ] **Step 2:** FAIL → cài đặt → PASS.
- [ ] **Step 3: Test toast** (`AiDoneToast` đọc `aiGate` từ `useApp()`):
  - job chat `label 'Câu 12'` xong khi `viewing()` khác → thấy `role="status"` chữ "AI đã trả lời ở Câu 12" và nút "Đến câu 12".
  - job note xong → "AI đã soạn ghi chú ở Câu 12"; `ok=false` → "AI gặp lỗi ở Câu 12".
  - `viewing() === targetKey(job.target)` lúc xong → không hiện.
  - thông báo thứ hai thay thông báo đầu; nút ✕ (`aria-label="Đóng thông báo"`) ẩn; `vi.advanceTimersByTime(10_000)` → ẩn.
  - bấm "Đến câu 12" với target `attempt` của lượt đang làm → `requestOpen` được gọi và điều hướng tới `/exam/<id>`; lượt đã nộp → `/result/<id>`; target `notes` → `/notes`.
- [ ] **Step 4:** FAIL → cài đặt `AiDoneToast` (gắn trong `Layout`), CSS: `position: fixed; top: 16px; right: 16px; max-width: 360px`, mobile `left: 16px; right: 16px`, màu `--surface`/`--border`/`--text`. → PASS.
- [ ] **Step 5: Test GeminiChat** (thêm vào `GeminiChat.test.tsx`, fake AI có câu trả lời treo bằng promise tự giải):
  - gửi ở câu 1 (lượt Thi thử), chuyển sang câu 2, mở chat câu 2 → ô nhập và nút Gửi `disabled`, thấy "AI đang trả lời ở Câu 1".
  - giải promise → ô câu 2 mở khóa; toast "AI đã trả lời ở Câu 1".
  - bấm "Đến câu 1" → ExamPage hiện câu 1 và khung chat câu 1 tự mở.
  - câu 1 đang mở khung lúc xong → không có toast.
- [ ] **Step 6:** Cài đặt: trong hàm gửi của `Conversation` bọc phần chạy nền bằng `aiGate.run({ kind: 'chat', label: \`Câu ${number}\`, target: { page: 'attempt', attemptId, qid } }, …)` (với cuộc trò chuyện ở lượt cũ dùng `target.number`/`target.attemptId`); ô nhập `disabled` khi `useAiGate()` khác null và không phải job của chính khung này; khung mở/đóng gọi `setViewing(targetKey(...))`/`setViewing(null)`. Tự mở: `Launcher` khởi tạo `open` thêm điều kiện `aiGate.takeOpen((t) => t.page === 'attempt' && t.attemptId === attemptId && t.qid === question.id && !t.highlightId)`. `ExamPage`/`ResultPage`: lúc mount, nếu có yêu cầu mở thuộc lượt này (đọc bằng một hàm `peekOpen` — thêm vào `AiGate`: `peekOpen(): AiJobTarget | null`, không xóa) thì đặt `index` tới vị trí `qid`. Nút Gửi hiện có (`cooldown`) giữ nguyên.
- [ ] **Step 7:** `npx vitest run src/ai src/components src/pages` → PASS; `npm run check`; commit `feat(ai): one AI request at a time with a done toast`.

---

### Task 9: AI soạn ghi chú (chạy nền)

**Files:**
- Create: `src/notes/ai-prompt.ts`, `src/notes/ai-prompt.test.ts`
- Create: `src/notes/note-ai.ts` (chạy nền), `src/notes/note-ai.test.ts`
- Create: `src/notes/NoteAiButton.tsx`, `src/notes/NoteAiButton.test.tsx`
- Modify: `src/components/GeminiChat.tsx` (export hàm chọn client đang dùng, xem dưới), `src/notes/Highlighter.tsx` (truyền `aiSlot` mặc định là `NoteAiButton`; khóa ô gõ khi gate bận; nhấp nháy đoạn đang soạn; tự mở popup theo `takeOpen`; `setViewing`)
- Modify: `src/styles.css` (`.hl--drafting` nhấp nháy, tắt trong `@media (prefers-reduced-motion: reduce)`)

**Interfaces:**
- Consumes: `AiGate` (Task 8), `NotesStore`, `setNote` (Task 4).
- Produces:

```ts
export const NOTE_AI_UNCLEAR = 'Không rõ bạn muốn ghi chú gì ở đoạn này.';
export function buildNotePrompt(question: Question, highlight: string): string;
// GeminiChat.tsx: tách logic chọn client của GeminiButton thành hook dùng chung
export function useActiveAi(): { client: AiClient; brand: 'Gemini' | 'AI'; uid: string; settingsStore?: LocalSettingsStore } | null;
// note-ai.ts — chạy ngoài React, không phụ thuộc popup còn mở
export function draftNote(deps: { gate: AiGate; notes: NotesStore; client: AiClient; settings?: LocalAiSettings; cooldown: Cooldown; now: () => number },
  job: { question: Question; qid: number; highlightId: string; text: string; label: string; target: AiJobTarget }): Promise<void>;
/** Lỗi gần nhất theo highlightId (bộ nhớ), để popup hiện dòng lỗi + nút thử lại. */
export function lastNoteError(highlightId: string): string | undefined;
export function NoteAiButton(props: { question: Question; qid: number; highlightId: string; text: string; label: string; target: AiJobTarget }): JSX.Element | null;
```

- [ ] **Step 1: Test prompt**

```ts
const p = buildNotePrompt(q, 'LEAST operational overhead');
expect(p).toContain('LEAST operational overhead');
expect(p).toContain(htmlToTextIfNeeded(q.stem));
for (const o of q.options) expect(p).toContain(o.text);
expect(p).not.toMatch(/Đáp án đúng/);
expect(p).not.toContain(q.explanationOrig);
expect(p).toContain(NOTE_AI_UNCLEAR);
```
Nội dung prompt (tiếng Việt): vai trợ giảng SAA-C03; đề + câu hỏi + lựa chọn (văn bản thuần, không nhãn A/B/C, câu HTML qua `htmlToText`); đoạn tô; yêu cầu 1–3 câu tiếng Việt giải thích đoạn tô nghĩa là gì và gợi ý yêu cầu gì của đề, giữ thuật ngữ AWS tiếng Anh; **cấm** nói lựa chọn nào đúng/sai hay coi dịch vụ trong lựa chọn là đáp án; đoạn vô nghĩa thì chỉ trả lời đúng chuỗi `NOTE_AI_UNCLEAR`; không LaTeX.
- [ ] **Step 2:** FAIL → cài đặt → PASS.
- [ ] **Step 3: `useActiveAi`** — tách đúng điều kiện của `GeminiButton` (`sync` + đã đăng nhập + client theo `aiMode`); `GeminiButton` dùng lại hook này (không đổi hành vi, test GeminiChat hiện có phải vẫn xanh).
- [ ] **Step 4: Test `draftNote`** (fake AI, `createAiGate()`, `createNotesStore(memoryStorage())` có owner `'A'`):
  - ghi chú đang trống, AI trả "ABC" → `notes.get(qid)` đoạn đó có note `'ABC'`; note đang là `'x'` → `'x\n\nABC'`; kết quả cắt `NOTE_MAX`.
  - `startChat` nhận prompt không chứa đáp án; không truyền `tools`.
  - trong lúc chạy `gate.current()?.kind === 'note'`; xong `null` và `onFinished(job, true)`.
  - đoạn tô bị xóa trước khi xong → không ghi gì; owner đổi sang `'B'` trước khi xong → ngăn A và B đều không bị ghi.
  - AI lỗi → `lastNoteError(highlightId)` có câu báo, `onFinished(job, false)`; lần chạy thành công sau thì xóa lỗi.
  - gate đang bận → ném `AiGateBusyError`, không gọi AI.
- [ ] **Step 5:** Cài đặt `draftNote`: ghi nhớ `owner` lúc bắt đầu; `gate.run(job, () => withRetry(...))` với `client.startChat(buildNotePrompt(question, text), [], { settings, retry: { onWait: (w) => cooldown.set(w.until) } })`, gom chunk của `send('Soạn ghi chú cho đoạn đã tô.')`, `trim()`; xong thì kiểm owner và đoạn còn tồn tại rồi `notes.save(setNote(...))`. Lọc `<think>` đã do adapter local lo.
- [ ] **Step 6: Test UI** (`NoteAiButton.test.tsx` + bổ sung `Highlighter.test.tsx`):
  - chưa đăng nhập → không có nút `aria-label="AI soạn ghi chú"`.
  - bấm AI soạn ở câu 1, chuyển sang câu 2, mở popup một đoạn tô → `textarea` và nút AI soạn `disabled`, thấy "AI đang soạn ghi chú ở Câu 1"; nút Xóa đoạn tô vẫn bấm được; tô đoạn mới vẫn được.
  - chat AI đang chạy → ô ghi chú cũng `disabled` với dòng "AI đang trả lời ở Câu …".
  - đoạn đang soạn có class `hl--drafting`; xong thì mất.
  - xong khi đang ở câu 2 → toast "AI đã soạn ghi chú ở Câu 1"; bấm "Đến câu 1" → câu 1 hiện và popup của đúng đoạn đó mở, `textarea` chứa chữ AI.
  - popup của đúng đoạn đó đang mở lúc xong → không toast, `textarea` cập nhật chữ mới.
  - lỗi → mở popup thấy dòng lỗi và nút thử lại (`aria-label="Thử lại AI soạn"`).
- [ ] **Step 7:** Cài đặt `NoteAiButton` (dùng `useActiveAi`, `useApp().aiGate/notes/aiCooldown/now`, tải `settings` từ `settingsStore` như khung chat) và các thay đổi trong `Highlighter`. `label`/`target`: ExamPage truyền `Câu ${index + 1}` và `{ page: 'attempt', attemptId, qid: aq.qid, highlightId }`; trang ghi chú truyền nhãn mục và `{ page: 'notes', qid, highlightId }`. Muốn vậy `annotate` mở rộng thành `{ qid: number; label: string; target: (highlightId: string) => AiJobTarget }`.
- [ ] **Step 8:** `npm run check`, commit `feat(notes): AI-drafted notes in the background without revealing answers`.

---

### Task 10: Trang "Ghi chú của tôi" (`#/notes`)

**Files:**
- Create: `src/pages/NotesPage.tsx`, `src/pages/NotesPage.test.tsx`
- Modify: `src/app/routes.tsx` (`<Route path="notes" element={<NotesPage />} />`), `src/components/Layout.tsx` (NavLink "Ghi chú" ngay sau "Lịch sử"). `NotesPage` lúc mount đọc `aiGate.peekOpen()` (target `notes`) để cuộn tới `#note-<qid>`; popup do `Highlighter` của mục đó tự mở qua `takeOpen` như ở ExamPage (thêm test: toast "Đến câu" từ job notes mở đúng popup)
- Modify: `CLAUDE.md` (mục Kiến trúc: thêm đoạn `src/notes/`)

**Interfaces:**
- Consumes: `notes.list()`, `notes.subscribe`, `bank.canonical`, `QuestionCard` với `annotate`, `normalizeSearch` (export sẵn từ `GeminiChat.tsx`), `setLabel`.

- [ ] **Step 1: Test**
  - không có ghi chú → thấy dòng "Chưa có ghi chú. Vào Thi thử, bôi đen chữ trong đề để tô."
  - 2 câu có ghi chú (updatedAt 100 và 200) → câu 200 đứng trước; mỗi mục có đề (`Stem N`), các lựa chọn (`Option A of N`…), danh sách đoạn tô + ghi chú.
  - lựa chọn không có class `opt--correct`/`opt--missed` (không lộ đáp án) và các nút lựa chọn `disabled`.
  - ô tìm "ghi chu khong dau" khớp ghi chú "ghi chú không dấu"; không khớp thì mục bị ẩn.
  - đoạn không còn tìm thấy (sửa `text` cho lệch) → hiện "Không còn tìm thấy đoạn này trong đề".
  - Layout có link "Ghi chú" tới `#/notes`.
- [ ] **Step 2:** FAIL → cài đặt: tiêu đề "Ghi chú của tôi"; nhãn mục: câu thuộc đề main (`qid >= 10000`) → `${setLabel(Math.floor(qid / 100))} · Câu ${qid % 100}`, sub → `Câu ${qid}`; `QuestionCard` với `order` gốc, `selected=[]`, `reveal={false}`, không `onSelect`, `annotate={{ qid, label: nhãn mục, target: (hl) => ({ page: 'notes', qid, highlightId: hl }) }}`; mỗi mục có `id="note-<qid>"` để cuộn tới khi mở từ toast.
- [ ] **Step 3:** PASS; cập nhật `CLAUDE.md`: "`src/notes/`: highlight + ghi chú ở Thi thử (spec 2026-11-11). `model.ts` (hàm thuần: gộp đoạn, `locate`, `mergeNotes`), `store.ts` (localStorage theo ngăn `saa-c03:notes:v1:<uid|guest>`, đăng nhập thì gộp ngăn khách), `sync.ts` (đồng bộ `users/{uid}/notes/{qid}`, controller riêng), `dom.ts`, `Highlighter.tsx`, `ai-prompt.ts` (không gửi đáp án). Lưu theo `bank.canonical(qid)`. Trang `#/notes`. Đáp án câu Thi thử bị khóa sau khi mở hướng dẫn (`selectOption`)."
- [ ] **Step 4:** `npm run check` (và `npm run build`), commit `feat(notes): "Ghi chú của tôi" page`.

# Main VI/EN Guide + Answer Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every main question (390 originals, twins included via copy) gets a Vietnamese guide like the sub bank, its answer gets reviewed, and the guide panel of main questions gets VI/EN tabs.

**Architecture:** Hand-written `data/main-vi/ptX_1.json` (format `QuestionVi`) is loaded through `import.meta.glob`, copied onto twin ids with a generic `expandTwins`, and merged into `bank.vi`. `validateMain` validates it with the existing `validateVi`. `GuidePanel` shows two tabs when `question.html && vi`.

**Tech Stack:** Vite + React + TypeScript + Vitest, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-11-02-main-vi-review-design.md`

## Global Constraints

- Never edit `question-doc-main/*` and never change an original answer; doubts go into `review: { reason }` only.
- Translations only for ids of `ptX_1` sets (101, 103, 105, 107, 109, 111 → ids 101xx, 103xx, …); `ptX_2` ids get copies through `twins`.
- `explanationVi`, `keyHint`, `reason`, `review.reason` must not refer to options by letter (`hasLetterRef` enforces it); `explanationVi` explains the original answer.
- Main questions have `prompt: ''`: put the final question sentence ("Which solution…?") of the stem into `promptVi`, the rest into `stemVi`.
- Code/IAM JSON in stems/options stays verbatim, as its own paragraph with **no blank line inside** it; tables become plain lines.
- `review` when the answer is wrong/doubtful **or** depends on a retired/retiring service; `meta.note` only for outdated-but-correct info. Mixed existing notes get split.
- Style rules: `docs/vi-style-guide.md`.
- localStorage key: `saa-c03:guide-lang`, values `vi` | `en`, default `vi`, every access in try/catch (pattern: `src/app/theme.ts`).
- `npm run check` passes after every task.

## Review Focus

1. A `ptX_2` question (twin) must show the VI tab with the original's translation — test in Task 1.
2. localStorage throwing must not break the panel; it falls back to VI — test in Task 3.
3. `vi.review` warning visible on the EN tab — test in Task 3.
4. A code/JSON paragraph in `stemVi` renders in `<pre>` with line breaks kept — test in Task 3.
5. Reasons follow the shuffled display order for main questions (labels A/B/C… computed from `order`) — test in Task 3.

---

### Task 1: Copy translations onto twins and load `data/main-vi`

**Files:**
- Modify: `src/data/main-meta.ts`, `src/data/load.ts`
- Test: `src/data/main-meta.test.ts` (create if missing)

**Interfaces:**
- Produces: `expandTwins<T extends { id: number }>(items: T[], twins: [number, number][]): T[]` in `src/data/main-meta.ts` (same semantics as today's `expandMainMetas`: copy original onto twin id unless twin already present). `expandMainMetas` becomes `expandTwins` for metas (keep the export name, delegate).

- [ ] **Step 1: Write failing test** `expandTwins copies a QuestionVi onto its twin id`: input `[{ id: 10101, stemVi: 'x', … }]`, twins `[[10101, 10201]]` → result has ids `[10101, 10201]` and the copy's `stemVi === 'x'`; a twin already present is not overwritten.
- [ ] **Step 2:** `npx vitest run src/data/main-meta.test.ts` → FAIL (`expandTwins` not exported).
- [ ] **Step 3:** Implement `expandTwins`; make `expandMainMetas` call it.
- [ ] **Step 4:** In `load.ts` add `const mainViFiles = import.meta.glob<QuestionVi[]>('../../data/main-vi/*.json', …)` and pass `vis: [...Object.values(viFiles).flat(), ...expandTwins(Object.values(mainViFiles).flat(), mainFile.twins)]`. Create `data/main-vi/` with an empty `pt1_1.json` (`[]`) so the glob dir exists.
- [ ] **Step 5:** `npm test` → PASS; `npm run typecheck` → no errors.
- [ ] **Step 6: Commit** `feat(main): load Vietnamese guides for main and copy them onto twins`.

### Task 2: Validate `data/main-vi` and improve `main:show`

**Files:**
- Modify: `scripts/lib/validate-main.ts`, `scripts/validate.ts`, `scripts/show-main.ts`
- Test: `scripts/lib/validate-main.test.ts`

**Interfaces:**
- Consumes: `validateVi(questions, vis)` from `scripts/lib/validate-vi.ts`.
- Produces: `MainValidationInput.vis: QuestionVi[]`.

- [ ] **Step 1: Write failing tests** in `validate-main.test.ts`:
  - `main-vi cho id không tồn tại là lỗi` → errors contain `main-vi: câu 99999 không tồn tại`.
  - `main-vi đặt cho câu trùng (twin) là lỗi` → vi for the twin id → error containing `là câu trùng`.
  - `main-vi thiếu bản dịch chỉ là cảnh báo` → no vis → `errors` has no `main-vi` entry, `warnings` contains `chưa có bản dịch`.
  - `main-vi nhắc chữ cái là lỗi` → `explanationVi: 'Chọn B vì…'` → error containing `chữ cái`.
- [ ] **Step 2:** `npx vitest run scripts/lib/validate-main.test.ts` → FAIL.
- [ ] **Step 3:** In `validateMain`: originals = `main.questions` minus twin ids (`twins.map(([, t]) => t)`); vis whose id is a twin id → error `main-vi: câu ${id} là câu trùng, chỉ soạn cho câu gốc`; run `validateVi(originals, vis without twin ids)` and prefix each error/warning with `main-` (messages start with `vi:`). Add `vis: readJsonDir<QuestionVi>('data/main-vi')` in `scripts/validate.ts`.
- [ ] **Step 4:** `show-main.ts`: print header target `data/main-vi/${set.file}`, and per question print the meta line (`domain`, `note` if any) from `data/main-meta/${set.file}` when present.
- [ ] **Step 5:** `npm run check` → PASS (warning `390 câu chưa có bản dịch` expected).
- [ ] **Step 6: Commit** `feat(main): validate main Vietnamese guides`.

### Task 3: VI/EN tabs in `GuidePanel`

**Files:**
- Modify: `src/components/GuidePanel.tsx`, `src/styles.css`
- Test: `src/components/GuidePanel.test.tsx`

**Interfaces:**
- Consumes: existing `GuidePanelProps` (no new props).
- Produces: tab buttons with `role="tab"`, names `VI` and `EN`, inside `role="tablist"` labelled `Ngôn ngữ hướng dẫn`.

Rendering rules: tabs only when `question.html && vi`. Outside the tabs, in this order: answer, service status, `meta.note`, `vi.review` (moved out of the VI block), then the tab content, then service chips. VI content = today's VI block minus the review line; EN content = today's `guide__orig` HTML block. Any `\n\n` paragraph of `stemVi`/`textVi` whose trimmed text starts with `{` or `[` renders as `<pre>` (sub/external untouched otherwise). Sub and External: unchanged output.

- [ ] **Step 1: Write failing tests** (use `makeMainQuestion`-style HTML question from fixtures, export it if needed, plus a `QuestionVi` literal):
  - `câu main có bản dịch mặc định mở tab VI` → `getByRole('tab', { name: 'VI' })` has `aria-selected="true"`, Vietnamese stem visible, `Main explanation` not in document.
  - `bấm EN hiện giải thích gốc HTML` → after click, `Main explanation` visible and VI stem gone.
  - `nhớ tab đã chọn` → click EN, unmount, render again → EN selected; `localStorage.getItem('saa-c03:guide-lang') === 'en'`.
  - `localStorage lỗi vẫn mở tab VI` → `vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error() })` → VI selected, no throw.
  - `cảnh báo review vẫn hiện ở tab EN` → vi with `review: { reason: 'Nghi sai' }`, click EN → text `Nghi sai` visible.
  - `đoạn JSON trong stemVi hiển thị trong pre` → `stemVi: 'Chính sách:\n\n{\n  "Effect": "Allow"\n}'` → `container.querySelector('pre')?.textContent` contains `"Effect": "Allow"`.
  - `lý do theo thứ tự hiển thị` → `order=['C','A','B','D']`, answer `['B']` → text `C. <textVi of B> — Đúng`.
  - `câu main chưa có bản dịch không có tab` → `queryByRole('tab')` null, `Main explanation` visible.
  - `câu sub không có tab` → sub question with vi → `queryByRole('tab')` null.
- [ ] **Step 2:** `npx vitest run src/components/GuidePanel.test.tsx` → new tests FAIL.
- [ ] **Step 3:** Implement in `GuidePanel.tsx`; small `useGuideLang(): ['vi' | 'en', (l) => void]` hook in the same file following `theme.ts`. CSS: `.guide__tabs`, `.guide__tab[aria-selected="true"]`, `.guide pre { white-space: pre-wrap; overflow-x: auto; }` using existing tokens.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5: Commit** `feat(main): VI/EN tabs in the guide for main questions`.

### Tasks 4–9: Translate + review one `_1` file each

One task per file: Task 4 `pt1_1`, 5 `pt2_1`, 6 `pt3_1`, 7 `pt4_1`, 8 `pt5_1`, 9 `pt6_1`. Each file = 65 questions in three batches (1–22, 23–44, 45–65), appended to `data/main-vi/<file>.json` (array sorted by id).

**Files:**
- Create/Modify: `data/main-vi/<file>.json`
- Modify (only when moving/splitting notes): `data/main-meta/<file>.json`

Per batch:
- [ ] **Step 1:** `npm run main:show -- <file> <start> <end>` and read `docs/vi-style-guide.md` (once per task).
- [ ] **Step 2:** For each question, check the original answer against current AWS knowledge (official docs when unsure). Decide: fine / `review` (wrong, doubtful, or depends on retired/retiring service — consult `src/data/service-status.ts`) / `meta.note` (outdated but correct).
- [ ] **Step 3:** Write the `QuestionVi` entries (Global Constraints apply). For an existing `meta.note`: move the answer-doubt part into `review.reason`, keep the outdated-only part in `note`, delete `note` if empty.
- [ ] **Step 4:** `npm run check` → PASS, and `npm run validate` shows no `main-vi` error.
- [ ] **Step 5: Commit** `content(main): Vietnamese guide + review for <file> Q<start>-<end>`.

Task 6 note: 10528 (pt3_1) and 11164 (pt6_1) are the same question with options in a different order; translate both with the same content (keys follow each file's own letters). Task 9 reuses Task 6's wording for 11164.

At the end of each task, list the task's `review` ids with a one-line reason in the final report of the task (Task 10 compiles them).

### Task 10: Review summary

**Files:**
- Create: `docs/main-review.md`

- [ ] **Step 1:** Generate the table (id, file, position, short reason) of every `review` in `data/main-vi/*.json` and every remaining `note` in `data/main-meta/*.json`, as two sections.
- [ ] **Step 2:** `npm run check` → PASS; `npm run validate` shows `0` for `chưa có bản dịch` in main.
- [ ] **Step 3:** Update `CLAUDE.md` (Main bullet: `data/main-vi`, tabs VI/EN) and commit `docs(main): review summary for main questions`.

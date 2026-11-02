# SAA-C03 Exam Site — Giai đoạn 1 (Dữ liệu + Web lõi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển 500 câu trong `Question-Doc/` thành dữ liệu JSON đã phân loại, xếp thành 7 đề, và xây web tĩnh làm bài Thi thật / Thi thử, chấm điểm, xem lại và thống kê theo domain. Giai đoạn này dùng giải thích gốc; bản dịch tiếng Việt và ghi chú service đầy đủ thuộc giai đoạn 2–3.

**Architecture:** Các script Node (`scripts/`, chạy bằng `tsx`) parse file nguồn thành `data/questions.json`, kiểm tra dữ liệu và xếp đề ra `data/sets.json`. Web (Vite + React) import trực tiếp các file JSON. Toàn bộ logic (tạo lượt thi, xáo trộn, chấm điểm, thống kê) là hàm thuần trong `src/engine/`, có test Vitest. Các trang React chỉ ghép dữ liệu với các hàm này. Trạng thái bài thi lưu trong `localStorage` qua `src/storage/`.

**Tech Stack:** Node 26, TypeScript, Vite, React 19, react-router-dom (HashRouter), Vitest + jsdom + Testing Library, fflate (giải nén .docx), tsx.

**Spec:** `docs/superpowers/specs/2026-09-24-saa-c03-exam-site-design.md`

**Điều chỉnh nhỏ so với spec (đã cân nhắc):** danh sách id service chuẩn nằm ở `data/service-registry.json` (id, name, category). Validate báo **lỗi** nếu meta dùng id không có trong registry (chặn gõ sai), và báo **cảnh báo** nếu service chưa có file ghi chú `data/services/<id>.json` (phần ghi chú thuộc giai đoạn 3). Nhờ vậy `npm run check` chạy qua được ngay trong giai đoạn 1.

## Global Constraints

- Nguồn câu hỏi duy nhất là 500 câu trong `Question-Doc/`. Không tạo thêm câu hỏi hay lựa chọn, không sửa đáp án gốc, không sửa file trong `Question-Doc/`.
- Mỗi đề 65 câu: **Secure 20 · Resilient 17 · High-Performing 15 · Cost-Optimized 13**. Có 7 đề, kho dự phòng 45 câu.
- Mỗi lượt thi hoán đổi **10 câu** với kho dự phòng (ưu tiên cùng domain và cùng độ khó, sau đó cùng domain, nếu không có thì giữ nguyên). Xáo thứ tự câu hỏi, rồi xáo thứ tự lựa chọn.
- Điểm = `round(100 + 900 × số câu đúng / 65)`, đậu khi **≥ 720**. Câu nhiều đáp án phải chọn đúng đủ mới được điểm. Câu bỏ trống tính là sai.
- Thi thật: 130 phút, hoặc 160 phút khi bật ESL +30 (bật sẵn). Đồng hồ tính theo `endsAt`. Hết giờ tự nộp.
- Đề bài và các lựa chọn luôn bằng tiếng Anh. Tiếng Việt chỉ nằm trong hướng dẫn. Màn hình Thi thật dùng giao diện tiếng Anh, các trang khác dùng tiếng Việt.
- Thi thật không hiện hướng dẫn, đáp án hay tô màu cho đến khi nộp. Thi thử mở được hướng dẫn tại từng câu; câu đã mở hướng dẫn được ghi vào `guideOpened`.
- Xem lại: chọn và đúng → `opt--correct-chosen` (xanh); chọn nhưng sai → `opt--wrong-chosen` (đỏ); đúng nhưng không chọn → `opt--missed` (viền xanh, nhãn "Đáp án đúng").
- Hàm ngẫu nhiên luôn nhận `rng` có seed. Build-sets dùng seed cố định `20260924`.
- Nội dung soạn tay (meta, vi) không dùng chữ cái A/B/C… để chỉ lựa chọn.
- Chạy lệnh trong Git Bash; khi in tiếng Việt ra console bằng Python, dùng `PYTHONIOENCODING=utf-8`.

## Review Focus

1. **Tải lại trang giữa bài thi** → vẫn còn đáp án đã chọn và đồng hồ vẫn đúng (Task 11 có test render lại cùng attempt).
2. **Câu nhiều đáp án** → không cho chọn quá N, và chấm đúng khi chọn thiếu hoặc thừa (Task 7 test `selectOption`, Task 8 test `isCorrect`).
3. **`localStorage` bị chặn hoặc đầy** → web vẫn chạy nhờ bộ nhớ tạm, có banner báo (Task 9 test `setItem` ném lỗi).
4. **Dữ liệu `localStorage` hỏng hoặc lượt thi cũ không khớp dữ liệu mới** → bỏ qua bản ghi hỏng, đánh dấu không tương thích, không sập trang (Task 9 test JSON hỏng, Task 7 test `isCompatible`).
5. **Định dạng nguồn lệch chuẩn** (đáp án "A, C", giải thích nhiều đoạn, lựa chọn xuống dòng) → parser vẫn đúng hoặc báo lỗi rõ ràng (Task 2–3 có test cho từng trường hợp; Task 4 validate chặn số đáp án sai).

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
scripts/
  lib/build-question.ts   dựng Question từ các đoạn văn (dùng chung cho md/docx)
  lib/parse-md.ts         parse file .md
  lib/parse-docx.ts       đọc paragraph từ .docx + parse
  lib/validate.ts         hàm validate thuần
  lib/build-sets.ts       hàm xếp đề thuần
  lib/io.ts               đọc/ghi JSON, đọc thư mục JSON
  parse.ts, validate.ts, build-sets.ts   CLI
data/
  questions.json          (sinh ra) 500 câu
  meta/qNNN-NNN.json      (soạn tay) domain/độ khó/service
  service-registry.json   (soạn tay) danh sách id service
  sets.json               (sinh ra) 7 đề + kho dự phòng
src/
  data/types.ts, constants.ts, bank.ts, load.ts
  engine/rng.ts, attempt.ts, actions.ts, scoring.ts, review.ts, stats.ts, timer.ts
  storage/storage.ts
  app/context.tsx, routes.tsx, labels.ts, format.ts, theme.ts
  components/Layout.tsx, QuestionCard.tsx, GuidePanel.tsx, ServiceChip.tsx, NavGrid.tsx, Timer.tsx, DomainBars.tsx, DomainTable.tsx
  pages/HomePage.tsx, SetStatsPage.tsx, ExamPage.tsx, ResultPage.tsx, QuestionViewPage.tsx, ServicesPage.tsx, ServiceDetailPage.tsx
  test/setup.ts, fixtures.tsx
  main.tsx, styles.css
```

---

### Task 1: Scaffold project, kiểu dữ liệu và hằng số

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/test/setup.ts`, `src/data/types.ts`, `src/data/constants.ts`
- Modify: `.gitignore`
- Test: `src/data/constants.test.ts`

**Interfaces:**
- Produces: `Domain`, `Difficulty`, `Option`, `Question`, `QuestionMeta`, `ViOption`, `QuestionVi`, `ServiceRef`, `ExamSet`, `SetsFile` (types.ts); `TOTAL_QUESTIONS`, `SET_COUNT`, `SET_SIZE`, `DOMAINS`, `DOMAIN_QUOTA`, `DOMAIN_NAMES`, `DOMAIN_SHORT`, `SERVICE_CATEGORIES`, `byDomainRecord<T>(fn)` (constants.ts)

- [ ] **Step 1: Tạo `package.json`**

```json
{
  "name": "saa-c03-exam",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "parse": "tsx scripts/parse.ts",
    "sets": "tsx scripts/build-sets.ts",
    "validate": "tsx scripts/validate.ts",
    "data": "npm run parse && npm run sets && npm run validate",
    "check": "npm run validate && npm run test && npm run typecheck"
  }
}
```

- [ ] **Step 2: Cài dependency**

Run:
```bash
cd "D:/VsCode/aws" && npm install react react-dom react-router-dom && npm install -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @types/react @types/react-dom @types/node tsx fflate
```
Expected: cài xong, không có lỗi `ERR!`.

- [ ] **Step 3: Tạo `tsconfig.json`, `vite.config.ts`, `index.html`, `src/test/setup.ts`, `src/main.tsx`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client", "vitest/globals", "node", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Luyện thi SAA-C03</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`src/main.tsx` (tạm thời, Task 10 sẽ thay):
```tsx
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(<p>Đang xây dựng…</p>);
```

`.gitignore` (ghi đè toàn bộ):
```
node_modules/
dist/
```

- [ ] **Step 4: Viết test thất bại cho hằng số**

`src/data/constants.test.ts`:
```ts
import { DOMAINS, DOMAIN_QUOTA, SET_COUNT, SET_SIZE, TOTAL_QUESTIONS, byDomainRecord } from './constants';

describe('constants', () => {
  it('quota cộng lại đúng 65 câu mỗi đề', () => {
    expect(DOMAINS.reduce((s, d) => s + DOMAIN_QUOTA[d], 0)).toBe(SET_SIZE);
  });

  it('7 đề × 65 câu không vượt quá ngân hàng câu hỏi, dư đúng 45', () => {
    expect(TOTAL_QUESTIONS - SET_COUNT * SET_SIZE).toBe(45);
  });

  it('byDomainRecord tạo đủ 4 domain', () => {
    expect(byDomainRecord((d) => d * 10)).toEqual({ 1: 10, 2: 20, 3: 30, 4: 40 });
  });
});
```

- [ ] **Step 5: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/data/constants.test.ts`
Expected: FAIL, lỗi không resolve được `./constants`.

- [ ] **Step 6: Viết `src/data/types.ts` và `src/data/constants.ts`**

`src/data/types.ts`:
```ts
export type Domain = 1 | 2 | 3 | 4;
export type Difficulty = 1 | 2 | 3;

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: number;
  stem: string;
  prompt: string;
  options: Option[];
  answer: string[];
  choose: number;
  explanationOrig: string;
}

export interface QuestionMeta {
  id: number;
  domain: Domain;
  difficulty: Difficulty;
  services: string[];
}

export interface ViOption {
  key: string;
  textVi: string;
  reason: string;
}

export interface QuestionVi {
  id: number;
  stemVi: string;
  promptVi: string;
  options: ViOption[];
  explanationVi: string;
  keyHint: string;
  review?: { reason: string };
}

export interface ServiceRef {
  id: string;
  name: string;
  category: string;
}

export interface ExamSet {
  id: number;
  questionIds: number[];
}

export interface SetsFile {
  version: number;
  sets: ExamSet[];
  reserve: number[];
}
```

`src/data/constants.ts`:
```ts
import type { Domain } from './types';

export const TOTAL_QUESTIONS = 500;
export const SET_COUNT = 7;
export const SET_SIZE = 65;

export const DOMAINS: Domain[] = [1, 2, 3, 4];

export const DOMAIN_QUOTA: Record<Domain, number> = { 1: 20, 2: 17, 3: 15, 4: 13 };

export const DOMAIN_NAMES: Record<Domain, string> = {
  1: 'Design Secure Architectures',
  2: 'Design Resilient Architectures',
  3: 'Design High-Performing Architectures',
  4: 'Design Cost-Optimized Architectures',
};

export const DOMAIN_SHORT: Record<Domain, string> = {
  1: 'Secure',
  2: 'Resilient',
  3: 'High-Performing',
  4: 'Cost-Optimized',
};

// Danh mục "In-Scope AWS Services" trong Exam Guide SAA-C03.
export const SERVICE_CATEGORIES = [
  'Analytics',
  'Application Integration',
  'AWS Cost Management',
  'Compute',
  'Containers',
  'Database',
  'Developer Tools',
  'Front-End Web and Mobile',
  'Machine Learning',
  'Management and Governance',
  'Media Services',
  'Migration and Transfer',
  'Networking and Content Delivery',
  'Security, Identity, and Compliance',
  'Serverless',
  'Storage',
] as const;

export function byDomainRecord<T>(fn: (d: Domain) => T): Record<Domain, T> {
  return { 1: fn(1), 2: fn(2), 3: fn(3), 4: fn(4) };
}
```

- [ ] **Step 7: Chạy test và typecheck**

Run: `npx vitest run src/data/constants.test.ts && npm run typecheck`
Expected: 3 test PASS; typecheck không có lỗi.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src
git commit -m "chore: scaffold Vite + React + TS project with core data types"
```

---

### Task 2: Parser Markdown (Q1–50)

**Files:**
- Create: `scripts/lib/build-question.ts`, `scripts/lib/parse-md.ts`
- Test: `scripts/lib/parse-md.test.ts`

**Interfaces:**
- Consumes: `Question`, `Option` từ `src/data/types.ts`
- Produces: `OPTION_RE: RegExp`; `buildQuestion(id: number, paragraphs: string[], options: Option[], answerRaw: string, explanation: string): Question`; `parseMarkdown(src: string): Question[]`

- [ ] **Step 1: Viết test thất bại**

`scripts/lib/parse-md.test.ts`:
```ts
import { parseMarkdown } from './parse-md';

const SAMPLE = `# AWS SAA-C03 Practice Questions

## Question 1

A company needs storage.

It has two paragraphs of context.

**Which solution meets these requirements?**

A. Use Amazon S3.
B. Use Amazon EBS.
C. Use Amazon EFS
with a continuation line.
D. Use Amazon FSx.

**Answer: A**

**Explanation:** S3 là object storage.
Dòng thứ hai của giải thích.

---

## Question 2

Pick two things. **Which combination of steps will meet these requirements? (Choose two.)**

A. One.
B. Two.
C. Three.
D. Four.
E. Five.

**Answer: A, E**

**Explanation:** Chọn A và E.

---
`;

describe('parseMarkdown', () => {
  const qs = parseMarkdown(SAMPLE);

  it('tách đúng số câu và id', () => {
    expect(qs.map((q) => q.id)).toEqual([1, 2]);
  });

  it('tách đề bài (stem) và câu hỏi (prompt), bỏ dấu **', () => {
    expect(qs[0].stem).toBe('A company needs storage.\n\nIt has two paragraphs of context.');
    expect(qs[0].prompt).toBe('Which solution meets these requirements?');
  });

  it('ghép dòng nối tiếp vào lựa chọn trước đó', () => {
    expect(qs[0].options).toEqual([
      { key: 'A', text: 'Use Amazon S3.' },
      { key: 'B', text: 'Use Amazon EBS.' },
      { key: 'C', text: 'Use Amazon EFS with a continuation line.' },
      { key: 'D', text: 'Use Amazon FSx.' },
    ]);
  });

  it('đọc đáp án một và nhiều lựa chọn', () => {
    expect(qs[0].answer).toEqual(['A']);
    expect(qs[0].choose).toBe(1);
    expect(qs[1].answer).toEqual(['A', 'E']);
    expect(qs[1].choose).toBe(2);
    expect(qs[1].options).toHaveLength(5);
  });

  it('giữ giải thích nhiều dòng, không lấy dấu ---', () => {
    expect(qs[0].explanationOrig).toBe('S3 là object storage.\nDòng thứ hai của giải thích.');
  });

  it('câu hỏi nằm chung đoạn với stem vẫn được giữ nguyên trong prompt', () => {
    expect(qs[1].stem).toBe('');
    expect(qs[1].prompt).toBe(
      'Pick two things. **Which combination of steps will meet these requirements? (Choose two.)**'.replace(/\*\*/g, ''),
    );
  });

  it('báo lỗi rõ ràng khi thiếu Answer', () => {
    expect(() => parseMarkdown('## Question 9\n\nText\n\nA. x\nB. y\n')).toThrow('Câu 9');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run scripts/lib/parse-md.test.ts`
Expected: FAIL, không resolve được `./parse-md`.

- [ ] **Step 3: Viết `scripts/lib/build-question.ts`**

```ts
import type { Option, Question } from '../../src/data/types';

export const OPTION_RE = /^([A-F])\.\s+(.*)$/;

export function buildQuestion(
  id: number,
  paragraphs: string[],
  options: Option[],
  answerRaw: string,
  explanation: string,
): Question {
  if (options.length === 0) throw new Error(`Câu ${id}: không có lựa chọn`);
  const cleaned = paragraphs.map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean);
  const prompt = cleaned.at(-1) ?? '';
  const stem = cleaned.slice(0, -1).join('\n\n');
  const answer = answerRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (answer.length === 0) throw new Error(`Câu ${id}: đáp án rỗng`);
  return { id, stem, prompt, options, answer, choose: answer.length, explanationOrig: explanation.trim() };
}
```

- [ ] **Step 4: Viết `scripts/lib/parse-md.ts`**

```ts
import type { Option, Question } from '../../src/data/types';
import { OPTION_RE, buildQuestion } from './build-question';

const ANSWER_RE = /\*\*Answer:\s*([A-F](?:\s*,\s*[A-F])*)\s*\*\*/;
const EXPLANATION_RE = /\*\*Explanation:\*\*\s*([\s\S]*)$/;

export function parseMarkdown(src: string): Question[] {
  const text = src.replace(/\r\n/g, '\n');
  const parts = text.split(/^## Question (\d+)\s*$/m);
  const out: Question[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push(parseBlock(Number(parts[i]), parts[i + 1]));
  }
  return out;
}

function parseBlock(id: number, rawBody: string): Question {
  const body = rawBody.split(/^---\s*$/m)[0];
  const answerMatch = body.match(ANSWER_RE);
  if (!answerMatch || answerMatch.index === undefined) throw new Error(`Câu ${id}: không tìm thấy **Answer:**`);
  const explanation = body.slice(answerMatch.index).match(EXPLANATION_RE)?.[1] ?? '';
  const head = body.slice(0, answerMatch.index);

  const paragraphs: string[] = [];
  const options: Option[] = [];
  let buffer: string[] = [];
  const flushParagraph = () => {
    if (buffer.length) paragraphs.push(buffer.join(' ').trim());
    buffer = [];
  };

  for (const rawLine of head.split('\n')) {
    const line = rawLine.trim();
    const opt = line.match(OPTION_RE);
    if (opt) {
      flushParagraph();
      options.push({ key: opt[1], text: opt[2].trim() });
    } else if (line === '') {
      flushParagraph();
    } else if (options.length > 0) {
      const last = options[options.length - 1];
      last.text = `${last.text} ${line}`;
    } else {
      buffer.push(line);
    }
  }
  flushParagraph();

  return buildQuestion(id, paragraphs, options, answerMatch[1], explanation);
}
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npx vitest run scripts/lib/parse-md.test.ts`
Expected: 7 test PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/build-question.ts scripts/lib/parse-md.ts scripts/lib/parse-md.test.ts
git commit -m "feat(data): parse markdown question source"
```

---

### Task 3: Parser .docx (Q51–500) và CLI `npm run parse`

**Files:**
- Create: `scripts/lib/parse-docx.ts`, `scripts/lib/io.ts`, `scripts/parse.ts`
- Test: `scripts/lib/parse-docx.test.ts`
- Generates: `data/questions.json`

**Interfaces:**
- Consumes: `OPTION_RE`, `buildQuestion` (Task 2); `parseMarkdown` (Task 2)
- Produces: `readDocxParagraphs(buf: Uint8Array): { style: string; text: string }[]`; `parseDocx(buf: Uint8Array): Question[]`; `readJson<T>(path: string): T`; `readJsonIfExists<T>(path: string, fallback: T): T`; `writeJson(path: string, value: unknown): void`; `readJsonDir<T>(dir: string): T[]` (gộp các mảng trong mọi file `*.json` của thư mục, sắp theo tên file); `listJsonIds(dir: string): string[]` (tên file bỏ đuôi `.json`)

- [ ] **Step 1: Viết test thất bại**

`scripts/lib/parse-docx.test.ts`:
```ts
import { strToU8, zipSync } from 'fflate';
import { parseDocx, readDocxParagraphs } from './parse-docx';

function para(text: string, style?: string, bold = false): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p w:rsidR="1">${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function makeDocx(paragraphs: string[]): Uint8Array {
  const xml = `<?xml version="1.0"?><w:document><w:body>${paragraphs.join('')}</w:body></w:document>`;
  return zipSync({ 'word/document.xml': strToU8(xml) });
}

const DOC = makeDocx([
  para('AWS Certified Solutions Architect', 'Title'),
  para('Bảng đáp án nhanh', 'Heading1'),
  `<w:tbl><w:tr><w:tc>${para('51')}</w:tc><w:tc>${para('D')}</w:tc></w:tr></w:tbl>`,
  para('Chi tiết câu hỏi, đáp án và giải thích', 'Heading1'),
  para('Question 51', 'Heading2'),
  para('A company &amp; its &quot;team&quot; want to migrate.'),
  para('Which solution will meet these requirements?', undefined, true),
  para('A. Use Lambda.', undefined, true),
  para('B. Use Amplify.', undefined, true),
  para('C. Use EC2.', undefined, true),
  para('D. Use ECS.', undefined, true),
  para('Đáp án đúng: D', undefined, true),
  para('Giải thích: Container hóa giữ nguyên code.', undefined, true),
  para('Đoạn giải thích thứ hai.'),
  para('Question 52', 'Heading2'),
  para('Pick two. Which combination? (Choose two.)', undefined, true),
  para('A. One.'),
  para('B. Two.'),
  para('C. Three.'),
  para('D. Four.'),
  para('E. Five.'),
  para('Đáp án đúng: A, C'),
  para('Giải thích: Vì vậy.'),
]);

describe('readDocxParagraphs', () => {
  it('đọc style, ghép text và giải mã entity XML', () => {
    const paras = readDocxParagraphs(DOC);
    expect(paras[0]).toEqual({ style: 'Title', text: 'AWS Certified Solutions Architect' });
    expect(paras.some((p) => p.text === 'A company & its "team" want to migrate.')).toBe(true);
  });
});

describe('parseDocx', () => {
  const qs = parseDocx(DOC);

  it('bỏ qua bảng đáp án nhanh, chỉ lấy câu dưới Heading2', () => {
    expect(qs.map((q) => q.id)).toEqual([51, 52]);
  });

  it('tách stem, prompt, lựa chọn và đáp án', () => {
    expect(qs[0].stem).toBe('A company & its "team" want to migrate.');
    expect(qs[0].prompt).toBe('Which solution will meet these requirements?');
    expect(qs[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(qs[0].answer).toEqual(['D']);
  });

  it('gộp giải thích nhiều đoạn', () => {
    expect(qs[0].explanationOrig).toBe('Container hóa giữ nguyên code.\nĐoạn giải thích thứ hai.');
  });

  it('đọc câu nhiều đáp án', () => {
    expect(qs[1].answer).toEqual(['A', 'C']);
    expect(qs[1].choose).toBe(2);
    expect(qs[1].stem).toBe('');
  });

  it('báo lỗi khi câu thiếu "Đáp án đúng"', () => {
    const bad = makeDocx([para('Question 60', 'Heading2'), para('Text?'), para('A. x'), para('B. y')]);
    expect(() => parseDocx(bad)).toThrow('Câu 60');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run scripts/lib/parse-docx.test.ts`
Expected: FAIL, không resolve được `./parse-docx`.

- [ ] **Step 3: Viết `scripts/lib/parse-docx.ts`**

```ts
import { strFromU8, unzipSync } from 'fflate';
import type { Option, Question } from '../../src/data/types';
import { OPTION_RE, buildQuestion } from './build-question';

export interface DocxParagraph {
  style: string;
  text: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function readDocxParagraphs(buf: Uint8Array): DocxParagraph[] {
  const files = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  const entry = files['word/document.xml'];
  if (!entry) throw new Error('Không tìm thấy word/document.xml');
  const xml = strFromU8(entry);
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs.map((p) => ({
    style: p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '',
    text: decodeXml([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')),
  }));
}

interface Draft {
  id: number;
  paragraphs: string[];
  options: Option[];
  answer: string | null;
  explanation: string[];
}

export function parseDocx(buf: Uint8Array): Question[] {
  const out: Question[] = [];
  let cur: Draft | null = null;

  const flush = () => {
    if (!cur) return;
    if (cur.answer === null) throw new Error(`Câu ${cur.id}: không tìm thấy "Đáp án đúng"`);
    out.push(buildQuestion(cur.id, cur.paragraphs, cur.options, cur.answer, cur.explanation.join('\n')));
    cur = null;
  };

  for (const p of readDocxParagraphs(buf)) {
    const isHeading = p.style.startsWith('Heading');
    const heading = isHeading ? p.text.trim().match(/^Question (\d+)$/) : null;
    if (heading) {
      flush();
      cur = { id: Number(heading[1]), paragraphs: [], options: [], answer: null, explanation: [] };
      continue;
    }
    if (isHeading) {
      flush();
      continue;
    }
    if (!cur) continue;
    const text = p.text.trim();
    if (!text) continue;

    const answer = text.match(/^Đáp án đúng:\s*(.+)$/);
    if (answer) {
      cur.answer = answer[1];
      continue;
    }
    const explanation = text.match(/^Giải thích:\s*(.*)$/);
    if (explanation) {
      cur.explanation.push(explanation[1]);
      continue;
    }
    if (cur.answer !== null) {
      cur.explanation.push(text);
      continue;
    }
    const opt = text.match(OPTION_RE);
    if (opt) {
      cur.options.push({ key: opt[1], text: opt[2].trim() });
      continue;
    }
    if (cur.options.length > 0) {
      const last = cur.options[cur.options.length - 1];
      last.text = `${last.text} ${text}`;
      continue;
    }
    cur.paragraphs.push(text);
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run scripts/lib/parse-docx.test.ts`
Expected: 6 test PASS.

- [ ] **Step 5: Viết `scripts/lib/io.ts` và `scripts/parse.ts`**

`scripts/lib/io.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readJsonIfExists<T>(path: string, fallback: T): T {
  return existsSync(path) ? readJson<T>(path) : fallback;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function listJsonIds(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => f.slice(0, -'.json'.length));
}

export function readJsonDir<T>(dir: string): T[] {
  return listJsonIds(dir).flatMap((name) => readJson<T[]>(join(dir, `${name}.json`)));
}
```

`scripts/parse.ts`:
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '../src/data/types';
import { writeJson } from './lib/io';
import { parseDocx } from './lib/parse-docx';
import { parseMarkdown } from './lib/parse-md';

const SOURCE_DIR = 'Question-Doc';
const OUTPUT = 'data/questions.json';

const questions: Question[] = [];
for (const file of readdirSync(SOURCE_DIR).sort()) {
  const path = join(SOURCE_DIR, file);
  if (file.endsWith('.md')) questions.push(...parseMarkdown(readFileSync(path, 'utf8')));
  else if (file.endsWith('.docx')) questions.push(...parseDocx(new Uint8Array(readFileSync(path))));
}
questions.sort((a, b) => a.id - b.id);
writeJson(OUTPUT, questions);
console.log(`Đã parse ${questions.length} câu → ${OUTPUT}`);
```

- [ ] **Step 6: Chạy parse trên dữ liệu thật**

Run: `npm run parse`
Expected: `Đã parse 500 câu → data/questions.json`.

Kiểm tra nhanh:
```bash
node -e "const q=require('./data/questions.json');const ids=q.map(x=>x.id);console.log(q.length, ids[0], ids.at(-1), new Set(ids).size, q.filter(x=>x.choose>1).length, q.filter(x=>!x.prompt||!x.explanationOrig).map(x=>x.id))"
```
Expected: `500 1 500 500 <số câu nhiều đáp án> []`. Nếu mảng cuối không rỗng, mở câu đó trong file nguồn, sửa parser cho khớp định dạng, thêm test tái hiện vào file test tương ứng, rồi chạy lại.

- [ ] **Step 7: Commit**

```bash
git add scripts data/questions.json
git commit -m "feat(data): parse docx sources and generate questions.json"
```

---

### Task 4: Validate dữ liệu (`npm run validate`)

**Files:**
- Create: `scripts/lib/validate.ts`, `scripts/validate.ts`, `data/service-registry.json` (khởi tạo `[]`)
- Test: `scripts/lib/validate.test.ts`

**Interfaces:**
- Consumes: types, constants (Task 1); `readJson`, `readJsonIfExists`, `readJsonDir`, `listJsonIds` (Task 3)
- Produces:
  - `interface ValidationInput { questions: Question[]; metas: QuestionMeta[]; vis: QuestionVi[]; registry: ServiceRef[]; noteIds: string[]; sets: SetsFile | null }`
  - `interface ValidationRules { total: number; setCount: number; setSize: number; quota: Record<Domain, number> }`, `DEFAULT_RULES`
  - `interface ValidationReport { errors: string[]; warnings: string[] }`
  - `expectedChoose(q: Question): number`
  - `validate(input: ValidationInput, rules?: ValidationRules): ValidationReport`

- [ ] **Step 1: Viết test thất bại**

`scripts/lib/validate.test.ts`:
```ts
import type { Question, QuestionMeta, QuestionVi, SetsFile } from '../../src/data/types';
import { expectedChoose, validate, type ValidationInput, type ValidationRules } from './validate';

const RULES: ValidationRules = { total: 3, setCount: 1, setSize: 2, quota: { 1: 1, 2: 1, 3: 0, 4: 0 } };

function q(id: number, answer = ['A'], prompt = 'Which?'): Question {
  return {
    id,
    stem: 'Stem',
    prompt,
    options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: `Opt ${key}` })),
    answer,
    choose: answer.length,
    explanationOrig: 'x',
  };
}

function meta(id: number, domain: 1 | 2 | 3 | 4 = 1): QuestionMeta {
  return { id, domain, difficulty: 2, services: ['s3'] };
}

function base(): ValidationInput {
  return {
    questions: [q(1), q(2), q(3)],
    metas: [meta(1), meta(2, 2), meta(3)],
    vis: [],
    registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
    noteIds: [],
    sets: null,
  };
}

describe('expectedChoose', () => {
  it('đọc Choose two/three không phân biệt hoa thường', () => {
    expect(expectedChoose(q(1, ['A'], 'Which? (Choose two.)'))).toBe(2);
    expect(expectedChoose(q(1, ['A'], 'Which? (CHOOSE THREE.)'))).toBe(3);
    expect(expectedChoose(q(1))).toBe(1);
  });
});

describe('validate', () => {
  it('dữ liệu hợp lệ không có lỗi', () => {
    expect(validate(base(), RULES).errors).toEqual([]);
  });

  it('báo thiếu câu và sai tổng số', () => {
    const input = { ...base(), questions: [q(1), q(3)] };
    const { errors } = validate(input, RULES);
    expect(errors).toContain('Có 2 câu, cần 3');
    expect(errors).toContain('Thiếu câu 2');
  });

  it('báo đáp án không nằm trong các lựa chọn', () => {
    const input = { ...base(), questions: [q(1, ['Z']), q(2), q(3)] };
    expect(validate(input, RULES).errors).toContain('Câu 1: đáp án Z không có trong lựa chọn');
  });

  it('báo số đáp án không khớp Choose two', () => {
    const input = { ...base(), questions: [q(1, ['A'], 'Which? (Choose two.)'), q(2), q(3)] };
    expect(validate(input, RULES).errors).toContain('Câu 1: đề yêu cầu chọn 2 nhưng đáp án có 1');
  });

  it('báo meta trỏ tới câu không tồn tại, trùng id, sai domain, service ngoài registry', () => {
    const bad = { id: 9, domain: 5, difficulty: 2, services: [] } as unknown as QuestionMeta;
    const input = { ...base(), metas: [meta(1), meta(1), { ...meta(2), services: ['nope'] }, bad] };
    const { errors } = validate(input, RULES);
    expect(errors).toContain('meta: câu 9 không tồn tại');
    expect(errors).toContain('meta: câu 1 bị trùng');
    expect(errors).toContain('meta: câu 9 có domain không hợp lệ (5)');
    expect(errors).toContain('meta: câu 2 dùng service "nope" không có trong service-registry.json');
  });

  it('cảnh báo câu chưa có meta và service chưa có ghi chú', () => {
    const input = { ...base(), metas: [meta(1), meta(2, 2)] };
    const { warnings } = validate(input, RULES);
    expect(warnings).toContain('1 câu chưa có meta');
    expect(warnings).toContain('1 service chưa có ghi chú trong data/services/');
  });

  it('báo bản dịch lệch key và bản dịch dùng chữ cái chỉ lựa chọn', () => {
    const vi: QuestionVi = {
      id: 1,
      stemVi: 'Đề',
      promptVi: 'Hỏi',
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: key, reason: 'ok' })),
      explanationVi: 'Vì vậy đáp án B là đúng.',
      keyHint: 'x',
    };
    const { errors } = validate({ ...base(), vis: [vi] }, RULES);
    expect(errors).toContain('vi: câu 1 có key lựa chọn không khớp bản gốc');
    expect(errors).toContain('vi: câu 1 nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)');
  });

  it('kiểm tra sets: trùng câu, sai kích thước, không phủ hết ngân hàng', () => {
    const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: [1, 1] }], reserve: [] };
    const { errors } = validate({ ...base(), sets }, RULES);
    expect(errors).toContain('sets: câu 1 xuất hiện nhiều lần');
    expect(errors).toContain('sets: tổng số câu trong đề và kho dự phòng là 2, cần 3');
  });

  it('cảnh báo đề lệch quota domain', () => {
    const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: [1, 3] }], reserve: [2] };
    const { errors, warnings } = validate({ ...base(), sets }, RULES);
    expect(errors).toEqual([]);
    expect(warnings).toContain('sets: Đề 1 có domain 1 = 2 câu (quota 1)');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run scripts/lib/validate.test.ts`
Expected: FAIL, không resolve được `./validate`.

- [ ] **Step 3: Viết `scripts/lib/validate.ts`**

```ts
import { DOMAINS, DOMAIN_QUOTA, SERVICE_CATEGORIES, SET_COUNT, SET_SIZE, TOTAL_QUESTIONS } from '../../src/data/constants';
import type { Domain, Question, QuestionMeta, QuestionVi, ServiceRef, SetsFile } from '../../src/data/types';

export interface ValidationInput {
  questions: Question[];
  metas: QuestionMeta[];
  vis: QuestionVi[];
  registry: ServiceRef[];
  noteIds: string[];
  sets: SetsFile | null;
}

export interface ValidationRules {
  total: number;
  setCount: number;
  setSize: number;
  quota: Record<Domain, number>;
}

export const DEFAULT_RULES: ValidationRules = {
  total: TOTAL_QUESTIONS,
  setCount: SET_COUNT,
  setSize: SET_SIZE,
  quota: DOMAIN_QUOTA,
};

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const LETTER_REF = /(đáp án|phương án|lựa chọn|option)\s+[A-F]\b/iu;

export function expectedChoose(q: Question): number {
  const text = `${q.stem}\n${q.prompt}`;
  if (/choose three/i.test(text)) return 3;
  if (/choose two/i.test(text)) return 2;
  return 1;
}

export function validate(input: ValidationInput, rules: ValidationRules = DEFAULT_RULES): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(input.questions.map((q) => [q.id, q]));

  // Câu hỏi
  if (input.questions.length !== rules.total) errors.push(`Có ${input.questions.length} câu, cần ${rules.total}`);
  for (let id = 1; id <= rules.total; id++) if (!byId.has(id)) errors.push(`Thiếu câu ${id}`);
  for (const q of input.questions) {
    const keys = new Set(q.options.map((o) => o.key));
    for (const a of q.answer) if (!keys.has(a)) errors.push(`Câu ${q.id}: đáp án ${a} không có trong lựa chọn`);
    const expected = expectedChoose(q);
    if (expected !== q.answer.length)
      errors.push(`Câu ${q.id}: đề yêu cầu chọn ${expected} nhưng đáp án có ${q.answer.length}`);
  }

  // Registry
  const registryIds = new Set<string>();
  for (const s of input.registry) {
    if (registryIds.has(s.id)) errors.push(`registry: service "${s.id}" bị trùng`);
    registryIds.add(s.id);
    if (!(SERVICE_CATEGORIES as readonly string[]).includes(s.category))
      errors.push(`registry: service "${s.id}" có category không hợp lệ (${s.category})`);
  }

  // Meta
  const metaById = new Map<number, QuestionMeta>();
  for (const m of input.metas) {
    if (!byId.has(m.id)) errors.push(`meta: câu ${m.id} không tồn tại`);
    if (metaById.has(m.id)) errors.push(`meta: câu ${m.id} bị trùng`);
    metaById.set(m.id, m);
    if (!DOMAINS.includes(m.domain)) errors.push(`meta: câu ${m.id} có domain không hợp lệ (${m.domain})`);
    if (![1, 2, 3].includes(m.difficulty)) errors.push(`meta: câu ${m.id} có độ khó không hợp lệ (${m.difficulty})`);
    if (m.services.length === 0) warnings.push(`meta: câu ${m.id} chưa gắn service nào`);
    for (const s of m.services)
      if (!registryIds.has(s)) errors.push(`meta: câu ${m.id} dùng service "${s}" không có trong service-registry.json`);
  }
  const missingMeta = input.questions.filter((q) => !metaById.has(q.id)).length;
  if (missingMeta > 0) warnings.push(`${missingMeta} câu chưa có meta`);

  // Ghi chú service (giai đoạn 3)
  const noteIds = new Set(input.noteIds);
  const missingNotes = [...registryIds].filter((id) => !noteIds.has(id)).length;
  if (missingNotes > 0) warnings.push(`${missingNotes} service chưa có ghi chú trong data/services/`);

  // Bản dịch
  const viIds = new Set<number>();
  for (const v of input.vis) {
    viIds.add(v.id);
    const q = byId.get(v.id);
    if (!q) {
      errors.push(`vi: câu ${v.id} không tồn tại`);
      continue;
    }
    const origKeys = q.options.map((o) => o.key).sort().join(',');
    const viKeys = v.options.map((o) => o.key).sort().join(',');
    if (origKeys !== viKeys) errors.push(`vi: câu ${v.id} có key lựa chọn không khớp bản gốc`);
    const texts = [v.explanationVi, v.keyHint, ...v.options.map((o) => o.reason)];
    if (texts.some((t) => LETTER_REF.test(t)))
      errors.push(`vi: câu ${v.id} nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)`);
  }
  const missingVi = input.questions.filter((q) => !viIds.has(q.id)).length;
  if (missingVi > 0) warnings.push(`${missingVi} câu chưa có bản dịch tiếng Việt`);

  // Đề
  if (!input.sets) {
    warnings.push('Chưa có data/sets.json');
  } else {
    const seen = new Set<number>();
    const all = [...input.sets.sets.flatMap((s) => s.questionIds), ...input.sets.reserve];
    for (const id of all) {
      if (seen.has(id)) errors.push(`sets: câu ${id} xuất hiện nhiều lần`);
      seen.add(id);
      if (!byId.has(id)) errors.push(`sets: câu ${id} không tồn tại`);
    }
    if (all.length !== rules.total)
      errors.push(`sets: tổng số câu trong đề và kho dự phòng là ${all.length}, cần ${rules.total}`);
    if (input.sets.sets.length !== rules.setCount)
      errors.push(`sets: có ${input.sets.sets.length} đề, cần ${rules.setCount}`);
    for (const set of input.sets.sets) {
      if (set.questionIds.length !== rules.setSize)
        errors.push(`sets: Đề ${set.id} có ${set.questionIds.length} câu, cần ${rules.setSize}`);
      for (const d of DOMAINS) {
        const count = set.questionIds.filter((id) => metaById.get(id)?.domain === d).length;
        if (count !== rules.quota[d]) warnings.push(`sets: Đề ${set.id} có domain ${d} = ${count} câu (quota ${rules.quota[d]})`);
      }
    }
  }

  return { errors, warnings };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run scripts/lib/validate.test.ts`
Expected: 9 test PASS.

- [ ] **Step 5: Viết CLI `scripts/validate.ts` và khởi tạo registry rỗng**

`data/service-registry.json`:
```json
[]
```

`scripts/validate.ts`:
```ts
import type { Question, QuestionMeta, QuestionVi, ServiceRef, SetsFile } from '../src/data/types';
import { listJsonIds, readJson, readJsonDir, readJsonIfExists } from './lib/io';
import { validate } from './lib/validate';

const report = validate({
  questions: readJson<Question[]>('data/questions.json'),
  metas: readJsonDir<QuestionMeta>('data/meta'),
  vis: readJsonDir<QuestionVi>('data/vi'),
  registry: readJsonIfExists<ServiceRef[]>('data/service-registry.json', []),
  noteIds: listJsonIds('data/services'),
  sets: readJsonIfExists<SetsFile | null>('data/sets.json', null),
});

for (const w of report.warnings) console.warn(`CẢNH BÁO: ${w}`);
for (const e of report.errors) console.error(`LỖI: ${e}`);
console.log(`Kết quả: ${report.errors.length} lỗi, ${report.warnings.length} cảnh báo`);
process.exit(report.errors.length > 0 ? 1 : 0);
```

- [ ] **Step 6: Chạy validate trên dữ liệu thật**

Run: `npm run validate`
Expected: `0 lỗi`, các cảnh báo gồm `500 câu chưa có meta`, `500 câu chưa có bản dịch tiếng Việt`, `Chưa có data/sets.json`. Nếu có lỗi `đề yêu cầu chọn N nhưng đáp án có M`, **không sửa đáp án**: mở file nguồn kiểm tra xem parser có đọc sai không. Nếu nguồn thật sự không khớp, dừng lại và hỏi người dùng.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/validate.ts scripts/lib/validate.test.ts scripts/validate.ts data/service-registry.json
git commit -m "feat(data): add data validation script"
```

---

### Task 5: Phân loại meta cho 500 câu và danh sách service (nội dung soạn tay)

**Files:**
- Create: `data/meta/q001-025.json`, `data/meta/q026-050.json`, …, `data/meta/q476-500.json` (20 file)
- Modify: `data/service-registry.json`

**Interfaces:**
- Consumes: `data/questions.json` (Task 3); `npm run validate` (Task 4)
- Produces: `QuestionMeta[]` cho đủ 500 câu; `ServiceRef[]` trong registry. Task 6 cần đủ meta.

Đây là việc soạn nội dung, không phải code. Mỗi lô 25 câu làm như sau:

- [ ] **Step 1: Đọc lô câu hỏi**

Run (thay `START` và `END`, ví dụ 1 và 25):
```bash
node -e "const q=require('./data/questions.json').filter(x=>x.id>=START&&x.id<=END);for(const x of q){console.log('\n#'+x.id, x.stem, '\n>>', x.prompt);x.options.forEach(o=>console.log(' ',o.key+'.',o.text));console.log('  ANSWER', x.answer.join(','))}"
```

- [ ] **Step 2: Phân loại từng câu theo bộ tiêu chí sau và ghi file `data/meta/qSSS-EEE.json`**

Mỗi phần tử có dạng `{ "id": 1, "domain": 3, "difficulty": 2, "services": ["api-gateway", "kinesis-data-analytics"] }`. File là một mảng, sắp theo `id`.

**Domain.** Chọn theo mục tiêu chính mà câu hỏi tối ưu. Nếu có từ khóa tối ưu thì ưu tiên từ khóa đó.
- `1` Secure: IAM và least privilege, cấp quyền giữa các tài khoản, mã hóa (KMS, TLS), Secrets Manager và Parameter Store, bảo mật mạng (security group, NACL, WAF, Shield, VPC endpoint, PrivateLink), tuân thủ và kiểm toán, bảo vệ dữ liệu.
- `2` Resilient: high availability, Multi-AZ/Multi-Region, disaster recovery (RTO/RPO), backup/restore, decoupling (SQS, SNS, EventBridge), fault tolerance, không mất dữ liệu khi scale.
- `3` High-Performing: độ trễ, throughput, caching (ElastiCache, CloudFront, DAX), chọn storage/database theo hiệu năng, ingest và streaming dữ liệu, compute có khả năng scale.
- `4` Cost-Optimized: câu hỏi có "MOST cost-effective", "LEAST cost", "reduce costs", hoặc về storage class, mô hình giá (Savings Plans, Spot, Reserved), rightsizing.
- Nếu câu chỉ có "LEAST operational overhead" thì cụm này **không** quyết định domain; chọn domain theo chủ đề chính của câu.

**Độ khó.**
- `1`: nhận diện một service hoặc khái niệm, đáp án gần như hiển nhiên khi biết service đó.
- `2`: phải so sánh 2–3 phương án đều hợp lý, hoặc đề có 2 ràng buộc.
- `3`: có từ 3 ràng buộc trở lên, hoặc là câu multiple response, hoặc các lựa chọn gây nhiễu rất sát nhau.

**Services.** Gắn mọi AWS service được nhắc trong đề **và** trong các lựa chọn, vì hướng dẫn sẽ giải thích cả service ở lựa chọn sai. Dùng id kebab-case ổn định:
- Ví dụ id: `s3`, `s3-glacier`, `ec2`, `ec2-auto-scaling`, `elb`, `vpc`, `iam`, `kms`, `rds`, `aurora`, `dynamodb`, `sqs`, `sns`, `lambda`, `api-gateway`, `cloudfront`, `route-53`, `kinesis-data-streams`, `kinesis-data-firehose`, `kinesis-data-analytics`, `athena`, `quicksight`, `redshift`, `glue`, `lake-formation`, `opensearch`.
- ALB, NLB và GWLB đều gộp vào `elb`. Các storage class của S3 thuộc `s3`, riêng Glacier dùng `s3-glacier`.

- [ ] **Step 3: Thêm service mới vào `data/service-registry.json`**

Mỗi id mới lần đầu xuất hiện được thêm một phần tử `{ "id": "kinesis-data-analytics", "name": "Amazon Kinesis Data Analytics", "category": "Analytics" }`.
- `name` là tên chính thức đầy đủ.
- `category` phải là một trong `SERVICE_CATEGORIES` (Task 1). Service không có trong danh sách In-Scope thì chọn danh mục gần nhất theo chức năng chính.
- Giữ mảng sắp theo `id`.

- [ ] **Step 4: Validate lô vừa soạn**

Run: `npm run validate`
Expected: `0 lỗi`, cảnh báo `N câu chưa có meta` giảm đúng 25.

- [ ] **Step 5: Lặp lại Step 1–4 cho đủ 20 lô; commit sau mỗi 4 lô (100 câu)**

```bash
git add data/meta data/service-registry.json
git commit -m "data(meta): classify questions 1-100"
```
(Các lần commit sau đổi phần số: `101-200`, `201-300`, `301-400`, `401-500`.)

- [ ] **Step 6: Kiểm tra phân bổ domain sau khi xong đủ 500 câu**

Run:
```bash
node -e "const fs=require('fs');const m=fs.readdirSync('data/meta').flatMap(f=>require('./data/meta/'+f));const c={};const k={};for(const x of m){c[x.domain]=(c[x.domain]||0)+1;k[x.domain+'-'+x.difficulty]=(k[x.domain+'-'+x.difficulty]||0)+1}console.log(m.length,c,k)"
```
Expected: `500`. Mỗi domain d phải có ít nhất `7 × quota` câu (1 ≥ 140, 2 ≥ 119, 3 ≥ 105, 4 ≥ 91). Nếu domain nào thiếu, xem lại các câu ở ranh giới giữa hai domain (ví dụ "cost-effective + HA") xem có câu nào phân loại chưa hợp lý không. **Không ép nhãn sai** để đủ quota. Build-sets (Task 6) sẽ bù và cảnh báo; báo lại số liệu này cho người dùng.

---

### Task 6: Xếp đề (`npm run sets`)

**Files:**
- Create: `src/engine/rng.ts`, `scripts/lib/build-sets.ts`, `scripts/build-sets.ts`
- Test: `src/engine/rng.test.ts`, `scripts/lib/build-sets.test.ts`
- Generates: `data/sets.json`

**Interfaces:**
- Consumes: types, constants (Task 1); `readJson`, `readJsonDir`, `writeJson` (Task 3); meta đầy đủ (Task 5)
- Produces:
  - `type Rng = () => number`; `mulberry32(seed: number): Rng`; `shuffle<T>(items: readonly T[], rng: Rng): T[]`; `randomSeed(): number` (rng.ts, dùng chung cho engine ở Task 7)
  - `interface BuildSetsOptions { seed: number; setCount: number; quota: Record<Domain, number> }`, `DEFAULT_BUILD` (seed `20260924`)
  - `allocate(groupSizes: number[], need: number): number[]`
  - `buildSets(metas: QuestionMeta[], opts?: BuildSetsOptions): { file: SetsFile; warnings: string[] }`

- [ ] **Step 1: Viết test thất bại cho rng**

`src/engine/rng.test.ts`:
```ts
import { mulberry32, shuffle } from './rng';

describe('mulberry32', () => {
  it('cùng seed cho cùng dãy số, nằm trong [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('shuffle', () => {
  it('là hoán vị, không sửa mảng gốc, tất định theo seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffle(input, mulberry32(1))).toEqual(out);
    expect(shuffle(input, mulberry32(2))).not.toEqual(out);
  });
});
```

- [ ] **Step 2: Viết test thất bại cho build-sets**

`scripts/lib/build-sets.test.ts`:
```ts
import type { Difficulty, Domain, QuestionMeta } from '../../src/data/types';
import { DOMAIN_QUOTA } from '../../src/data/constants';
import { allocate, buildSets } from './build-sets';

function makeMetas(counts: Record<Domain, number>): QuestionMeta[] {
  const out: QuestionMeta[] = [];
  let id = 1;
  for (const d of [1, 2, 3, 4] as Domain[]) {
    for (let i = 0; i < counts[d]; i++) {
      out.push({ id, domain: d, difficulty: ((id % 3) + 1) as Difficulty, services: [] });
      id++;
    }
  }
  return out;
}

describe('allocate', () => {
  it('chia theo tỷ lệ bằng phương pháp phần dư lớn nhất', () => {
    expect(allocate([50, 50, 50], 140)).toEqual([47, 47, 46]);
    expect(allocate([10, 0, 5], 30)).toEqual([10, 0, 5]);
  });
});

describe('buildSets', () => {
  const metas = makeMetas({ 1: 150, 2: 130, 3: 120, 4: 100 });
  const byId = new Map(metas.map((m) => [m.id, m]));
  const { file, warnings } = buildSets(metas);

  it('tạo 7 đề, mỗi đề 65 câu đúng quota domain, không cảnh báo', () => {
    expect(warnings).toEqual([]);
    expect(file.sets).toHaveLength(7);
    for (const set of file.sets) {
      expect(set.questionIds).toHaveLength(65);
      for (const d of [1, 2, 3, 4] as Domain[]) {
        expect(set.questionIds.filter((id) => byId.get(id)!.domain === d)).toHaveLength(DOMAIN_QUOTA[d]);
      }
    }
  });

  it('mọi câu xuất hiện đúng một lần; kho dự phòng có 45 câu', () => {
    const all = [...file.sets.flatMap((s) => s.questionIds), ...file.reserve];
    expect(all).toHaveLength(500);
    expect(new Set(all).size).toBe(500);
    expect(file.reserve).toHaveLength(45);
  });

  it('độ khó trong mỗi domain được trải đều giữa các đề (lệch tối đa 1)', () => {
    for (const d of [1, 2, 3, 4] as Domain[]) {
      for (const diff of [1, 2, 3]) {
        const counts = file.sets.map(
          (s) => s.questionIds.filter((id) => byId.get(id)!.domain === d && byId.get(id)!.difficulty === diff).length,
        );
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('tất định: chạy lại cho cùng kết quả', () => {
    expect(buildSets(metas).file).toEqual(file);
  });

  it('domain thiếu câu: vẫn đủ 65 câu mỗi đề và có cảnh báo', () => {
    const short = makeMetas({ 1: 100, 2: 170, 3: 130, 4: 100 });
    const res = buildSets(short);
    expect(res.warnings.some((w) => w.startsWith('Domain 1 chỉ có 100/140'))).toBe(true);
    for (const set of res.file.sets) expect(set.questionIds).toHaveLength(65);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/engine/rng.test.ts scripts/lib/build-sets.test.ts`
Expected: FAIL, không resolve được `./rng` và `./build-sets`.

- [ ] **Step 4: Viết `src/engine/rng.ts`**

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
```

- [ ] **Step 5: Viết `scripts/lib/build-sets.ts`**

```ts
import { DOMAINS, DOMAIN_QUOTA, SET_COUNT } from '../../src/data/constants';
import type { Difficulty, Domain, QuestionMeta, SetsFile } from '../../src/data/types';
import { mulberry32, shuffle } from '../../src/engine/rng';

export interface BuildSetsOptions {
  seed: number;
  setCount: number;
  quota: Record<Domain, number>;
}

export const DEFAULT_BUILD: BuildSetsOptions = { seed: 20260924, setCount: SET_COUNT, quota: DOMAIN_QUOTA };

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

export function allocate(groupSizes: number[], need: number): number[] {
  const total = groupSizes.reduce((a, b) => a + b, 0);
  if (total <= need) return groupSizes.slice();
  const exact = groupSizes.map((n) => (n * need) / total);
  const base = exact.map(Math.floor);
  let left = need - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - base[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left === 0) break;
    if (base[i] < groupSizes[i]) {
      base[i]++;
      left--;
    }
  }
  return base;
}

export function buildSets(
  metas: QuestionMeta[],
  opts: BuildSetsOptions = DEFAULT_BUILD,
): { file: SetsFile; warnings: string[] } {
  const rng = mulberry32(opts.seed);
  const warnings: string[] = [];
  const sets: number[][] = Array.from({ length: opts.setCount }, () => []);
  const reserveByDomain = new Map<Domain, QuestionMeta[]>();
  const sorted = [...metas].sort((a, b) => a.id - b.id);

  for (const d of DOMAINS) {
    const need = opts.quota[d] * opts.setCount;
    const groups = DIFFICULTIES.map((diff) =>
      shuffle(
        sorted.filter((m) => m.domain === d && m.difficulty === diff),
        rng,
      ),
    );
    const take = allocate(
      groups.map((g) => g.length),
      need,
    );
    const picked = groups.flatMap((g, i) => g.slice(0, take[i]));
    reserveByDomain.set(
      d,
      groups.flatMap((g, i) => g.slice(take[i])),
    );
    picked.forEach((m, i) => sets[i % opts.setCount].push(m.id));
    if (picked.length < need) warnings.push(`Domain ${d} chỉ có ${picked.length}/${need} câu cho ${opts.setCount} đề`);
  }

  const setSize = DOMAINS.reduce((s, d) => s + opts.quota[d], 0);
  sets.forEach((ids, i) => {
    while (ids.length < setSize) {
      const donor = [...reserveByDomain.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])[0];
      if (!donor || donor[1].length === 0) {
        warnings.push(`Đề ${i + 1}: không đủ câu, chỉ có ${ids.length}/${setSize}`);
        break;
      }
      const m = donor[1].shift()!;
      ids.push(m.id);
      warnings.push(`Đề ${i + 1}: bù câu ${m.id} (domain ${donor[0]}) vì thiếu câu`);
    }
  });

  const reserve = [...reserveByDomain.values()]
    .flat()
    .map((m) => m.id)
    .sort((a, b) => a - b);

  return {
    file: {
      version: 1,
      sets: sets.map((ids, i) => ({ id: i + 1, questionIds: [...ids].sort((a, b) => a - b) })),
      reserve,
    },
    warnings,
  };
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run src/engine/rng.test.ts scripts/lib/build-sets.test.ts`
Expected: 8 test PASS.

- [ ] **Step 7: Viết CLI `scripts/build-sets.ts`**

```ts
import { DOMAINS } from '../src/data/constants';
import type { Question, QuestionMeta } from '../src/data/types';
import { buildSets } from './lib/build-sets';
import { readJson, readJsonDir, writeJson } from './lib/io';

const questions = readJson<Question[]>('data/questions.json');
const metas = readJsonDir<QuestionMeta>('data/meta');
const metaIds = new Set(metas.map((m) => m.id));
const missing = questions.filter((q) => !metaIds.has(q.id)).map((q) => q.id);
if (missing.length > 0) {
  console.error(`LỖI: ${missing.length} câu chưa có meta (ví dụ: ${missing.slice(0, 10).join(', ')}). Hoàn thành data/meta trước.`);
  process.exit(1);
}

const { file, warnings } = buildSets(metas);
writeJson('data/sets.json', file);
const byId = new Map(metas.map((m) => [m.id, m]));
for (const set of file.sets) {
  const counts = DOMAINS.map((d) => set.questionIds.filter((id) => byId.get(id)!.domain === d).length);
  console.log(`Đề ${set.id}: ${set.questionIds.length} câu, domain 1/2/3/4 = ${counts.join('/')}`);
}
console.log(`Kho dự phòng: ${file.reserve.length} câu`);
for (const w of warnings) console.warn(`CẢNH BÁO: ${w}`);
```

- [ ] **Step 8: Chạy trên dữ liệu thật rồi validate**

Run: `npm run sets && npm run validate`
Expected: 7 dòng `Đề N: 65 câu, domain 1/2/3/4 = 20/17/15/13`, `Kho dự phòng: 45 câu`; validate `0 lỗi`. Nếu có cảnh báo bù domain, ghi lại để báo người dùng ở Task 14.

- [ ] **Step 9: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts scripts/lib/build-sets.ts scripts/lib/build-sets.test.ts scripts/build-sets.ts data/sets.json
git commit -m "feat(data): deterministic exam set builder and sets.json"
```

---

### Task 7: Engine tạo lượt thi và thao tác làm bài

**Files:**
- Create: `src/engine/attempt.ts`, `src/engine/actions.ts`
- Test: `src/engine/attempt.test.ts`, `src/engine/actions.test.ts`

**Interfaces:**
- Consumes: `mulberry32`, `shuffle`, `Rng` (Task 6); types (Task 1)
- Produces (attempt.ts):
  - `type Mode = 'real' | 'practice'`; `SWAP_COUNT = 10`; `EXAM_MINUTES = 130`; `ESL_EXTRA_MINUTES = 30`
  - `interface AttemptQuestion { qid: number; domain: Domain; optionOrder: string[] }`
  - `interface Attempt { id: string; setId: number; mode: Mode; seed: number; esl: boolean; startedAt: number; endsAt?: number; questions: AttemptQuestion[]; answers: Record<number, string[]>; flagged: number[]; guideOpened: number[]; submittedAt?: number; status: 'in-progress' | 'submitted' | 'incompatible' }`
  - `interface CreateAttemptInput { id: string; setId: number; mode: Mode; esl: boolean; seed: number; now: number; sets: SetsFile; questions: Map<number, Question>; metas: Map<number, QuestionMeta> }`
  - `examDurationMs(esl: boolean): number`
  - `pickQuestionIds(setIds: number[], reserve: number[], metas: Map<number, QuestionMeta>, rng: Rng): number[]`
  - `createAttempt(input: CreateAttemptInput): Attempt`
  - `displayLabel(index: number): string` (0 → "A")
  - `isCompatible(attempt: Attempt, questions: Map<number, Question>): boolean`
- Produces (actions.ts): `selectOption(a, qid, key, choose): Attempt`; `toggleFlag(a, qid): Attempt`; `markGuideOpened(a, qid): Attempt`; `submitAttempt(a, now): Attempt`

- [ ] **Step 1: Viết test thất bại cho attempt**

`src/engine/attempt.test.ts`:
```ts
import type { Question, QuestionMeta, SetsFile } from '../data/types';
import { DOMAIN_QUOTA } from '../data/constants';
import { mulberry32 } from './rng';
import { createAttempt, displayLabel, examDurationMs, isCompatible, pickQuestionIds, type CreateAttemptInput } from './attempt';

function q(id: number): Question {
  return {
    id,
    stem: '',
    prompt: `Q${id}?`,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key })),
    answer: ['A'],
    choose: 1,
    explanationOrig: '',
  };
}

// 65 câu trong đề (20/17/15/13) + 10 câu dự phòng (3/3/2/2)
function domainOf(id: number): 1 | 2 | 3 | 4 {
  if (id <= 65) return id <= 20 ? 1 : id <= 37 ? 2 : id <= 52 ? 3 : 4;
  return ([1, 1, 1, 2, 2, 2, 3, 3, 4, 4] as const)[id - 66];
}

function input(overrides: Partial<CreateAttemptInput> = {}): CreateAttemptInput {
  const ids = Array.from({ length: 75 }, (_, i) => i + 1);
  const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: ids.slice(0, 65) }], reserve: ids.slice(65) };
  return {
    id: 'a1',
    setId: 1,
    mode: 'real',
    esl: true,
    seed: 42,
    now: 1000,
    sets,
    questions: new Map(ids.map((id) => [id, q(id)])),
    metas: new Map(ids.map((id) => [id, { id, domain: domainOf(id), difficulty: 2, services: [] } as QuestionMeta])),
    ...overrides,
  };
}

describe('examDurationMs', () => {
  it('130 phút, 160 phút khi bật ESL', () => {
    expect(examDurationMs(false)).toBe(130 * 60_000);
    expect(examDurationMs(true)).toBe(160 * 60_000);
  });
});

describe('pickQuestionIds', () => {
  const metas = new Map<number, QuestionMeta>([
    [1, { id: 1, domain: 1, difficulty: 1, services: [] }],
    [2, { id: 2, domain: 2, difficulty: 1, services: [] }],
    [3, { id: 3, domain: 1, difficulty: 3, services: [] }],
    [4, { id: 4, domain: 1, difficulty: 1, services: [] }],
  ]);

  it('ưu tiên câu cùng domain và cùng độ khó', () => {
    const out = pickQuestionIds([1, 2], [3, 4], metas, mulberry32(1));
    expect(out).toContain(4);
    expect(out).not.toContain(1);
  });

  it('không có cùng độ khó thì lấy cùng domain; không có cùng domain thì giữ nguyên', () => {
    const out = pickQuestionIds([1, 2], [3], metas, mulberry32(1));
    expect([...out].sort()).toEqual([2, 3]);
  });

  it('báo lỗi khi thiếu meta', () => {
    expect(() => pickQuestionIds([99], [], metas, mulberry32(1))).toThrow('Thiếu meta cho câu 99');
  });
});

describe('createAttempt', () => {
  const attempt = createAttempt(input());

  it('giữ đúng quota domain sau khi hoán đổi, không trùng câu', () => {
    const qids = attempt.questions.map((x) => x.qid);
    expect(new Set(qids).size).toBe(65);
    for (const d of [1, 2, 3, 4] as const) {
      expect(attempt.questions.filter((x) => x.domain === d)).toHaveLength(DOMAIN_QUOTA[d]);
    }
  });

  it('có hoán đổi từ 1 đến 10 câu với kho dự phòng', () => {
    const swapped = attempt.questions.filter((x) => x.qid > 65).length;
    expect(swapped).toBeGreaterThanOrEqual(1);
    expect(swapped).toBeLessThanOrEqual(10);
  });

  it('optionOrder là hoán vị các key của câu', () => {
    for (const aq of attempt.questions) expect([...aq.optionOrder].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('tất định theo seed, seed khác cho thứ tự khác', () => {
    expect(createAttempt(input())).toEqual(attempt);
    expect(createAttempt(input({ seed: 43 })).questions.map((x) => x.qid)).not.toEqual(attempt.questions.map((x) => x.qid));
  });

  it('Thi thật có endsAt; Thi thử không có endsAt và esl = false', () => {
    expect(attempt.endsAt).toBe(1000 + 160 * 60_000);
    const practice = createAttempt(input({ mode: 'practice' }));
    expect(practice.endsAt).toBeUndefined();
    expect(practice.esl).toBe(false);
    expect(practice.status).toBe('in-progress');
  });

  it('báo lỗi khi đề không tồn tại', () => {
    expect(() => createAttempt(input({ setId: 9 }))).toThrow('Không có đề 9');
  });
});

describe('displayLabel', () => {
  it('đánh nhãn theo vị trí', () => {
    expect([0, 1, 4].map(displayLabel)).toEqual(['A', 'B', 'E']);
  });
});

describe('isCompatible', () => {
  const attempt = createAttempt(input());
  const questions = input().questions;

  it('đúng khi mọi câu và key còn khớp', () => {
    expect(isCompatible(attempt, questions)).toBe(true);
  });

  it('sai khi câu không còn tồn tại hoặc key lựa chọn đã đổi', () => {
    const missing = new Map(questions);
    missing.delete(attempt.questions[0].qid);
    expect(isCompatible(attempt, missing)).toBe(false);
    const changed = new Map(questions);
    changed.set(attempt.questions[0].qid, { ...q(attempt.questions[0].qid), options: [{ key: 'A', text: 'x' }] });
    expect(isCompatible(attempt, changed)).toBe(false);
  });
});
```

- [ ] **Step 2: Viết test thất bại cho actions**

`src/engine/actions.test.ts`:
```ts
import type { Attempt } from './attempt';
import { markGuideOpened, selectOption, submitAttempt, toggleFlag } from './actions';

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a',
    setId: 1,
    mode: 'real',
    seed: 1,
    esl: false,
    startedAt: 0,
    endsAt: 100,
    questions: [{ qid: 7, domain: 1, optionOrder: ['A', 'B', 'C', 'D', 'E'] }],
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
    ...overrides,
  };
}

describe('selectOption', () => {
  it('câu một đáp án: chọn mới thay cho đáp án cũ', () => {
    const a1 = selectOption(attempt(), 7, 'B', 1);
    expect(a1.answers[7]).toEqual(['B']);
    expect(selectOption(a1, 7, 'C', 1).answers[7]).toEqual(['C']);
  });

  it('câu nhiều đáp án: bật/tắt, không cho chọn quá số lượng', () => {
    let a = selectOption(attempt(), 7, 'A', 2);
    a = selectOption(a, 7, 'C', 2);
    expect(a.answers[7]).toEqual(['A', 'C']);
    expect(selectOption(a, 7, 'E', 2).answers[7]).toEqual(['A', 'C']);
    expect(selectOption(a, 7, 'A', 2).answers[7]).toEqual(['C']);
  });

  it('không đổi được đáp án sau khi đã nộp', () => {
    const done = attempt({ status: 'submitted' });
    expect(selectOption(done, 7, 'A', 1)).toBe(done);
  });
});

describe('toggleFlag / markGuideOpened / submitAttempt', () => {
  it('bật rồi tắt cờ xem lại', () => {
    const a = toggleFlag(attempt(), 7);
    expect(a.flagged).toEqual([7]);
    expect(toggleFlag(a, 7).flagged).toEqual([]);
  });

  it('ghi nhận đã mở hướng dẫn một lần', () => {
    const a = markGuideOpened(markGuideOpened(attempt({ mode: 'practice' }), 7), 7);
    expect(a.guideOpened).toEqual([7]);
  });

  it('nộp bài ghi thời điểm; nộp lần nữa không đổi', () => {
    const a = submitAttempt(attempt(), 50);
    expect(a.status).toBe('submitted');
    expect(a.submittedAt).toBe(50);
    expect(submitAttempt(a, 99)).toBe(a);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/engine/attempt.test.ts src/engine/actions.test.ts`
Expected: FAIL, không resolve được `./attempt` và `./actions`.

- [ ] **Step 4: Viết `src/engine/attempt.ts`**

```ts
import type { Domain, Question, QuestionMeta, SetsFile } from '../data/types';
import { mulberry32, shuffle, type Rng } from './rng';

export type Mode = 'real' | 'practice';

export const SWAP_COUNT = 10;
export const EXAM_MINUTES = 130;
export const ESL_EXTRA_MINUTES = 30;

export interface AttemptQuestion {
  qid: number;
  domain: Domain;
  optionOrder: string[];
}

export interface Attempt {
  id: string;
  setId: number;
  mode: Mode;
  seed: number;
  esl: boolean;
  startedAt: number;
  endsAt?: number;
  questions: AttemptQuestion[];
  answers: Record<number, string[]>;
  flagged: number[];
  guideOpened: number[];
  submittedAt?: number;
  status: 'in-progress' | 'submitted' | 'incompatible';
}

export interface CreateAttemptInput {
  id: string;
  setId: number;
  mode: Mode;
  esl: boolean;
  seed: number;
  now: number;
  sets: SetsFile;
  questions: Map<number, Question>;
  metas: Map<number, QuestionMeta>;
}

export function examDurationMs(esl: boolean): number {
  return (EXAM_MINUTES + (esl ? ESL_EXTRA_MINUTES : 0)) * 60_000;
}

function metaOf(metas: Map<number, QuestionMeta>, id: number): QuestionMeta {
  const m = metas.get(id);
  if (!m) throw new Error(`Thiếu meta cho câu ${id}`);
  return m;
}

export function pickQuestionIds(
  setIds: number[],
  reserve: number[],
  metas: Map<number, QuestionMeta>,
  rng: Rng,
): number[] {
  const result = setIds.slice();
  const pool = reserve.slice();
  const positions = shuffle(
    result.map((_, i) => i),
    rng,
  ).slice(0, SWAP_COUNT);
  for (const pos of positions) {
    const current = metaOf(metas, result[pos]);
    const sameBoth = pool.filter((id) => {
      const m = metaOf(metas, id);
      return m.domain === current.domain && m.difficulty === current.difficulty;
    });
    const candidates = sameBoth.length > 0 ? sameBoth : pool.filter((id) => metaOf(metas, id).domain === current.domain);
    if (candidates.length === 0) continue;
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    result[pos] = chosen;
    pool.splice(pool.indexOf(chosen), 1);
  }
  return result;
}

export function createAttempt(input: CreateAttemptInput): Attempt {
  const rng = mulberry32(input.seed);
  const set = input.sets.sets.find((s) => s.id === input.setId);
  if (!set) throw new Error(`Không có đề ${input.setId}`);
  const ids = shuffle(pickQuestionIds(set.questionIds, input.sets.reserve, input.metas, rng), rng);
  const questions = ids.map((qid) => {
    const q = input.questions.get(qid);
    if (!q) throw new Error(`Không có câu ${qid}`);
    return {
      qid,
      domain: metaOf(input.metas, qid).domain,
      optionOrder: shuffle(
        q.options.map((o) => o.key),
        rng,
      ),
    };
  });
  const real = input.mode === 'real';
  return {
    id: input.id,
    setId: input.setId,
    mode: input.mode,
    seed: input.seed,
    esl: real ? input.esl : false,
    startedAt: input.now,
    endsAt: real ? input.now + examDurationMs(input.esl) : undefined,
    questions,
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
  };
}

export function displayLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function isCompatible(attempt: Attempt, questions: Map<number, Question>): boolean {
  if (attempt.status === 'incompatible') return false;
  return attempt.questions.every((aq) => {
    const q = questions.get(aq.qid);
    if (!q) return false;
    const keys = q.options.map((o) => o.key).sort().join(',');
    return [...aq.optionOrder].sort().join(',') === keys;
  });
}
```

- [ ] **Step 5: Viết `src/engine/actions.ts`**

```ts
import type { Attempt } from './attempt';

export function selectOption(attempt: Attempt, qid: number, key: string, choose: number): Attempt {
  if (attempt.status !== 'in-progress') return attempt;
  const current = attempt.answers[qid] ?? [];
  let next: string[];
  if (choose <= 1) next = [key];
  else if (current.includes(key)) next = current.filter((k) => k !== key);
  else if (current.length >= choose) return attempt;
  else next = [...current, key];
  return { ...attempt, answers: { ...attempt.answers, [qid]: next } };
}

export function toggleFlag(attempt: Attempt, qid: number): Attempt {
  const flagged = attempt.flagged.includes(qid)
    ? attempt.flagged.filter((id) => id !== qid)
    : [...attempt.flagged, qid];
  return { ...attempt, flagged };
}

export function markGuideOpened(attempt: Attempt, qid: number): Attempt {
  if (attempt.guideOpened.includes(qid)) return attempt;
  return { ...attempt, guideOpened: [...attempt.guideOpened, qid] };
}

export function submitAttempt(attempt: Attempt, now: number): Attempt {
  if (attempt.status !== 'in-progress') return attempt;
  return { ...attempt, status: 'submitted', submittedAt: now };
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run src/engine/attempt.test.ts src/engine/actions.test.ts`
Expected: toàn bộ PASS (19 test).

- [ ] **Step 7: Commit**

```bash
git add src/engine/attempt.ts src/engine/attempt.test.ts src/engine/actions.ts src/engine/actions.test.ts
git commit -m "feat(engine): attempt creation with reserve swaps, shuffling and answer actions"
```

---

### Task 8: Engine chấm điểm, xem lại, thống kê, đồng hồ

**Files:**
- Create: `src/engine/scoring.ts`, `src/engine/review.ts`, `src/engine/stats.ts`, `src/engine/timer.ts`
- Test: `src/engine/scoring.test.ts`, `src/engine/review.test.ts`, `src/engine/stats.test.ts`, `src/engine/timer.test.ts`

**Interfaces:**
- Consumes: `Attempt`, `AttemptQuestion`, `Mode` (Task 7); `DOMAINS`, `byDomainRecord` (Task 1)
- Produces:
  - scoring.ts: `PASS_SCORE = 720`; `isCorrect(selected: readonly string[] | undefined, answer: readonly string[]): boolean`; `scaledScore(correct: number, total: number): number`; `interface DomainScore { total: number; correct: number; pct: number }`; `interface ScoreResult { total: number; correct: number; score: number; passed: boolean; byDomain: Record<Domain, DomainScore>; correctWithoutGuide: number }`; `scoreAttempt(attempt, questions: Map<number, Question>): ScoreResult`
  - review.ts: `type OptionState = 'neutral' | 'selected' | 'correct-chosen' | 'wrong-chosen' | 'missed'`; `optionState(key, selected: readonly string[], answer: readonly string[], reveal: boolean): OptionState`; `type ReviewFilter = 'all' | 'wrong' | 'flagged' | 'guide' | 'domain-1' | 'domain-2' | 'domain-3' | 'domain-4'`; `filterReview(attempt, questions, filter): { aq: AttemptQuestion; index: number }[]`
  - stats.ts: `WEAK_THRESHOLD = 72`; `interface AttemptSummary { attemptId: string; setId: number; mode: Mode; submittedAt: number; score: number; passed: boolean; correct: number; total: number; byDomain: Record<Domain, number> }`; `summarize(attempt, questions): AttemptSummary`; `interface SetStats { attempts: AttemptSummary[]; latest: AttemptSummary | null; best: number | null; average: { score: number; byDomain: Record<Domain, number> } | null }`; `setStats(summaries: AttemptSummary[], setId: number, mode?: Mode): SetStats`
  - timer.ts: `remainingMs(endsAt: number, now: number): number`; `formatClock(ms: number): string`

- [ ] **Step 1: Viết test thất bại**

`src/engine/scoring.test.ts`:
```ts
import type { Question } from '../data/types';
import type { Attempt } from './attempt';
import { PASS_SCORE, isCorrect, scaledScore, scoreAttempt } from './scoring';

describe('isCorrect', () => {
  it('phải chọn đúng và đủ, không phụ thuộc thứ tự', () => {
    expect(isCorrect(['A'], ['A'])).toBe(true);
    expect(isCorrect(['C', 'A'], ['A', 'C'])).toBe(true);
    expect(isCorrect(['A'], ['A', 'C'])).toBe(false);
    expect(isCorrect(['A', 'B'], ['A', 'C'])).toBe(false);
    expect(isCorrect([], ['A'])).toBe(false);
    expect(isCorrect(undefined, ['A'])).toBe(false);
  });
});

describe('scaledScore', () => {
  it('quy đổi tuyến tính 100–1000 và ngưỡng 720', () => {
    expect(scaledScore(65, 65)).toBe(1000);
    expect(scaledScore(0, 65)).toBe(100);
    expect(scaledScore(45, 65)).toBe(723);
    expect(scaledScore(44, 65)).toBe(709);
    expect(scaledScore(45, 65) >= PASS_SCORE).toBe(true);
    expect(scaledScore(44, 65) >= PASS_SCORE).toBe(false);
  });
});

describe('scoreAttempt', () => {
  const questions = new Map<number, Question>(
    [1, 2, 3, 4].map((id) => [
      id,
      { id, stem: '', prompt: '', options: [], answer: id === 4 ? ['A', 'B'] : ['A'], choose: id === 4 ? 2 : 1, explanationOrig: '' },
    ]),
  );
  const attempt: Attempt = {
    id: 'x',
    setId: 1,
    mode: 'practice',
    seed: 1,
    esl: false,
    startedAt: 0,
    questions: [
      { qid: 1, domain: 1, optionOrder: [] },
      { qid: 2, domain: 1, optionOrder: [] },
      { qid: 3, domain: 2, optionOrder: [] },
      { qid: 4, domain: 4, optionOrder: [] },
    ],
    answers: { 1: ['A'], 2: ['B'], 4: ['B', 'A'] },
    flagged: [],
    guideOpened: [4],
    status: 'submitted',
  };

  it('đếm đúng, tính % theo domain, câu bỏ trống là sai', () => {
    const r = scoreAttempt(attempt, questions);
    expect(r.correct).toBe(2);
    expect(r.total).toBe(4);
    expect(r.byDomain[1]).toEqual({ total: 2, correct: 1, pct: 50 });
    expect(r.byDomain[2]).toEqual({ total: 1, correct: 0, pct: 0 });
    expect(r.byDomain[3]).toEqual({ total: 0, correct: 0, pct: 0 });
    expect(r.byDomain[4]).toEqual({ total: 1, correct: 1, pct: 100 });
    expect(r.score).toBe(550);
    expect(r.passed).toBe(false);
  });

  it('đếm riêng số câu đúng khi chưa xem hướng dẫn', () => {
    expect(scoreAttempt(attempt, questions).correctWithoutGuide).toBe(1);
  });
});
```

`src/engine/review.test.ts`:
```ts
import type { Question } from '../data/types';
import type { Attempt } from './attempt';
import { filterReview, optionState } from './review';

describe('optionState', () => {
  it('chưa mở đáp án: chỉ phân biệt đã chọn hay chưa', () => {
    expect(optionState('A', ['A'], ['B'], false)).toBe('selected');
    expect(optionState('B', ['A'], ['B'], false)).toBe('neutral');
  });

  it('đã mở đáp án: xanh, đỏ, viền xanh', () => {
    expect(optionState('A', ['A', 'B'], ['A', 'C'], true)).toBe('correct-chosen');
    expect(optionState('B', ['A', 'B'], ['A', 'C'], true)).toBe('wrong-chosen');
    expect(optionState('C', ['A', 'B'], ['A', 'C'], true)).toBe('missed');
    expect(optionState('D', ['A', 'B'], ['A', 'C'], true)).toBe('neutral');
  });
});

describe('filterReview', () => {
  const questions = new Map<number, Question>(
    [1, 2, 3].map((id) => [id, { id, stem: '', prompt: '', options: [], answer: ['A'], choose: 1, explanationOrig: '' }]),
  );
  const attempt: Attempt = {
    id: 'x',
    setId: 1,
    mode: 'practice',
    seed: 1,
    esl: false,
    startedAt: 0,
    questions: [
      { qid: 1, domain: 1, optionOrder: [] },
      { qid: 2, domain: 2, optionOrder: [] },
      { qid: 3, domain: 2, optionOrder: [] },
    ],
    answers: { 1: ['A'], 2: ['B'] },
    flagged: [3],
    guideOpened: [1],
    status: 'submitted',
  };
  const ids = (f: Parameters<typeof filterReview>[2]) => filterReview(attempt, questions, f).map((x) => x.aq.qid);

  it('lọc theo từng loại, giữ vị trí trong bài', () => {
    expect(ids('all')).toEqual([1, 2, 3]);
    expect(ids('wrong')).toEqual([2, 3]);
    expect(ids('flagged')).toEqual([3]);
    expect(ids('guide')).toEqual([1]);
    expect(ids('domain-2')).toEqual([2, 3]);
    expect(filterReview(attempt, questions, 'wrong')[0].index).toBe(1);
  });
});
```

`src/engine/stats.test.ts`:
```ts
import { setStats, type AttemptSummary } from './stats';

function s(id: string, setId: number, mode: 'real' | 'practice', at: number, score: number, d1: number): AttemptSummary {
  return { attemptId: id, setId, mode, submittedAt: at, score, passed: score >= 720, correct: 0, total: 65, byDomain: { 1: d1, 2: 50, 3: 60, 4: 70 } };
}

describe('setStats', () => {
  const all = [s('a', 1, 'real', 1, 700, 60), s('b', 1, 'real', 3, 800, 80), s('c', 1, 'practice', 2, 900, 90), s('d', 2, 'real', 4, 500, 40)];

  it('lọc theo đề và chế độ, sắp mới nhất trước', () => {
    const r = setStats(all, 1, 'real');
    expect(r.attempts.map((x) => x.attemptId)).toEqual(['b', 'a']);
    expect(r.latest?.attemptId).toBe('b');
    expect(r.best).toBe(800);
    expect(r.average).toEqual({ score: 750, byDomain: { 1: 70, 2: 50, 3: 60, 4: 70 } });
  });

  it('không lọc chế độ thì gộp cả hai', () => {
    expect(setStats(all, 1).attempts).toHaveLength(3);
  });

  it('đề chưa có lượt nào', () => {
    expect(setStats(all, 5, 'real')).toEqual({ attempts: [], latest: null, best: null, average: null });
  });
});
```

`src/engine/timer.test.ts`:
```ts
import { formatClock, remainingMs } from './timer';

describe('timer', () => {
  it('remainingMs không âm', () => {
    expect(remainingMs(1000, 400)).toBe(600);
    expect(remainingMs(1000, 5000)).toBe(0);
  });

  it('formatClock hiển thị H:MM:SS, làm tròn lên giây', () => {
    expect(formatClock(130 * 60_000)).toBe('2:10:00');
    expect(formatClock(1)).toBe('0:00:01');
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(59_500)).toBe('0:01:00');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/engine/scoring.test.ts src/engine/review.test.ts src/engine/stats.test.ts src/engine/timer.test.ts`
Expected: FAIL, không resolve được các module.

- [ ] **Step 3: Viết `src/engine/scoring.ts`**

```ts
import { DOMAINS, byDomainRecord } from '../data/constants';
import type { Domain, Question } from '../data/types';
import type { Attempt } from './attempt';

export const PASS_SCORE = 720;

export function isCorrect(selected: readonly string[] | undefined, answer: readonly string[]): boolean {
  if (!selected || selected.length !== answer.length) return false;
  return answer.every((k) => selected.includes(k));
}

export function scaledScore(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round(100 + (900 * correct) / total);
}

export interface DomainScore {
  total: number;
  correct: number;
  pct: number;
}

export interface ScoreResult {
  total: number;
  correct: number;
  score: number;
  passed: boolean;
  byDomain: Record<Domain, DomainScore>;
  correctWithoutGuide: number;
}

export function scoreAttempt(attempt: Attempt, questions: Map<number, Question>): ScoreResult {
  const byDomain = byDomainRecord<DomainScore>(() => ({ total: 0, correct: 0, pct: 0 }));
  let correct = 0;
  let correctWithoutGuide = 0;
  for (const aq of attempt.questions) {
    const q = questions.get(aq.qid);
    if (!q) throw new Error(`Không có câu ${aq.qid}`);
    const slot = byDomain[aq.domain];
    slot.total++;
    if (isCorrect(attempt.answers[aq.qid], q.answer)) {
      correct++;
      slot.correct++;
      if (!attempt.guideOpened.includes(aq.qid)) correctWithoutGuide++;
    }
  }
  for (const d of DOMAINS) {
    const slot = byDomain[d];
    slot.pct = slot.total ? Math.round((100 * slot.correct) / slot.total) : 0;
  }
  const total = attempt.questions.length;
  const score = scaledScore(correct, total);
  return { total, correct, score, passed: score >= PASS_SCORE, byDomain, correctWithoutGuide };
}
```

- [ ] **Step 4: Viết `src/engine/review.ts`**

```ts
import type { Question } from '../data/types';
import type { Attempt, AttemptQuestion } from './attempt';
import { isCorrect } from './scoring';

export type OptionState = 'neutral' | 'selected' | 'correct-chosen' | 'wrong-chosen' | 'missed';

export function optionState(
  key: string,
  selected: readonly string[],
  answer: readonly string[],
  reveal: boolean,
): OptionState {
  const chosen = selected.includes(key);
  if (!reveal) return chosen ? 'selected' : 'neutral';
  const right = answer.includes(key);
  if (chosen && right) return 'correct-chosen';
  if (chosen) return 'wrong-chosen';
  if (right) return 'missed';
  return 'neutral';
}

export type ReviewFilter = 'all' | 'wrong' | 'flagged' | 'guide' | 'domain-1' | 'domain-2' | 'domain-3' | 'domain-4';

export function filterReview(
  attempt: Attempt,
  questions: Map<number, Question>,
  filter: ReviewFilter,
): { aq: AttemptQuestion; index: number }[] {
  return attempt.questions
    .map((aq, index) => ({ aq, index }))
    .filter(({ aq }) => {
      switch (filter) {
        case 'all':
          return true;
        case 'wrong':
          return !isCorrect(attempt.answers[aq.qid], questions.get(aq.qid)?.answer ?? []);
        case 'flagged':
          return attempt.flagged.includes(aq.qid);
        case 'guide':
          return attempt.guideOpened.includes(aq.qid);
        default:
          return `domain-${aq.domain}` === filter;
      }
    });
}
```

- [ ] **Step 5: Viết `src/engine/stats.ts` và `src/engine/timer.ts`**

`src/engine/stats.ts`:
```ts
import { byDomainRecord } from '../data/constants';
import type { Domain, Question } from '../data/types';
import type { Attempt, Mode } from './attempt';
import { scoreAttempt } from './scoring';

export const WEAK_THRESHOLD = 72;

export interface AttemptSummary {
  attemptId: string;
  setId: number;
  mode: Mode;
  submittedAt: number;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  byDomain: Record<Domain, number>;
}

export function summarize(attempt: Attempt, questions: Map<number, Question>): AttemptSummary {
  const r = scoreAttempt(attempt, questions);
  return {
    attemptId: attempt.id,
    setId: attempt.setId,
    mode: attempt.mode,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    score: r.score,
    passed: r.passed,
    correct: r.correct,
    total: r.total,
    byDomain: byDomainRecord((d) => r.byDomain[d].pct),
  };
}

export interface SetStats {
  attempts: AttemptSummary[];
  latest: AttemptSummary | null;
  best: number | null;
  average: { score: number; byDomain: Record<Domain, number> } | null;
}

export function setStats(summaries: AttemptSummary[], setId: number, mode?: Mode): SetStats {
  const attempts = summaries
    .filter((s) => s.setId === setId && (!mode || s.mode === mode))
    .sort((a, b) => b.submittedAt - a.submittedAt);
  if (attempts.length === 0) return { attempts, latest: null, best: null, average: null };
  const avg = (pick: (s: AttemptSummary) => number) =>
    Math.round(attempts.reduce((sum, s) => sum + pick(s), 0) / attempts.length);
  return {
    attempts,
    latest: attempts[0],
    best: Math.max(...attempts.map((s) => s.score)),
    average: { score: avg((s) => s.score), byDomain: byDomainRecord((d) => avg((s) => s.byDomain[d])) },
  };
}
```

`src/engine/timer.ts`:
```ts
export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run src/engine`
Expected: toàn bộ test trong `src/engine` PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine
git commit -m "feat(engine): scoring, review states, per-set domain stats and timer helpers"
```

---

### Task 9: Storage, Bank, App context và test fixtures

**Files:**
- Create: `src/storage/storage.ts`, `src/data/bank.ts`, `src/data/load.ts`, `src/app/context.tsx`, `src/test/fixtures.tsx`
- Test: `src/storage/storage.test.ts`, `src/data/bank.test.ts`

**Interfaces:**
- Consumes: `Attempt` (Task 7); types (Task 1); `data/*.json` (Task 3–6)
- Produces:
  - storage.ts: `STORAGE_KEY = 'saa-c03:attempts:v1'`; `interface AttemptStore { readonly available: boolean; list(): Attempt[]; get(id: string): Attempt | undefined; save(attempt: Attempt): boolean }`; `createStore(storage: Storage | null): AttemptStore`; `getBrowserStorage(): Storage | null`
  - bank.ts: `interface Bank { questions: Map<number, Question>; meta: Map<number, QuestionMeta>; vi: Map<number, QuestionVi>; services: Map<string, ServiceRef>; questionsByService: Map<string, number[]>; sets: SetsFile }`; `buildBank(input: { questions: Question[]; metas: QuestionMeta[]; vis: QuestionVi[]; registry: ServiceRef[]; sets: SetsFile }): Bank`
  - load.ts: `bank: Bank` (dữ liệu thật)
  - context.tsx: `interface AppDeps { bank: Bank; store: AttemptStore; now: () => number; newSeed: () => number; newId: () => string }`; `AppProvider({ deps, children })`; `useApp(): AppDeps`
  - fixtures.tsx: `makeBank(): Bank` (75 câu: đề 1 = câu 1–65 theo quota, kho dự phòng = câu 66–75; câu 2 là câu chọn 2 trong 5 lựa chọn; câu 1 có bản dịch vi và service `s3`); `memoryStorage(): Storage`; `makeDeps(overrides?: Partial<AppDeps>): AppDeps`; `renderApp(path: string, deps: AppDeps)` (dùng `AppRoutes` từ Task 10)

- [ ] **Step 1: Viết test thất bại**

`src/storage/storage.test.ts`:
```ts
import type { Attempt } from '../engine/attempt';
import { STORAGE_KEY, createStore } from './storage';

function attempt(id: string): Attempt {
  return { id, setId: 1, mode: 'real', seed: 1, esl: false, startedAt: 0, questions: [], answers: {}, flagged: [], guideOpened: [], status: 'in-progress' };
}

function fakeStorage(initial: Record<string, string> = {}, failWrites = false): Storage {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
  };
}

describe('createStore', () => {
  it('lưu rồi đọc lại qua một store mới (giống tải lại trang)', () => {
    const storage = fakeStorage();
    createStore(storage).save(attempt('a'));
    const reloaded = createStore(storage);
    expect(reloaded.get('a')?.id).toBe('a');
    expect(reloaded.list()).toHaveLength(1);
  });

  it('JSON hỏng thì coi như rỗng, không ném lỗi', () => {
    const store = createStore(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    expect(store.list()).toEqual([]);
  });

  it('bỏ qua bản ghi không đúng cấu trúc, giữ bản ghi hợp lệ', () => {
    const raw = JSON.stringify({ a: attempt('a'), b: { id: 5 }, c: null });
    expect(createStore(fakeStorage({ [STORAGE_KEY]: raw })).list().map((x) => x.id)).toEqual(['a']);
  });

  it('ghi thất bại: trả về false, available = false, vẫn giữ trong bộ nhớ', () => {
    const store = createStore(fakeStorage({}, true));
    expect(store.save(attempt('a'))).toBe(false);
    expect(store.available).toBe(false);
    expect(store.get('a')?.id).toBe('a');
  });

  it('không có storage: chạy bằng bộ nhớ tạm', () => {
    const store = createStore(null);
    expect(store.available).toBe(false);
    store.save(attempt('x'));
    expect(store.get('x')?.id).toBe('x');
  });
});
```

`src/data/bank.test.ts`:
```ts
import { buildBank } from './bank';

describe('buildBank', () => {
  it('lập chỉ mục câu hỏi, meta, bản dịch, service và câu hỏi liên quan', () => {
    const bank = buildBank({
      questions: [1, 2].map((id) => ({ id, stem: '', prompt: '', options: [], answer: ['A'], choose: 1, explanationOrig: '' })),
      metas: [
        { id: 1, domain: 1, difficulty: 1, services: ['s3', 'iam'] },
        { id: 2, domain: 2, difficulty: 2, services: ['s3'] },
      ],
      vis: [{ id: 2, stemVi: '', promptVi: '', options: [], explanationVi: '', keyHint: '' }],
      registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
      sets: { version: 1, sets: [], reserve: [] },
    });
    expect(bank.questions.get(2)?.id).toBe(2);
    expect(bank.meta.get(1)?.domain).toBe(1);
    expect(bank.vi.has(2)).toBe(true);
    expect(bank.services.get('s3')?.name).toBe('Amazon S3');
    expect(bank.questionsByService.get('s3')).toEqual([1, 2]);
    expect(bank.questionsByService.get('iam')).toEqual([1]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/storage src/data/bank.test.ts`
Expected: FAIL, không resolve được `./storage` và `./bank`.

- [ ] **Step 3: Viết `src/storage/storage.ts`**

```ts
import type { Attempt } from '../engine/attempt';

export const STORAGE_KEY = 'saa-c03:attempts:v1';

export interface AttemptStore {
  readonly available: boolean;
  list(): Attempt[];
  get(id: string): Attempt | undefined;
  save(attempt: Attempt): boolean;
}

function looksLikeAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.setId === 'number' && Array.isArray(v.questions) && typeof v.answers === 'object';
}

function readAll(storage: Storage | null): Record<string, Attempt> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, Attempt> = {};
    for (const [key, value] of Object.entries(parsed)) if (looksLikeAttempt(value)) out[key] = value;
    return out;
  } catch {
    return {};
  }
}

export function createStore(storage: Storage | null): AttemptStore {
  let memory = readAll(storage);
  let available = storage !== null;
  return {
    get available() {
      return available;
    },
    list: () => Object.values(memory),
    get: (id) => memory[id],
    save(attempt) {
      memory = { ...memory, [attempt.id]: attempt };
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(memory));
        return true;
      } catch {
        available = false;
        return false;
      }
    },
  };
}

export function getBrowserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__saa_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Viết `src/data/bank.ts` và `src/data/load.ts`**

`src/data/bank.ts`:
```ts
import type { Question, QuestionMeta, QuestionVi, ServiceRef, SetsFile } from './types';

export interface Bank {
  questions: Map<number, Question>;
  meta: Map<number, QuestionMeta>;
  vi: Map<number, QuestionVi>;
  services: Map<string, ServiceRef>;
  questionsByService: Map<string, number[]>;
  sets: SetsFile;
}

export function buildBank(input: {
  questions: Question[];
  metas: QuestionMeta[];
  vis: QuestionVi[];
  registry: ServiceRef[];
  sets: SetsFile;
}): Bank {
  const questionsByService = new Map<string, number[]>();
  for (const m of [...input.metas].sort((a, b) => a.id - b.id)) {
    for (const s of m.services) questionsByService.set(s, [...(questionsByService.get(s) ?? []), m.id]);
  }
  return {
    questions: new Map(input.questions.map((q) => [q.id, q])),
    meta: new Map(input.metas.map((m) => [m.id, m])),
    vi: new Map(input.vis.map((v) => [v.id, v])),
    services: new Map(input.registry.map((s) => [s.id, s])),
    questionsByService,
    sets: input.sets,
  };
}
```

`src/data/load.ts`:
```ts
import questions from '../../data/questions.json';
import registry from '../../data/service-registry.json';
import sets from '../../data/sets.json';
import { buildBank } from './bank';
import type { Question, QuestionMeta, QuestionVi, ServiceRef, SetsFile } from './types';

const metaFiles = import.meta.glob<QuestionMeta[]>('../../data/meta/*.json', { eager: true, import: 'default' });
const viFiles = import.meta.glob<QuestionVi[]>('../../data/vi/*.json', { eager: true, import: 'default' });

export const bank = buildBank({
  questions: questions as unknown as Question[],
  metas: Object.values(metaFiles).flat(),
  vis: Object.values(viFiles).flat(),
  registry: registry as unknown as ServiceRef[],
  sets: sets as unknown as SetsFile,
});
```

- [ ] **Step 5: Viết `src/app/context.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { Bank } from '../data/bank';
import type { AttemptStore } from '../storage/storage';

export interface AppDeps {
  bank: Bank;
  store: AttemptStore;
  now: () => number;
  newSeed: () => number;
  newId: () => string;
}

const AppContext = createContext<AppDeps | null>(null);

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  return <AppContext.Provider value={deps}>{children}</AppContext.Provider>;
}

export function useApp(): AppDeps {
  const deps = useContext(AppContext);
  if (!deps) throw new Error('useApp phải nằm trong AppProvider');
  return deps;
}
```

- [ ] **Step 6: Viết `src/test/fixtures.tsx`** (dùng cho test UI ở Task 10–13; `renderApp` import `AppRoutes`, file này được tạo ở Task 10)

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, type AppDeps } from '../app/context';
import { AppRoutes } from '../app/routes';
import { buildBank, type Bank } from '../data/bank';
import type { Difficulty, Domain, Question, QuestionMeta } from '../data/types';
import { createStore } from '../storage/storage';

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function makeQuestion(id: number, keys = ['A', 'B', 'C', 'D'], answer = ['A']): Question {
  return {
    id,
    stem: `Stem ${id}`,
    prompt: `Prompt ${id}?`,
    options: keys.map((key) => ({ key, text: `Option ${key} of ${id}` })),
    answer,
    choose: answer.length,
    explanationOrig: `Giải thích gốc ${id}`,
  };
}

function domainOf(id: number): Domain {
  if (id <= 65) return id <= 20 ? 1 : id <= 37 ? 2 : id <= 52 ? 3 : 4;
  return ([1, 1, 1, 2, 2, 2, 3, 3, 4, 4] as Domain[])[id - 66];
}

export function makeBank(): Bank {
  const ids = range(1, 75);
  const questions = ids.map((id) => (id === 2 ? makeQuestion(2, ['A', 'B', 'C', 'D', 'E'], ['A', 'C']) : makeQuestion(id)));
  const metas: QuestionMeta[] = ids.map((id) => ({
    id,
    domain: domainOf(id),
    difficulty: ((id % 3) + 1) as Difficulty,
    services: id === 1 ? ['s3'] : [],
  }));
  return buildBank({
    questions,
    metas,
    vis: [
      {
        id: 1,
        stemVi: 'Đề bài câu 1 bằng tiếng Việt',
        promptVi: 'Câu hỏi 1 bằng tiếng Việt?',
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: `Lựa chọn ${key} tiếng Việt`, reason: `Lý do ${key}` })),
        explanationVi: 'Giải thích tiếng Việt câu 1',
        keyHint: 'Dấu hiệu nhận biết câu 1',
      },
    ],
    registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
    sets: { version: 1, sets: [{ id: 1, questionIds: range(1, 65) }], reserve: range(66, 75) },
  });
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  let n = 0;
  return {
    bank: makeBank(),
    store: createStore(memoryStorage()),
    now: () => 1_000_000,
    newSeed: () => 42,
    newId: () => `att-${++n}`,
    ...overrides,
  };
}

export function renderApp(path: string, deps: AppDeps) {
  return render(
    <AppProvider deps={deps}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProvider>,
  );
}
```

- [ ] **Step 7: Chạy test để xác nhận PASS**

Run: `npx vitest run src/storage src/data/bank.test.ts`
Expected: 6 test PASS. (`fixtures.tsx` chưa được import ở đâu nên chưa cần `routes.tsx`. Chạy typecheck sau Task 10.)

- [ ] **Step 8: Commit**

```bash
git add src/storage src/data/bank.ts src/data/bank.test.ts src/data/load.ts src/app/context.tsx src/test/fixtures.tsx
git commit -m "feat(app): attempt storage with memory fallback, data bank and app context"
```

---

### Task 10: Khung app (layout, router, theme, CSS), Trang chủ và Thống kê đề

**Files:**
- Create: `src/app/routes.tsx`, `src/app/theme.ts`, `src/app/format.ts`, `src/components/Layout.tsx`, `src/components/DomainBars.tsx`, `src/pages/HomePage.tsx`, `src/pages/SetStatsPage.tsx`, `src/styles.css`
- Modify: `src/main.tsx` (thay toàn bộ)
- Test: `src/pages/HomePage.test.tsx`, `src/pages/SetStatsPage.test.tsx`

**Interfaces:**
- Consumes: `useApp`, `AppDeps` (Task 9); `createAttempt`, `isCompatible`, `Mode` (Task 7); `summarize`, `setStats`, `WEAK_THRESHOLD` (Task 8); fixtures (Task 9)
- Produces: `AppRoutes()` (Task 11–13 thêm route vào file này); `useTheme(): ['light' | 'dark', () => void]`; `modeName(mode: Mode): string`; `formatDate(ms: number): string`; `DomainBars({ byDomain, caption })`; `Layout()`

- [ ] **Step 1: Viết test thất bại**

`src/pages/HomePage.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

describe('HomePage', () => {
  it('hiện danh sách đề và nhắc ESL', () => {
    renderApp('/', makeDeps());
    expect(screen.getByRole('heading', { name: 'Đề 1' })).toBeInTheDocument();
    expect(screen.getByText(/đăng ký ESL \+30/)).toBeInTheDocument();
    expect(screen.getByText('Chưa có lượt thi nào.')).toBeInTheDocument();
  });

  it('bấm Thi thật tạo lượt thi có ESL bật sẵn (160 phút)', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Thi thật' }));
    const [attempt] = deps.store.list();
    expect(attempt.mode).toBe('real');
    expect(attempt.esl).toBe(true);
    expect(attempt.endsAt).toBe(1_000_000 + 160 * 60_000);
  });

  it('bỏ chọn ESL thì Thi thật còn 130 phút', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByLabelText(/ESL \+30 phút/));
    fireEvent.click(screen.getByRole('button', { name: 'Thi thật' }));
    expect(deps.store.list()[0].endsAt).toBe(1_000_000 + 130 * 60_000);
  });

  it('Thi thử không có endsAt', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Thi thử' }));
    expect(deps.store.list()[0].endsAt).toBeUndefined();
  });
});
```

`src/pages/SetStatsPage.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react';
import { createAttempt } from '../engine/attempt';
import { submitAttempt } from '../engine/actions';
import { makeDeps, renderApp } from '../test/fixtures';

describe('SetStatsPage', () => {
  it('hiện % đúng từng domain của mỗi lượt, lọc theo chế độ', () => {
    const deps = makeDeps();
    const base = createAttempt({ id: 'r1', setId: 1, mode: 'real', esl: true, seed: 1, now: 0, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    const answers = Object.fromEntries(base.questions.filter((q) => q.domain === 1).map((q) => [q.qid, deps.bank.questions.get(q.qid)!.answer]));
    deps.store.save(submitAttempt({ ...base, answers }, 60_000));

    renderApp('/set/1', deps);
    expect(screen.getByRole('heading', { name: 'Thống kê Đề 1' })).toBeInTheDocument();
    const firstRow = screen.getAllByRole('row')[1];
    expect(firstRow).toHaveTextContent('100%');
    expect(firstRow).toHaveTextContent('0%');
    fireEvent.click(screen.getByRole('button', { name: 'Thi thử' }));
    expect(screen.getByText('Chưa có lượt Thi thử nào cho đề này.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/pages`
Expected: FAIL, không resolve được `../app/routes`.

- [ ] **Step 3: Viết `src/app/format.ts`, `src/app/theme.ts`**

`src/app/format.ts`:
```ts
import type { Mode } from '../engine/attempt';

export function modeName(mode: Mode): string {
  return mode === 'real' ? 'Thi thật' : 'Thi thử';
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
```

`src/app/theme.ts`:
```ts
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'saa-c03:theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage bị chặn: dùng theme của hệ thống
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // bỏ qua
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
```

- [ ] **Step 4: Viết `src/components/Layout.tsx`, `src/components/DomainBars.tsx`**

`src/components/Layout.tsx`:
```tsx
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../app/context';
import { useTheme } from '../app/theme';

export function Layout() {
  const { store } = useApp();
  const [theme, toggleTheme] = useTheme();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          SAA-C03
        </Link>
        <nav className="topbar__nav">
          <NavLink to="/" end>
            Đề thi
          </NavLink>
          <NavLink to="/services">Service</NavLink>
        </nav>
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Đổi giao diện sáng/tối">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>
      {!store.available && (
        <p className="banner" role="status">
          Trình duyệt không cho lưu dữ liệu. Lịch sử thi sẽ mất khi đóng trang.
        </p>
      )}
      <Outlet />
    </>
  );
}
```

`src/components/DomainBars.tsx`:
```tsx
import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import { WEAK_THRESHOLD } from '../engine/stats';

export function DomainBars({ byDomain, caption }: { byDomain: Record<Domain, number>; caption: string }) {
  return (
    <figure className="bars">
      <figcaption>{caption}</figcaption>
      {DOMAINS.map((d) => (
        <div key={d} className="bars__row">
          <span className="bars__label">{DOMAIN_SHORT[d]}</span>
          <span className="bars__track">
            <span className={`bars__fill${byDomain[d] < WEAK_THRESHOLD ? ' is-weak' : ''}`} style={{ width: `${byDomain[d]}%` }} />
          </span>
          <span className="bars__value">{byDomain[d]}%</span>
        </div>
      ))}
    </figure>
  );
}
```

- [ ] **Step 5: Viết `src/pages/HomePage.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { formatDate, modeName } from '../app/format';
import { DomainBars } from '../components/DomainBars';
import { createAttempt, isCompatible, type Mode } from '../engine/attempt';
import { PASS_SCORE } from '../engine/scoring';
import { setStats, summarize } from '../engine/stats';

export function HomePage() {
  const { bank, store, now, newSeed, newId } = useApp();
  const navigate = useNavigate();
  const [esl, setEsl] = useState(true);

  const all = store.list();
  const usable = all.filter((a) => isCompatible(a, bank.questions));
  const inProgress = usable.filter((a) => a.status === 'in-progress').sort((a, b) => b.startedAt - a.startedAt);
  const summaries = usable.filter((a) => a.status === 'submitted').map((a) => summarize(a, bank.questions));
  const recent = [...summaries].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 10);
  const hiddenCount = all.length - usable.length;

  const start = (setId: number, mode: Mode) => {
    const attempt = createAttempt({
      id: newId(),
      setId,
      mode,
      esl,
      seed: newSeed(),
      now: now(),
      sets: bank.sets,
      questions: bank.questions,
      metas: bank.meta,
    });
    store.save(attempt);
    navigate(`/exam/${attempt.id}`);
  };

  return (
    <main className="page home">
      <h1>Luyện thi AWS SAA-C03</h1>
      <p>
        {bank.sets.sets.length} đề × 65 câu, chia theo domain như đề thật. Đậu khi đạt ≥ {PASS_SCORE}/1000.
      </p>

      {inProgress.length > 0 && (
        <section>
          <h2>Đang làm dở</h2>
          <ul className="plain-list">
            {inProgress.map((a) => (
              <li key={a.id}>
                <Link to={`/exam/${a.id}`}>
                  Làm tiếp Đề {a.setId} ({modeName(a.mode)}), bắt đầu {formatDate(a.startedAt)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="esl">
        <input type="checkbox" checked={esl} onChange={(e) => setEsl(e.target.checked)} /> ESL +30 phút cho Thi thật (160 phút)
      </label>
      <p className="hint">Nhớ đăng ký ESL +30 với AWS trước khi đặt lịch thi thật.</p>

      <div className="set-grid">
        {bank.sets.sets.map((set) => {
          const real = setStats(summaries, set.id, 'real');
          const any = setStats(summaries, set.id);
          return (
            <article key={set.id} className="card set-card">
              <h2>
                <Link to={`/set/${set.id}`}>Đề {set.id}</Link>
              </h2>
              <p>
                Thi thật: {real.attempts.length} lần · cao nhất {real.best ?? '—'}
              </p>
              <p>Tổng số lần làm: {any.attempts.length}</p>
              {any.latest && <DomainBars byDomain={any.latest.byDomain} caption={`Lượt gần nhất (${modeName(any.latest.mode)})`} />}
              <div className="set-card__actions">
                <button type="button" className="btn-primary" onClick={() => start(set.id, 'real')}>
                  Thi thật
                </button>
                <button type="button" onClick={() => start(set.id, 'practice')}>
                  Thi thử
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section>
        <h2>Lịch sử</h2>
        {recent.length === 0 ? (
          <p>Chưa có lượt thi nào.</p>
        ) : (
          <ul className="plain-list">
            {recent.map((s) => (
              <li key={s.attemptId}>
                <Link to={`/result/${s.attemptId}`}>
                  Đề {s.setId} · {modeName(s.mode)} · {s.score} điểm · {s.passed ? 'Đậu' : 'Trượt'} · {formatDate(s.submittedAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 && <p className="hint">{hiddenCount} lượt thi cũ không còn khớp dữ liệu hiện tại nên không mở được.</p>}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Viết `src/pages/SetStatsPage.tsx`**

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { formatDate, modeName } from '../app/format';
import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import { isCompatible, type Mode } from '../engine/attempt';
import { WEAK_THRESHOLD, setStats, summarize } from '../engine/stats';

export function SetStatsPage() {
  const { id } = useParams();
  const setId = Number(id);
  const { bank, store } = useApp();
  const [mode, setMode] = useState<Mode>('real');

  if (!bank.sets.sets.some((s) => s.id === setId)) {
    return (
      <main className="page">
        <p>Không có đề này.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }

  const summaries = store
    .list()
    .filter((a) => a.status === 'submitted' && isCompatible(a, bank.questions))
    .map((a) => summarize(a, bank.questions));
  const stats = setStats(summaries, setId, mode);
  const pctCell = (value: number, key: number) => (
    <td key={key} className={value < WEAK_THRESHOLD ? 'is-weak' : undefined}>
      {value}%
    </td>
  );

  return (
    <main className="page">
      <p>
        <Link to="/">← Danh sách đề</Link>
      </p>
      <h1>Thống kê Đề {setId}</h1>
      <div className="filters" role="group" aria-label="Chế độ">
        {(['real', 'practice'] as Mode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {modeName(m)}
          </button>
        ))}
      </div>
      {stats.attempts.length === 0 || !stats.average || !stats.latest ? (
        <p>Chưa có lượt {modeName(mode)} nào cho đề này.</p>
      ) : (
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Điểm</th>
                <th>Kết quả</th>
                {DOMAINS.map((d) => (
                  <th key={d}>{DOMAIN_SHORT[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.attempts.map((s) => (
                <tr key={s.attemptId}>
                  <td>
                    <Link to={`/result/${s.attemptId}`}>{formatDate(s.submittedAt)}</Link>
                  </td>
                  <td>{s.score}</td>
                  <td>{s.passed ? 'Đậu' : 'Trượt'}</td>
                  {DOMAINS.map((d) => pctCell(s.byDomain[d], d))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Trung bình</th>
                <td>{stats.average.score}</td>
                <td>—</td>
                {DOMAINS.map((d) => pctCell(stats.average!.byDomain[d], d))}
              </tr>
              <tr>
                <th>Gần nhất</th>
                <td>{stats.latest.score}</td>
                <td>{stats.latest.passed ? 'Đậu' : 'Trượt'}</td>
                {DOMAINS.map((d) => pctCell(stats.latest!.byDomain[d], d))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Viết `src/app/routes.tsx` và thay `src/main.tsx`**

`src/app/routes.tsx`:
```tsx
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { HomePage } from '../pages/HomePage';
import { SetStatsPage } from '../pages/SetStatsPage';

function NotFound() {
  return (
    <main className="page">
      <p>Không tìm thấy trang.</p>
      <Link to="/">Về trang chủ</Link>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="set/:id" element={<SetStatsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider, type AppDeps } from './app/context';
import { AppRoutes } from './app/routes';
import { bank } from './data/load';
import { randomSeed } from './engine/rng';
import { createStore, getBrowserStorage } from './storage/storage';
import './styles.css';

const deps: AppDeps = {
  bank,
  store: createStore(getBrowserStorage()),
  now: () => Date.now(),
  newSeed: randomSeed,
  newId: () => crypto.randomUUID(),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider deps={deps}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  </StrictMode>,
);
```

- [ ] **Step 8: Viết `src/styles.css`** (đủ cho mọi trang của giai đoạn 1)

```css
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #16181d;
  --muted: #5b6270;
  --border: #d9dde4;
  --primary: #2458d6;
  --primary-text: #ffffff;
  --ok: #1f7a3d;
  --ok-bg: #e3f4e8;
  --bad: #b3261e;
  --bad-bg: #fbe4e2;
  --warn: #8a5a00;
  --warn-bg: #fff3d6;
  --radius: 10px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #111318; --surface: #1b1e25; --text: #e8eaef; --muted: #a3aab8; --border: #333844;
    --primary: #7aa2ff; --primary-text: #0d1017; --ok: #6fd28f; --ok-bg: #143321; --bad: #ff8a80;
    --bad-bg: #3a1714; --warn: #ffcf66; --warn-bg: #3a2c0a; color-scheme: dark;
  }
}
:root[data-theme='dark'] {
  --bg: #111318; --surface: #1b1e25; --text: #e8eaef; --muted: #a3aab8; --border: #333844;
  --primary: #7aa2ff; --primary-text: #0d1017; --ok: #6fd28f; --ok-bg: #143321; --bad: #ff8a80;
  --bad-bg: #3a1714; --warn: #ffcf66; --warn-bg: #3a2c0a; color-scheme: dark;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, 'Segoe UI', Roboto, sans-serif; }
a { color: var(--primary); }
button { font: inherit; color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; cursor: pointer; }
button:disabled { opacity: 0.55; cursor: default; }
button[aria-pressed='true'] { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.btn-primary { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }

.topbar { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 5; }
.brand { font-weight: 700; text-decoration: none; color: var(--text); }
.topbar__nav { display: flex; gap: 12px; flex: 1; }
.topbar__nav a { text-decoration: none; color: var(--muted); }
.topbar__nav a.active { color: var(--text); font-weight: 600; }
.icon-btn { padding: 4px 10px; }
.banner { margin: 0; padding: 8px 16px; background: var(--warn-bg); color: var(--warn); }

.page { max-width: 960px; margin: 0 auto; padding: 16px; }
.hint { color: var(--muted); font-size: 0.92em; }
.plain-list { padding-left: 18px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.set-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin: 16px 0; }
.set-card h2 { margin: 0 0 8px; }
.set-card p { margin: 4px 0; }
.set-card__actions { display: flex; gap: 8px; margin-top: 12px; }
.esl { display: flex; gap: 8px; align-items: center; margin-top: 12px; }

.bars { margin: 10px 0 0; }
.bars figcaption { font-size: 0.85em; color: var(--muted); margin-bottom: 4px; }
.bars__row { display: grid; grid-template-columns: 110px 1fr 44px; gap: 8px; align-items: center; font-size: 0.85em; }
.bars__track { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.bars__fill { display: block; height: 100%; background: var(--ok); }
.bars__fill.is-weak { background: var(--bad); }

.filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.table-wrap { overflow-x: auto; }
table.stats { border-collapse: collapse; width: 100%; background: var(--surface); }
table.stats th, table.stats td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; white-space: nowrap; }
td.is-weak { color: var(--bad); font-weight: 600; }
tr.is-clickable { cursor: pointer; }

.exam__bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.timer { font-variant-numeric: tabular-nums; font-weight: 600; }
.timer--low { color: var(--bad); }
.exam__actions { display: flex; justify-content: space-between; gap: 8px; margin: 16px 0; }

.qcard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.qcard__heading { margin-top: 0; }
.qcard__choose { color: var(--muted); font-style: italic; }
.qcard__options { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
.opt { width: 100%; text-align: left; display: block; padding: 10px 12px; }
.opt:disabled { opacity: 1; cursor: default; }
.opt--selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.opt--correct-chosen { background: var(--ok-bg); border-color: var(--ok); }
.opt--wrong-chosen { background: var(--bad-bg); border-color: var(--bad); }
.opt--missed { border: 2px solid var(--ok); }
.opt__label { font-weight: 700; }
.opt__orig { color: var(--muted); font-size: 0.85em; }
.opt__badge { display: inline-block; margin-left: 8px; font-size: 0.8em; color: var(--ok); font-weight: 600; }

.btn-guide { margin-top: 12px; }
.guide { margin-top: 12px; padding: 16px; border-radius: var(--radius); background: var(--surface); border: 1px dashed var(--border); }
.guide h4 { margin: 0 0 8px; }
.guide h5 { margin: 14px 0 4px; }
.guide__answer { font-weight: 700; color: var(--ok); }
.guide__review { background: var(--warn-bg); color: var(--warn); padding: 8px; border-radius: 6px; }
.guide__pending { color: var(--muted); font-style: italic; }
.guide__options { padding-left: 18px; }
.guide__options li.is-right > strong { color: var(--ok); }
.guide__options li.is-wrong > strong { color: var(--bad); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); text-decoration: none; font-size: 0.85em; }

.navgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 6px; }
.navgrid__cell { padding: 6px 0; }
.navgrid__cell.is-answered { background: var(--ok-bg); }
.navgrid__cell.is-flagged { border-color: var(--warn); box-shadow: inset 0 0 0 2px var(--warn); }
.navgrid__cell.is-current { outline: 2px solid var(--primary); }

.dialog { position: fixed; inset: 0; background: rgb(0 0 0 / 0.45); display: grid; place-items: center; padding: 16px; z-index: 10; }
.dialog__box { background: var(--surface); border-radius: var(--radius); padding: 20px; max-width: 420px; width: 100%; }
.dialog__box .row { display: flex; justify-content: flex-end; gap: 8px; }

.score { font-size: 1.3em; }
.score--pass strong { color: var(--ok); }
.score--fail strong { color: var(--bad); }
.review-item { margin: 18px 0; }
.review-item__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.tag { font-size: 0.8em; padding: 2px 8px; border-radius: 999px; background: var(--border); }
.tag--ok { background: var(--ok-bg); color: var(--ok); }
.tag--bad { background: var(--bad-bg); color: var(--bad); }
.service-list, .related { padding-left: 18px; }
input[type='search'] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; }

@media (max-width: 600px) {
  .exam__actions { flex-wrap: wrap; }
  .bars__row { grid-template-columns: 90px 1fr 40px; }
}
```

- [ ] **Step 9: Chạy test, typecheck, build**

Run: `npx vitest run src/pages && npm run typecheck && npm run build`
Expected: 5 test PASS, typecheck sạch, build ra `dist/` không lỗi.

- [ ] **Step 10: Kiểm tra thủ công**

Run: `npm run dev` rồi mở URL mà Vite in ra. Kiểm tra:
- Có 7 thẻ đề, ô ESL được bật sẵn.
- Nút đổi theme hoạt động.
- Thu nhỏ trình duyệt tới khoảng 375px thì trang không bị cuộn ngang.

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "feat(ui): app shell, home page with set cards and per-set statistics page"
```

---

### Task 11: Màn hình làm bài (Thi thật + Thi thử)

**Files:**
- Create: `src/app/labels.ts`, `src/components/QuestionCard.tsx`, `src/components/GuidePanel.tsx`, `src/components/ServiceChip.tsx`, `src/components/NavGrid.tsx`, `src/components/Timer.tsx`, `src/pages/ExamPage.tsx`
- Modify: `src/app/routes.tsx` (thêm route `exam/:id`, và route tạm `result/:id`, Task 12 sẽ thay)
- Test: `src/pages/ExamPage.test.tsx`, `src/components/QuestionCard.test.tsx`

**Interfaces:**
- Consumes: `Attempt`, `isCompatible`, `displayLabel` (Task 7); `selectOption`, `toggleFlag`, `markGuideOpened`, `submitAttempt` (Task 7); `optionState` (Task 8); `remainingMs`, `formatClock` (Task 8); `useApp` (Task 9)
- Produces:
  - `EXAM_LABELS: Record<Mode, ExamLabels>`
  - `QuestionCard(props: { question: Question; order: string[]; selected: string[]; reveal: boolean; showOrigLabels?: boolean; chooseLabel?: string; heading?: string; onSelect?: (key: string) => void })`
  - `GuidePanel(props: { question: Question; order: string[]; vi?: QuestionVi; meta?: QuestionMeta; services: Map<string, ServiceRef> })`
  - `ServiceChip(props: { id: string; service?: ServiceRef })`
  - `NavGrid(props: { attempt: Attempt; current: number; onJump: (index: number) => void; label: string })`
  - `Timer(props: { endsAt: number; now: () => number; label: string; onExpire: () => void })`

- [ ] **Step 1: Viết test thất bại**

`src/components/QuestionCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { makeQuestion } from '../test/fixtures';
import { QuestionCard } from './QuestionCard';

describe('QuestionCard', () => {
  const q = makeQuestion(9, ['A', 'B', 'C', 'D', 'E'], ['A', 'C']);

  it('đánh nhãn theo thứ tự đã xáo, không lộ nhãn gốc khi không yêu cầu', () => {
    render(<QuestionCard question={q} order={['C', 'A', 'B', 'D', 'E']} selected={[]} reveal={false} />);
    expect(screen.getByText('Option C of 9').closest('button')).toHaveTextContent(/^A\./);
    expect(screen.queryByText(/gốc:/)).not.toBeInTheDocument();
  });

  it('khi mở đáp án: chọn đúng xanh, chọn sai đỏ, bỏ sót viền xanh', () => {
    render(<QuestionCard question={q} order={['A', 'B', 'C', 'D', 'E']} selected={['A', 'B']} reveal />);
    expect(screen.getByText('Option A of 9').closest('button')).toHaveClass('opt--correct-chosen');
    expect(screen.getByText('Option B of 9').closest('button')).toHaveClass('opt--wrong-chosen');
    expect(screen.getByText('Option C of 9').closest('button')).toHaveClass('opt--missed');
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument();
  });

  it('câu nhiều đáp án dùng role checkbox', () => {
    render(<QuestionCard question={q} order={['A', 'B', 'C', 'D', 'E']} selected={['B']} reveal={false} onSelect={() => {}} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getByRole('checkbox', { checked: true })).toHaveTextContent('Option B of 9');
  });
});
```

`src/pages/ExamPage.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react';
import { createAttempt, type Mode } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function setup(mode: Mode, patch: Record<string, unknown> = {}) {
  const deps = makeDeps();
  const attempt = {
    ...createAttempt({ id: 'e1', setId: 1, mode, esl: true, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }),
    ...patch,
  };
  deps.store.save(attempt);
  return { deps, attempt };
}

describe('ExamPage — Thi thật', () => {
  it('giao diện tiếng Anh, có đồng hồ, không có hướng dẫn', () => {
    const { deps } = setup('real');
    renderApp('/exam/e1', deps);
    expect(screen.getByText('Question 1 of 65')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Time remaining: 2:40:00');
    expect(screen.queryByRole('button', { name: 'Xem hướng dẫn' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hướng dẫn')).not.toBeInTheDocument();
  });

  it('chọn đáp án được lưu; render lại (tải lại trang) vẫn còn', () => {
    const { deps, attempt } = setup('real');
    const first = renderApp('/exam/e1', deps);
    fireEvent.click(first.container.querySelectorAll('.opt')[0]);
    const qid = attempt.questions[0].qid;
    expect(deps.store.get('e1')!.answers[qid]).toHaveLength(1);
    first.unmount();
    const second = renderApp('/exam/e1', deps);
    expect(second.container.querySelectorAll('.opt')[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('End exam → xác nhận → chuyển sang trang kết quả', () => {
    const { deps } = setup('real');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'End exam' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('65 unanswered, 0 flagged.');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end exam' }));
    expect(deps.store.get('e1')!.status).toBe('submitted');
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
  });

  it('hết giờ thì tự nộp', () => {
    const { deps } = setup('real', { endsAt: 1_000_000 - 1 });
    renderApp('/exam/e1', deps);
    expect(deps.store.get('e1')!.status).toBe('submitted');
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
  });

  it('chuyển câu bằng lưới và đánh dấu xem lại', () => {
    const { deps, attempt } = setup('real');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByText('Question 5 of 65')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Flag for review' }));
    expect(deps.store.get('e1')!.flagged).toEqual([attempt.questions[4].qid]);
  });
});

describe('ExamPage — Thi thử', () => {
  it('không có đồng hồ; mở hướng dẫn ngay tại câu và ghi nhận', () => {
    const { deps, attempt } = setup('practice');
    renderApp('/exam/e1', deps);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText('Câu 1/65')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }));
    expect(screen.getByLabelText('Hướng dẫn')).toBeInTheDocument();
    expect(deps.store.get('e1')!.guideOpened).toEqual([attempt.questions[0].qid]);
  });

  it('đề bài và lựa chọn vẫn bằng tiếng Anh', () => {
    const { deps, attempt } = setup('practice');
    renderApp('/exam/e1', deps);
    expect(screen.getByText(`Prompt ${attempt.questions[0].qid}?`)).toBeInTheDocument();
  });
});

describe('ExamPage — lỗi', () => {
  it('không tìm thấy lượt thi', () => {
    renderApp('/exam/khong-co', makeDeps());
    expect(screen.getByText(/Không tìm thấy lượt thi/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/pages/ExamPage.test.tsx src/components/QuestionCard.test.tsx`
Expected: FAIL, không resolve được `./QuestionCard`; route `/exam/:id` chưa tồn tại.

- [ ] **Step 3: Viết `src/app/labels.ts`**

```ts
import type { Mode } from '../engine/attempt';

export interface ExamLabels {
  question: (index: number, total: number) => string;
  flag: string;
  unflag: string;
  prev: string;
  next: string;
  end: string;
  timeRemaining: string;
  choose: (n: number) => string;
  confirmTitle: string;
  confirmBody: (unanswered: number, flagged: number) => string;
  confirm: string;
  cancel: string;
  guide: string;
  nav: string;
}

export const EXAM_LABELS: Record<Mode, ExamLabels> = {
  real: {
    question: (i, n) => `Question ${i} of ${n}`,
    flag: 'Flag for review',
    unflag: 'Unflag',
    prev: 'Previous',
    next: 'Next',
    end: 'End exam',
    timeRemaining: 'Time remaining',
    choose: (n) => `Choose ${n}.`,
    confirmTitle: 'End exam?',
    confirmBody: (u, f) => `${u} unanswered, ${f} flagged.`,
    confirm: 'Yes, end exam',
    cancel: 'Return to exam',
    guide: '',
    nav: 'Question navigation',
  },
  practice: {
    question: (i, n) => `Câu ${i}/${n}`,
    flag: 'Đánh dấu xem lại',
    unflag: 'Bỏ đánh dấu',
    prev: 'Câu trước',
    next: 'Câu sau',
    end: 'Nộp bài',
    timeRemaining: '',
    choose: (n) => `Chọn ${n} đáp án`,
    confirmTitle: 'Nộp bài?',
    confirmBody: (u, f) => `Còn ${u} câu chưa làm, ${f} câu đang đánh dấu.`,
    confirm: 'Xác nhận nộp',
    cancel: 'Làm tiếp',
    guide: 'Xem hướng dẫn',
    nav: 'Danh sách câu',
  },
};
```

- [ ] **Step 4: Viết `QuestionCard`, `ServiceChip`, `GuidePanel`**

`src/components/QuestionCard.tsx`:
```tsx
import type { Question } from '../data/types';
import { displayLabel } from '../engine/attempt';
import { optionState } from '../engine/review';

interface QuestionCardProps {
  question: Question;
  order: string[];
  selected: string[];
  reveal: boolean;
  showOrigLabels?: boolean;
  chooseLabel?: string;
  heading?: string;
  onSelect?: (key: string) => void;
}

export function QuestionCard({ question, order, selected, reveal, showOrigLabels, chooseLabel, heading, onSelect }: QuestionCardProps) {
  const byKey = new Map(question.options.map((o) => [o.key, o]));
  const multi = question.choose > 1;
  return (
    <section className="qcard" lang="en">
      {heading && <h3 className="qcard__heading">{heading}</h3>}
      {question.stem
        .split('\n\n')
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      <p className="qcard__prompt">
        <strong>{question.prompt}</strong>
      </p>
      {chooseLabel && <p className="qcard__choose">{chooseLabel}</p>}
      <ul className="qcard__options" role={multi ? 'group' : 'radiogroup'}>
        {order.map((key, i) => {
          const state = optionState(key, selected, question.answer, reveal);
          return (
            <li key={key}>
              <button
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={selected.includes(key)}
                className={`opt opt--${state}`}
                disabled={!onSelect}
                onClick={() => onSelect?.(key)}
              >
                <span className="opt__label">{displayLabel(i)}.</span> <span className="opt__text">{byKey.get(key)?.text}</span>
                {showOrigLabels && <span className="opt__orig"> (gốc: {key})</span>}
                {state === 'missed' && <span className="opt__badge">Đáp án đúng</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`src/components/ServiceChip.tsx`:
```tsx
import { Link } from 'react-router-dom';
import type { ServiceRef } from '../data/types';

export function ServiceChip({ id, service }: { id: string; service?: ServiceRef }) {
  return (
    <Link className="chip" to={`/services/${id}`}>
      {service?.name ?? id}
    </Link>
  );
}
```

`src/components/GuidePanel.tsx`:
```tsx
import type { Question, QuestionMeta, QuestionVi, ServiceRef } from '../data/types';
import { displayLabel } from '../engine/attempt';
import { ServiceChip } from './ServiceChip';

interface GuidePanelProps {
  question: Question;
  order: string[];
  vi?: QuestionVi;
  meta?: QuestionMeta;
  services: Map<string, ServiceRef>;
}

export function GuidePanel({ question, order, vi, meta, services }: GuidePanelProps) {
  const viByKey = new Map(vi?.options.map((o) => [o.key, o]) ?? []);
  const correctLabels = order.flatMap((key, i) => (question.answer.includes(key) ? [displayLabel(i)] : []));
  return (
    <aside className="guide" lang="vi" aria-label="Hướng dẫn">
      <h4>Hướng dẫn</h4>
      <p className="guide__answer">Đáp án đúng: {correctLabels.join(', ')}</p>
      {vi ? (
        <>
          {vi.review && <p className="guide__review">⚠ Cần xem lại đáp án gốc: {vi.review.reason}</p>}
          <h5>Bản dịch</h5>
          {vi.stemVi
            .split('\n\n')
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          <p>
            <strong>{vi.promptVi}</strong>
          </p>
          <ul className="guide__options">
            {order.map((key, i) => {
              const right = question.answer.includes(key);
              const option = viByKey.get(key);
              return (
                <li key={key} className={right ? 'is-right' : 'is-wrong'}>
                  <strong>
                    {displayLabel(i)}. {option?.textVi} — {right ? 'Đúng' : 'Sai'}
                  </strong>
                  <p>{option?.reason}</p>
                </li>
              );
            })}
          </ul>
          <h5>Giải thích</h5>
          <p>{vi.explanationVi}</p>
          <h5>Dấu hiệu nhận biết</h5>
          <p>{vi.keyHint}</p>
        </>
      ) : (
        <>
          <p className="guide__pending">Câu này chưa có bản dịch. Giải thích gốc (chữ cái theo nhãn gốc):</p>
          <p>{question.explanationOrig}</p>
        </>
      )}
      {meta && meta.services.length > 0 && (
        <>
          <h5>Service liên quan</h5>
          <div className="chips">
            {meta.services.map((id) => (
              <ServiceChip key={id} id={id} service={services.get(id)} />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 5: Viết `NavGrid`, `Timer`**

`src/components/NavGrid.tsx`:
```tsx
import type { Attempt } from '../engine/attempt';

export function NavGrid({ attempt, current, onJump, label }: { attempt: Attempt; current: number; onJump: (index: number) => void; label: string }) {
  return (
    <nav className="navgrid" aria-label={label}>
      {attempt.questions.map((q, i) => {
        const classes = ['navgrid__cell'];
        if ((attempt.answers[q.qid]?.length ?? 0) > 0) classes.push('is-answered');
        if (attempt.flagged.includes(q.qid)) classes.push('is-flagged');
        if (i === current) classes.push('is-current');
        return (
          <button key={q.qid} type="button" className={classes.join(' ')} aria-current={i === current ? 'step' : undefined} onClick={() => onJump(i)}>
            {i + 1}
          </button>
        );
      })}
    </nav>
  );
}
```

(Chú ý: NavGrid có thêm prop `label`. Ở ExamPage truyền `t.nav`.)

`src/components/Timer.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { formatClock, remainingMs } from '../engine/timer';

interface TimerProps {
  endsAt: number;
  now: () => number;
  label: string;
  onExpire: () => void;
}

export function Timer({ endsAt, now, label, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState(() => remainingMs(endsAt, now()));
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const tick = () => {
      const r = remainingMs(endsAt, now());
      setRemaining(r);
      if (r === 0) onExpireRef.current();
      return r === 0;
    };
    if (tick()) return;
    const handle = setInterval(() => {
      if (tick()) clearInterval(handle);
    }, 1000);
    return () => clearInterval(handle);
  }, [endsAt, now]);

  return (
    <span className={`timer${remaining < 5 * 60_000 ? ' timer--low' : ''}`} role="timer">
      {label}: {formatClock(remaining)}
    </span>
  );
}
```

- [ ] **Step 6: Viết `src/pages/ExamPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { EXAM_LABELS } from '../app/labels';
import { GuidePanel } from '../components/GuidePanel';
import { NavGrid } from '../components/NavGrid';
import { QuestionCard } from '../components/QuestionCard';
import { Timer } from '../components/Timer';
import { markGuideOpened, selectOption, submitAttempt, toggleFlag } from '../engine/actions';
import { isCompatible, type Attempt } from '../engine/attempt';

export function ExamPage() {
  const { id = '' } = useParams();
  const { bank, store, now } = useApp();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | undefined>(() => store.get(id));
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const update = useCallback(
    (next: Attempt) => {
      store.save(next);
      setAttempt(next);
    },
    [store],
  );

  useEffect(() => {
    if (attempt?.status === 'submitted') navigate(`/result/${attempt.id}`, { replace: true });
  }, [attempt, navigate]);

  if (!attempt || !isCompatible(attempt, bank.questions)) {
    return (
      <main className="page">
        <p>Không tìm thấy lượt thi này, hoặc dữ liệu đã thay đổi nên không mở được.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }

  const t = EXAM_LABELS[attempt.mode];
  const aq = attempt.questions[index];
  const question = bank.questions.get(aq.qid)!;
  const selected = attempt.answers[aq.qid] ?? [];
  const revealed = attempt.mode === 'practice' && attempt.guideOpened.includes(aq.qid);
  const flagged = attempt.flagged.includes(aq.qid);
  const unanswered = attempt.questions.filter((q) => !(attempt.answers[q.qid]?.length ?? 0)).length;
  const submit = () => update(submitAttempt(attempt, now()));

  return (
    <main className={`page exam exam--${attempt.mode}`} lang={attempt.mode === 'real' ? 'en' : 'vi'}>
      <header className="exam__bar">
        <strong>{t.question(index + 1, attempt.questions.length)}</strong>
        {attempt.mode === 'real' && attempt.endsAt !== undefined && (
          <Timer endsAt={attempt.endsAt} now={now} label={t.timeRemaining} onExpire={submit} />
        )}
        <button type="button" onClick={() => setConfirming(true)}>
          {t.end}
        </button>
      </header>

      <QuestionCard
        question={question}
        order={aq.optionOrder}
        selected={selected}
        reveal={revealed}
        showOrigLabels={revealed && !bank.vi.has(aq.qid)}
        chooseLabel={question.choose > 1 ? t.choose(question.choose) : undefined}
        onSelect={(key) => update(selectOption(attempt, aq.qid, key, question.choose))}
      />

      {attempt.mode === 'practice' &&
        (revealed ? (
          <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
        ) : (
          <button type="button" className="btn-guide" onClick={() => update(markGuideOpened(attempt, aq.qid))}>
            {t.guide}
          </button>
        ))}

      <div className="exam__actions">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t.prev}
        </button>
        <button type="button" aria-pressed={flagged} onClick={() => update(toggleFlag(attempt, aq.qid))}>
          {flagged ? t.unflag : t.flag}
        </button>
        <button type="button" disabled={index === attempt.questions.length - 1} onClick={() => setIndex(index + 1)}>
          {t.next}
        </button>
      </div>

      <NavGrid attempt={attempt} current={index} onJump={setIndex} label={t.nav} />

      {confirming && (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="dialog__box">
            <h2 id="confirm-title">{t.confirmTitle}</h2>
            <p>{t.confirmBody(unanswered, attempt.flagged.length)}</p>
            <div className="row">
              <button type="button" onClick={() => setConfirming(false)}>
                {t.cancel}
              </button>
              <button type="button" className="btn-primary" onClick={submit}>
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Thêm route vào `src/app/routes.tsx`**

Thêm import:
```tsx
import { ExamPage } from '../pages/ExamPage';
```
Thêm route vào trong `<Route element={<Layout />}>`, sau `set/:id`. Route `result/:id` chỉ là trang tạm, Task 12 sẽ thay:
```tsx
        <Route path="exam/:id" element={<ExamPage />} />
        <Route path="result/:id" element={<main className="page" data-testid="result-page" />} />
```

- [ ] **Step 8: Chạy test để xác nhận PASS**

Run: `npx vitest run src/pages/ExamPage.test.tsx src/components/QuestionCard.test.tsx`
Expected: 11 test PASS.

- [ ] **Step 9: Chạy toàn bộ test, typecheck và kiểm tra thủ công**

Run: `npm test && npm run typecheck`, rồi `npm run dev`. Kiểm tra:
- Thi thật: đồng hồ đếm lùi, giao diện tiếng Anh, lưới câu tô màu câu đã trả lời và câu đánh dấu. Tải lại trang vẫn giữ đáp án và thời gian.
- Thi thử: nút "Xem hướng dẫn" hiện giải thích gốc và nhãn "(gốc: X)".

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat(ui): exam screen for real (timed, English UI) and practice (inline guide) modes"
```

---

### Task 12: Trang kết quả và xem lại

**Files:**
- Create: `src/components/DomainTable.tsx`, `src/pages/ResultPage.tsx`
- Modify: `src/app/routes.tsx` (thay route tạm `result/:id`)
- Test: `src/pages/ResultPage.test.tsx`

**Interfaces:**
- Consumes: `scoreAttempt`, `PASS_SCORE`, `isCorrect`, `DomainScore` (Task 8); `filterReview`, `ReviewFilter` (Task 8); `WEAK_THRESHOLD` (Task 8); `QuestionCard`, `GuidePanel` (Task 11)
- Produces: `DomainTable(props: { byDomain: Record<Domain, DomainScore>; correct: number; total: number; onSelect: (d: Domain) => void })`; `ResultPage()` có `data-testid="result-page"` trên thẻ `<main>`

- [ ] **Step 1: Viết test thất bại**

`src/pages/ResultPage.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { submitAttempt } from '../engine/actions';
import type { Attempt } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function submitted(deps: ReturnType<typeof makeDeps>, mode: Attempt['mode'], answers: Record<number, string[]>, guideOpened: number[] = []): Attempt {
  const ids = deps.bank.sets.sets[0].questionIds;
  const attempt: Attempt = {
    id: 'r1',
    setId: 1,
    mode,
    seed: 1,
    esl: mode === 'real',
    startedAt: 0,
    endsAt: mode === 'real' ? 160 * 60_000 : undefined,
    questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
    answers,
    flagged: [3],
    guideOpened,
    status: 'in-progress',
  };
  const done = submitAttempt(attempt, 42 * 60_000);
  deps.store.save(done);
  return done;
}

describe('ResultPage', () => {
  it('hiện điểm, Đậu/Trượt, thời gian và bảng % theo domain', () => {
    const deps = makeDeps();
    const answers = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, i + 1 === 2 ? ['A', 'C'] : ['A']]));
    submitted(deps, 'real', answers);
    renderApp('/result/r1', deps);
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
    expect(screen.getByText(/377/)).toBeInTheDocument(); // round(100 + 900*20/65)
    expect(screen.getByText(/TRƯỢT/)).toBeInTheDocument();
    expect(screen.getByText(/42 phút \/ 160 phút \(ESL \+30\)/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /Secure/ })).toHaveTextContent('20/20');
    expect(within(table).getByRole('row', { name: /Secure/ })).toHaveTextContent('100%');
    expect(within(table).getByRole('row', { name: /Resilient/ })).toHaveTextContent('cần ôn');
  });

  it('xem lại: tô màu xanh/đỏ/viền xanh và mở hướng dẫn cho mọi câu', () => {
    const deps = makeDeps();
    submitted(deps, 'real', { 1: ['B'] });
    renderApp('/result/r1', deps);
    expect(screen.getByText('Option B of 1').closest('button')).toHaveClass('opt--wrong-chosen');
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(65);
    expect(screen.getByText('Giải thích tiếng Việt câu 1')).toBeInTheDocument();
  });

  it('lọc câu sai, câu đánh dấu, và theo domain khi bấm dòng trong bảng', () => {
    const deps = makeDeps();
    submitted(deps, 'real', { 1: ['A'] });
    renderApp('/result/r1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Câu sai' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(64);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(1);
    fireEvent.click(screen.getByRole('row', { name: /Cost-Optimized/ }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(13);
  });

  it('Thi thử: hiện số câu đúng khi chưa xem hướng dẫn', () => {
    const deps = makeDeps();
    submitted(deps, 'practice', { 1: ['A'], 4: ['A'] }, [4]);
    renderApp('/result/r1', deps);
    expect(screen.getByText('Đúng khi chưa xem hướng dẫn: 1/65')).toBeInTheDocument();
  });

  it('lượt chưa nộp thì chuyển về màn hình làm bài', () => {
    const deps = makeDeps();
    const a = submitted(deps, 'real', {});
    deps.store.save({ ...a, status: 'in-progress', submittedAt: undefined });
    renderApp('/result/r1', deps);
    expect(screen.getByText('Question 1 of 65')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/pages/ResultPage.test.tsx`
Expected: FAIL (trang kết quả tạm chưa có nội dung).

- [ ] **Step 3: Viết `src/components/DomainTable.tsx`**

```tsx
import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import type { DomainScore } from '../engine/scoring';
import { WEAK_THRESHOLD } from '../engine/stats';

interface DomainTableProps {
  byDomain: Record<Domain, DomainScore>;
  correct: number;
  total: number;
  onSelect: (d: Domain) => void;
}

export function DomainTable({ byDomain, correct, total, onSelect }: DomainTableProps) {
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Đúng / Số câu</th>
            <th>% đúng</th>
          </tr>
        </thead>
        <tbody>
          {DOMAINS.map((d) => {
            const s = byDomain[d];
            const weak = s.total > 0 && s.pct < WEAK_THRESHOLD;
            return (
              <tr key={d} className="is-clickable" onClick={() => onSelect(d)} aria-label={`${DOMAIN_SHORT[d]}: lọc câu hỏi theo domain này`}>
                <th scope="row">{DOMAIN_SHORT[d]}</th>
                <td>
                  {s.correct}/{s.total}
                </td>
                <td className={weak ? 'is-weak' : undefined}>
                  {s.pct}%{weak ? ' · cần ôn' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Tổng</th>
            <td>
              {correct}/{total}
            </td>
            <td>{total ? Math.round((100 * correct) / total) : 0}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Viết `src/pages/ResultPage.tsx`**

```tsx
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { formatDate, modeName } from '../app/format';
import { DomainTable } from '../components/DomainTable';
import { GuidePanel } from '../components/GuidePanel';
import { QuestionCard } from '../components/QuestionCard';
import { DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import { EXAM_MINUTES, ESL_EXTRA_MINUTES, isCompatible } from '../engine/attempt';
import { filterReview, type ReviewFilter } from '../engine/review';
import { PASS_SCORE, isCorrect, scoreAttempt } from '../engine/scoring';

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'wrong', label: 'Câu sai' },
  { value: 'flagged', label: 'Đánh dấu' },
  { value: 'guide', label: 'Đã xem hướng dẫn' },
];

export function ResultPage() {
  const { id = '' } = useParams();
  const { bank, store } = useApp();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const attempt = store.get(id);

  if (!attempt || !isCompatible(attempt, bank.questions)) {
    return (
      <main className="page" data-testid="result-page">
        <p>Không tìm thấy kết quả này.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }
  if (attempt.status !== 'submitted') return <Navigate to={`/exam/${attempt.id}`} replace />;

  const result = scoreAttempt(attempt, bank.questions);
  const usedMinutes = Math.round(((attempt.submittedAt ?? attempt.startedAt) - attempt.startedAt) / 60_000);
  const limit = EXAM_MINUTES + (attempt.esl ? ESL_EXTRA_MINUTES : 0);
  const items = filterReview(attempt, bank.questions, filter);
  const domainFilter = filter.startsWith('domain-') ? (Number(filter.slice(7)) as Domain) : null;

  return (
    <main className="page result" data-testid="result-page">
      <p>
        <Link to="/">← Danh sách đề</Link> · <Link to={`/set/${attempt.setId}`}>Thống kê Đề {attempt.setId}</Link>
      </p>
      <h1>
        Kết quả Đề {attempt.setId} ({modeName(attempt.mode)})
      </h1>
      <p className={`score ${result.passed ? 'score--pass' : 'score--fail'}`}>
        <strong>{result.score}</strong>/1000 · {result.passed ? 'ĐẬU' : 'TRƯỢT'} (cần ≥ {PASS_SCORE})
      </p>
      <p>
        Đúng {result.correct}/{result.total} câu · Thời gian làm bài: {usedMinutes} phút
        {attempt.mode === 'real' && ` / ${limit} phút${attempt.esl ? ' (ESL +30)' : ''}`} · Nộp lúc {formatDate(attempt.submittedAt!)}
      </p>
      {attempt.mode === 'practice' && (
        <p>
          Đúng khi chưa xem hướng dẫn: {result.correctWithoutGuide}/{result.total}
        </p>
      )}

      <h2>Theo domain</h2>
      <DomainTable byDomain={result.byDomain} correct={result.correct} total={result.total} onSelect={(d) => setFilter(`domain-${d}` as ReviewFilter)} />

      <h2>Xem lại bài làm</h2>
      <div className="filters" role="group" aria-label="Lọc câu hỏi">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
        {domainFilter && (
          <button type="button" aria-pressed="true" onClick={() => setFilter('all')}>
            Domain: {DOMAIN_SHORT[domainFilter]} ✕
          </button>
        )}
      </div>
      {items.length === 0 && <p>Không có câu nào trong bộ lọc này.</p>}
      {items.map(({ aq, index }) => {
        const question = bank.questions.get(aq.qid)!;
        const selected = attempt.answers[aq.qid] ?? [];
        const correct = isCorrect(selected, question.answer);
        return (
          <article key={aq.qid} className="review-item">
            <div className="review-item__tags">
              <span className={`tag ${correct ? 'tag--ok' : 'tag--bad'}`}>{correct ? 'Đúng' : 'Sai'}</span>
              {selected.length === 0 && <span className="tag">Chưa trả lời</span>}
              {attempt.flagged.includes(aq.qid) && <span className="tag">Đánh dấu</span>}
              {attempt.guideOpened.includes(aq.qid) && <span className="tag">Đã xem hướng dẫn</span>}
              <span className="tag">{DOMAIN_SHORT[aq.domain]}</span>
            </div>
            <QuestionCard heading={`Câu ${index + 1}`} question={question} order={aq.optionOrder} selected={selected} reveal showOrigLabels={!bank.vi.has(aq.qid)} />
            <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
          </article>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 5: Thay route tạm trong `src/app/routes.tsx`**

Thêm `import { ResultPage } from '../pages/ResultPage';`, rồi thay dòng
```tsx
        <Route path="result/:id" element={<main className="page" data-testid="result-page" />} />
```
bằng
```tsx
        <Route path="result/:id" element={<ResultPage />} />
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run src/pages`
Expected: toàn bộ test trong `src/pages` PASS (bao gồm cả test ExamPage chuyển sang trang kết quả).

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(ui): result page with domain breakdown, colored review and filters"
```

---

### Task 13: Xem riêng một câu và trang Service (bản khung)

**Files:**
- Create: `src/pages/QuestionViewPage.tsx`, `src/pages/ServicesPage.tsx`, `src/pages/ServiceDetailPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/ServicesPage.test.tsx`

**Interfaces:**
- Consumes: `Bank.questionsByService`, `Bank.services` (Task 9); `QuestionCard`, `GuidePanel` (Task 11); `SERVICE_CATEGORIES`, `DOMAIN_NAMES` (Task 1)
- Produces: route `/q/:id`, `/services`, `/services/:id`. Giai đoạn 3 sẽ mở rộng `ServiceDetailPage` để hiện ghi chú đầy đủ.

- [ ] **Step 1: Viết test thất bại**

`src/pages/ServicesPage.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

describe('Service pages', () => {
  it('liệt kê service theo danh mục, có tìm kiếm', () => {
    renderApp('/services', makeDeps());
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amazon S3' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm service'), { target: { value: 'dynamo' } });
    expect(screen.getByText('Không tìm thấy service nào.')).toBeInTheDocument();
  });

  it('trang chi tiết: trạng thái đang cập nhật và câu hỏi liên quan', () => {
    renderApp('/services/s3', makeDeps());
    expect(screen.getByRole('heading', { name: 'Amazon S3' })).toBeInTheDocument();
    expect(screen.getByText('Ghi chú chi tiết đang cập nhật.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Câu 1' }));
    expect(screen.getByRole('heading', { name: 'Câu 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hướng dẫn')).toBeInTheDocument();
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
  });

  it('service hoặc câu không tồn tại', () => {
    renderApp('/services/khong-co', makeDeps());
    expect(screen.getByText(/Không có service/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/pages/ServicesPage.test.tsx`
Expected: FAIL (route chưa có, rơi vào trang "Không tìm thấy trang").

- [ ] **Step 3: Viết ba trang**

`src/pages/QuestionViewPage.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuidePanel } from '../components/GuidePanel';
import { QuestionCard } from '../components/QuestionCard';
import { DOMAIN_NAMES } from '../data/constants';

export function QuestionViewPage() {
  const { id } = useParams();
  const qid = Number(id);
  const { bank } = useApp();
  const question = bank.questions.get(qid);
  if (!question) {
    return (
      <main className="page">
        <p>Không có câu {id}.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }
  const order = question.options.map((o) => o.key);
  const meta = bank.meta.get(qid);
  return (
    <main className="page">
      <h1>Câu {qid}</h1>
      {meta && (
        <p className="hint">
          Domain: {DOMAIN_NAMES[meta.domain]} · Độ khó: {meta.difficulty}/3
        </p>
      )}
      <QuestionCard question={question} order={order} selected={[]} reveal />
      <GuidePanel question={question} order={order} vi={bank.vi.get(qid)} meta={meta} services={bank.services} />
    </main>
  );
}
```

`src/pages/ServicesPage.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { SERVICE_CATEGORIES } from '../data/constants';

export function ServicesPage() {
  const { bank } = useApp();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = [...bank.services.values()].filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.includes(q));
  return (
    <main className="page">
      <h1>Ghi chú AWS service</h1>
      <input type="search" placeholder="Tìm service…" aria-label="Tìm service" value={query} onChange={(e) => setQuery(e.target.value)} />
      {SERVICE_CATEGORIES.map((category) => {
        const items = list.filter((s) => s.category === category).sort((a, b) => a.name.localeCompare(b.name));
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <h2>{category}</h2>
            <ul className="service-list">
              {items.map((s) => (
                <li key={s.id}>
                  <Link to={`/services/${s.id}`}>{s.name}</Link>{' '}
                  <span className="hint">({bank.questionsByService.get(s.id)?.length ?? 0} câu)</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {list.length === 0 && <p>Không tìm thấy service nào.</p>}
    </main>
  );
}
```

`src/pages/ServiceDetailPage.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';

export function ServiceDetailPage() {
  const { id = '' } = useParams();
  const { bank } = useApp();
  const service = bank.services.get(id);
  if (!service) {
    return (
      <main className="page">
        <p>Không có service “{id}”.</p>
        <Link to="/services">Danh sách service</Link>
      </main>
    );
  }
  const related = bank.questionsByService.get(id) ?? [];
  return (
    <main className="page">
      <p>
        <Link to="/services">← Danh sách service</Link>
      </p>
      <h1>{service.name}</h1>
      <p className="hint">{service.category}</p>
      <p className="guide__pending">Ghi chú chi tiết đang cập nhật.</p>
      <h2>Câu hỏi liên quan ({related.length})</h2>
      <ul className="related">
        {related.map((qid) => (
          <li key={qid}>
            <Link to={`/q/${qid}`}>Câu {qid}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Thêm route vào `src/app/routes.tsx`**

Thêm import:
```tsx
import { QuestionViewPage } from '../pages/QuestionViewPage';
import { ServiceDetailPage } from '../pages/ServiceDetailPage';
import { ServicesPage } from '../pages/ServicesPage';
```
Thêm route, đặt sau `result/:id`:
```tsx
        <Route path="q/:id" element={<QuestionViewPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npx vitest run src/pages/ServicesPage.test.tsx`
Expected: 3 test PASS.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(ui): single-question view and service list/detail skeleton pages"
```

---

### Task 14: Kiểm tra toàn bộ, build và cập nhật CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Chạy toàn bộ kiểm tra**

Run: `npm run check && npm run build`
Expected: validate `0 lỗi` (cảnh báo còn lại: `500 câu chưa có bản dịch tiếng Việt` và `N service chưa có ghi chú`), toàn bộ test PASS, typecheck sạch, build tạo `dist/`.

- [ ] **Step 2: Kiểm tra thủ công trên bản build**

Run: `npm run preview` rồi mở URL. Kiểm tra từng mục:
- Làm một đề Thi thử, trả lời vài câu, mở hướng dẫn một câu rồi nộp. Trang kết quả phải có bảng domain, câu tô màu và dòng "Đúng khi chưa xem hướng dẫn".
- Mở Thi thật: đồng hồ hiện 2:40:00. Tải lại trang: đáp án và thời gian còn nguyên.
- Mở `/set/1`: có lượt Thi thử vừa làm (khi bấm lọc Thi thử).
- Mở `/services`: có danh sách service theo danh mục. Bấm vào một service, rồi vào một câu liên quan.

- [ ] **Step 3: Cập nhật `CLAUDE.md`**

Thay đoạn đầu mục "Trạng thái dự án" (`Repo hiện **chưa có code**, chỉ có tài liệu nguồn. Mục tiêu: ...`) bằng:
```markdown
Web tĩnh luyện thi **AWS Certified Solutions Architect – Associate (SAA-C03)** từ ngân hàng câu hỏi trong `Question-Doc/`. Stack: **Vite + React + TypeScript + Vitest**, hash router, lưu trạng thái bằng `localStorage`. Giai đoạn 1 (dữ liệu + web lõi) đã xong; giai đoạn 2 là bản dịch `data/vi`, giai đoạn 3 là ghi chú service `data/services`.
```
Và xóa câu "Khi đã có code, bổ sung lệnh thực tế vào file này."

Thêm mục mới ngay sau "Trạng thái dự án":
```markdown
## Lệnh

- `npm run dev` — chạy web ở máy · `npm run build` — build ra `dist/` · `npm run preview` — xem bản build
- `npm test` — chạy toàn bộ test · một file: `npx vitest run src/engine/attempt.test.ts` · một test: `npx vitest run -t "tên test"`
- `npm run typecheck`
- `npm run parse` — `Question-Doc/` → `data/questions.json`
- `npm run sets` — `data/meta` → `data/sets.json` (tất định, seed 20260924; cần đủ meta cho 500 câu)
- `npm run validate` — kiểm tra toàn bộ dữ liệu (lỗi thì exit 1)
- `npm run check` — validate + test + typecheck; chạy trước khi commit

## Kiến trúc

- `scripts/` (chạy bằng tsx) sinh và kiểm tra dữ liệu; logic nằm trong `scripts/lib/*` dạng hàm thuần, có test.
- `data/`: `questions.json` và `sets.json` là file **sinh ra** (không sửa tay); `meta/`, `vi/`, `services/`, `service-registry.json` là nội dung **soạn tay**. Id service trong meta phải có trong `service-registry.json`.
- `src/engine/`: toàn bộ logic thi là hàm thuần, ngẫu nhiên luôn nhận seed: `attempt` (hoán đổi 10 câu với kho dự phòng + xáo trộn), `actions`, `scoring`, `review` (trạng thái màu của lựa chọn), `stats`, `timer`.
- Mỗi lượt thi (`Attempt`) lưu `optionOrder` theo **nhãn gốc**, và đáp án cũng lưu theo nhãn gốc. Nhãn hiển thị A/B/C chỉ tính lúc render (`displayLabel`). Đừng lưu nhãn hiển thị.
- UI lấy dữ liệu qua `useApp()` (`src/app/context.tsx`). Test UI dùng `makeDeps()`/`renderApp()` trong `src/test/fixtures.tsx`, với bank giả gồm 75 câu.
- `src/data/load.ts` nạp JSON bằng `import.meta.glob`, nên thêm file vào `data/meta` hay `data/vi` không cần sửa code.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document commands and architecture after phase 1"
```

- [ ] **Step 5: Báo cáo cho người dùng**

Báo lại:
- Số câu mỗi domain (từ Task 5 Step 6) và các cảnh báo bù domain nếu có (Task 6 Step 8).
- Các câu có đáp án đáng ngờ gặp phải khi phân loại, nếu có.
- Xác nhận `npm run check` và build đã chạy qua.
- Bước tiếp theo là giai đoạn 2: soạn bản dịch `data/vi` theo lô 25 câu.

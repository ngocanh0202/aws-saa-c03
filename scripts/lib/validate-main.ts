import { expandMainMetas } from '../../src/data/main-meta';
import type { MainFile, QuestionMeta } from '../../src/data/types';
import type { ValidationReport } from './validate';

export interface MainValidationInput {
  /** data/main.json đang có trong repo (null nếu chưa sinh). */
  main: MainFile | null;
  /** data/main.json sinh lại từ question-doc-main ngay lúc kiểm tra. */
  rebuilt: MainFile;
  metas: QuestionMeta[];
  registryIds: Set<string>;
}

export function validateMain(input: MainValidationInput): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { main, rebuilt } = input;
  if (rebuilt.questions.length === 0) return { errors, warnings };
  if (!main || JSON.stringify(main) !== JSON.stringify(rebuilt)) {
    errors.push('data/main.json không khớp question-doc-main: chạy npm run main');
    return { errors, warnings };
  }

  const ids = new Set(main.questions.map((q) => q.id));
  for (const s of main.sets) if (s.questionIds.length !== 65) warnings.push(`${s.title} (${s.file}) có ${s.questionIds.length} câu, không phải 65`);
  const seen = new Set<number>();
  for (const m of input.metas) {
    if (!ids.has(m.id)) errors.push(`main-meta: câu ${m.id} không có trong data/main.json`);
    if (seen.has(m.id)) errors.push(`main-meta: câu ${m.id} bị trùng`);
    seen.add(m.id);
    if (![1, 2, 3, 4].includes(m.domain)) errors.push(`main-meta: câu ${m.id} có domain ${m.domain} không hợp lệ`);
    if (![1, 2, 3].includes(m.difficulty)) errors.push(`main-meta: câu ${m.id} có difficulty ${m.difficulty} không hợp lệ`);
    for (const s of m.services) if (!input.registryIds.has(s)) errors.push(`main-meta: câu ${m.id} dùng service "${s}" không có trong registry`);
  }
  const covered = new Set(expandMainMetas(input.metas, main.twins).map((m) => m.id));
  const missing = main.questions.filter((q) => !covered.has(q.id)).map((q) => q.id);
  if (missing.length > 0) errors.push(`main-meta: thiếu meta cho ${missing.length} câu (đầu tiên: ${missing.slice(0, 5).join(', ')})`);
  return { errors, warnings };
}

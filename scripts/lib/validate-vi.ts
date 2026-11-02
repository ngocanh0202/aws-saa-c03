import type { Question, QuestionVi } from '../../src/data/types';

export interface ViReport {
  errors: string[];
  warnings: string[];
}

const OPT = '[A-F]';
const START = '(?<![\\p{L}\\p{N}])';
const END = '(?![\\p{L}\\p{N}])';

// Chữ cái in hoa A–F đứng riêng, đi sau từ chỉ lựa chọn, đi thành cặp, nằm trong ngoặc, hoặc đứng đầu dòng.
const LETTER_PATTERNS: RegExp[] = [
  new RegExp(`(?:[Đđ]áp án|[Pp]hương án|[Ll]ựa chọn|[Cc]họn|[Cc]âu|[Oo]ptions?|[Cc]hoices?|[Aa]nswers?)\\s+${OPT}${END}`, 'u'),
  new RegExp(`${START}${OPT}\\s*(?:,|và|hoặc|/|&|or|and)\\s*${OPT}${END}`, 'u'),
  new RegExp(`\\(\\s*${OPT}\\s*\\)`, 'u'),
  new RegExp(`(?:^|\\n)\\s*${OPT}[.):]\\s`, 'u'),
];

export function hasLetterRef(text: string): boolean {
  return LETTER_PATTERNS.some((re) => re.test(text));
}

function blank(s: string | undefined): boolean {
  return !s || s.trim() === '';
}

export function validateVi(
  questions: Question[],
  vis: QuestionVi[],
  duplicates: [number, number][] = [],
): ViReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const viById = new Map<number, QuestionVi>();

  for (const v of vis) {
    if (viById.has(v.id)) errors.push(`vi: câu ${v.id} bị trùng`);
    viById.set(v.id, v);
    const q = byId.get(v.id);
    if (!q) {
      errors.push(`vi: câu ${v.id} không tồn tại`);
      continue;
    }
    const origKeys = q.options.map((o) => o.key).sort().join(',');
    const viKeys = v.options.map((o) => o.key).sort().join(',');
    if (origKeys !== viKeys) errors.push(`vi: câu ${v.id} có key lựa chọn không khớp bản gốc`);

    const missing: string[] = [];
    if (q.stem.trim() !== '' && blank(v.stemVi)) missing.push('stemVi');
    if (blank(v.promptVi)) missing.push('promptVi');
    if (blank(v.explanationVi)) missing.push('explanationVi');
    if (blank(v.keyHint)) missing.push('keyHint');
    for (const o of v.options) {
      if (blank(o.textVi)) missing.push(`textVi của ${o.key}`);
      if (blank(o.reason)) missing.push(`reason của ${o.key}`);
    }
    if (missing.length > 0) errors.push(`vi: câu ${v.id} thiếu nội dung: ${missing.join(', ')}`);

    if (v.review && blank(v.review.reason)) errors.push(`vi: câu ${v.id} có review nhưng thiếu lý do`);
    const texts = [v.explanationVi, v.keyHint, v.review?.reason, ...v.options.map((o) => o.reason)];
    if (texts.some((t) => hasLetterRef(t ?? '')))
      errors.push(`vi: câu ${v.id} nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)`);
    if (v.review && !blank(v.review.reason)) warnings.push(`vi: câu ${v.id} được gắn cờ review: ${v.review.reason}`);
  }

  for (const [a, b] of duplicates) {
    const va = viById.get(a);
    const vb = viById.get(b);
    if (va && vb && JSON.stringify({ ...va, id: 0 }) !== JSON.stringify({ ...vb, id: 0 }))
      errors.push(`vi: câu ${a} và ${b} trùng nhau nhưng bản dịch khác nhau`);
  }

  const missingVi = questions.filter((q) => !viById.has(q.id)).length;
  if (missingVi > 0) warnings.push(`${missingVi} câu chưa có bản dịch tiếng Việt`);
  return { errors, warnings };
}

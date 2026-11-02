import type { MainSet, Question } from '../../src/data/types';
import { htmlToText } from '../../src/data/html-text';

export { htmlToText };

/** Một câu trong `question-doc-main/*.json` (giữ nguyên, không sửa file gốc). */
export interface MainRawQuestion {
  question: string;
  options: string[];
  correctAnswerIndices: number[];
  explanation: string;
}

/** pt1_1, pt1_2, …, pt6_2 → Main 1 … Main 12, theo thứ tự (phần, nửa). */
export function sortMainFiles(files: string[]): string[] {
  const key = (f: string) => (f.match(/\d+/g) ?? []).map(Number);
  return [...files].sort((a, b) => {
    const [a1 = 0, a2 = 0] = key(a);
    const [b1 = 0, b2 = 0] = key(b);
    return a1 - b1 || a2 - b2 || a.localeCompare(b);
  });
}

export const MAIN_SET_BASE = 100;

/** Id câu main: setId * 100 + vị trí (1-based). Main 1 → 10101…10165. */
export function mainQuestionId(setId: number, position: number): number {
  return setId * 100 + position;
}

export function buildMainSet(file: string, index: number, raw: MainRawQuestion[]): { set: MainSet; questions: Question[] } {
  const setId = MAIN_SET_BASE + index + 1;
  const questions = raw.map((q, i) => ({
    id: mainQuestionId(setId, i + 1),
    stem: q.question,
    prompt: '',
    options: q.options.map((text, k) => ({ key: String.fromCharCode(65 + k), text })),
    answer: q.correctAnswerIndices.map((k) => String.fromCharCode(65 + k)),
    choose: q.correctAnswerIndices.length,
    explanationOrig: q.explanation,
    html: true,
  }));
  return {
    set: { id: setId, file, title: `Main ${index + 1}`, questionIds: questions.map((q) => q.id) },
    questions,
  };
}

/**
 * Cặp câu trùng nguyên văn (cùng đề, cùng tập lựa chọn, bất kể thứ tự) giữa các file main:
 * [câu xuất hiện trước, câu sau]. Câu sau dùng lại meta của câu trước (xem expandMainMetas).
 */
export function findMainTwins(questions: Question[]): [number, number][] {
  const norm = (html: string) => htmlToText(html).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const first = new Map<string, number>();
  const twins: [number, number][] = [];
  for (const q of questions) {
    const key = `${norm(q.stem)}|${q.options.map((o) => norm(o.text)).sort().join('|')}`;
    const prev = first.get(key);
    if (prev === undefined) first.set(key, q.id);
    else twins.push([prev, q.id]);
  }
  return twins;
}

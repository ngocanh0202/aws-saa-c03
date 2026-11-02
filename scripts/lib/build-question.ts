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

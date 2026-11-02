import type { Question, QuestionMeta } from '../../src/data/types';

export const BATCH_SIZE = 25;

const pad = (n: number) => String(n).padStart(3, '0');

export function batchRange(start: number, size = BATCH_SIZE): { start: number; end: number; file: string } {
  const end = start + size - 1;
  return { start, end, file: `q${pad(start)}-${pad(end)}.json` };
}

export function twinSource(id: number, duplicates: [number, number][]): number | undefined {
  for (const [a, b] of duplicates) {
    if (b === id && a < b) return a;
    if (a === id && b < a) return b;
  }
  return undefined;
}

export function formatBatch(
  questions: Question[],
  metas: QuestionMeta[],
  duplicates: [number, number][],
  start: number,
  end: number,
): string {
  const metaById = new Map(metas.map((m) => [m.id, m]));
  return questions
    .filter((q) => q.id >= start && q.id <= end)
    .sort((a, b) => a.id - b.id)
    .map((q) => {
      const m = metaById.get(q.id);
      const lines = [
        `=== Câu ${q.id} · domain ${m?.domain ?? '?'} · độ khó ${m?.difficulty ?? '?'} · chọn ${q.choose} · đáp án: ${q.answer.join(', ')} ===`,
      ];
      if (m) lines.push(`services: ${m.services.join(', ')}`);
      const twin = twinSource(q.id, duplicates);
      if (twin !== undefined) lines.push(`TRÙNG với câu ${twin}: chép nguyên bản dịch của câu ${twin}, chỉ đổi id.`);
      lines.push('STEM:', q.stem.trim() === '' ? '(trống)' : q.stem, `PROMPT: ${q.prompt}`);
      for (const o of q.options) lines.push(`${o.key}. ${o.text}`);
      lines.push(`GIẢI THÍCH GỐC: ${q.explanationOrig}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

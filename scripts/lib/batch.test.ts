import type { Question, QuestionMeta } from '../../src/data/types';
import { batchRange, formatBatch, twinSource } from './batch';

function q(id: number, stem = `Stem ${id}`): Question {
  return {
    id,
    stem,
    prompt: `Which ${id}? (Choose two.)`,
    options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: `Opt ${key}${id}` })),
    answer: ['A', 'C'],
    choose: 2,
    explanationOrig: `Orig ${id}`,
  };
}

describe('batchRange', () => {
  it('tính cuối lô và tên file', () => {
    expect(batchRange(1)).toEqual({ start: 1, end: 25, file: 'q001-025.json' });
    expect(batchRange(26)).toEqual({ start: 26, end: 50, file: 'q026-050.json' });
    expect(batchRange(476)).toEqual({ start: 476, end: 500, file: 'q476-500.json' });
  });
});

describe('twinSource', () => {
  it('chỉ trả về câu trùng có số nhỏ hơn', () => {
    const dup: [number, number][] = [[159, 218]];
    expect(twinSource(218, dup)).toBe(159);
    expect(twinSource(159, dup)).toBeUndefined();
    expect(twinSource(5, dup)).toBeUndefined();
  });
});

describe('formatBatch', () => {
  const metas: QuestionMeta[] = [{ id: 2, domain: 3, difficulty: 2, services: ['s3', 'athena'] }];
  const out = formatBatch([q(3, ''), q(1), q(2)], metas, [[1, 2]], 2, 3);

  it('chỉ in các câu trong lô, theo thứ tự id', () => {
    expect(out).not.toContain('Câu 1 ');
    expect(out.indexOf('=== Câu 2 ')).toBeLessThan(out.indexOf('=== Câu 3 '));
  });

  it('in tiêu đề, services, đề, câu hỏi, lựa chọn và giải thích gốc', () => {
    expect(out).toContain('=== Câu 2 · domain 3 · độ khó 2 · chọn 2 · đáp án: A, C ===');
    expect(out).toContain('services: s3, athena');
    expect(out).toContain('PROMPT: Which 2? (Choose two.)');
    expect(out).toContain('E. Opt E2');
    expect(out).toContain('GIẢI THÍCH GỐC: Orig 2');
  });

  it('nhắc chép bản dịch của câu trùng và ghi rõ đề trống', () => {
    expect(out).toContain('TRÙNG với câu 1: chép nguyên bản dịch của câu 1, chỉ đổi id.');
    expect(out).toContain('=== Câu 3 · domain ? · độ khó ? · chọn 2 · đáp án: A, C ===\nSTEM:\n(trống)');
  });
});

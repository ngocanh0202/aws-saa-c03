import { describe, expect, it } from 'vitest';
import { makeMainQuestion, makeQuestion } from '../test/fixtures';
import type { QuestionVi } from '../data/types';
import { buildSystemPrompt, normalizeHistory, trimHistory } from './prompt';
import type { ChatMessage } from './types';

describe('buildSystemPrompt', () => {
  it('dùng nhãn theo thứ tự hiển thị', () => {
    const p = buildSystemPrompt(makeQuestion(1, ['A', 'B', 'C', 'D'], ['B']), ['C', 'A', 'B', 'D'], { revealed: true });
    expect(p).toContain('A. Option C of 1');
    expect(p).toContain('C. Option B of 1');
    expect(p).toContain('Đáp án đúng: C');
  });

  it('câu nhiều đáp án liệt kê đủ nhãn', () => {
    const p = buildSystemPrompt(makeQuestion(2, ['A', 'B', 'C', 'D'], ['A', 'D']), ['D', 'C', 'B', 'A'], { revealed: true });
    expect(p).toContain('Đáp án đúng: A, D');
  });

  it('câu main chuyển HTML sang chữ', () => {
    const p = buildSystemPrompt(makeMainQuestion(10101), ['A', 'B', 'C', 'D']);
    expect(p).toContain('Main stem 10101');
    expect(p).not.toContain('<p>');
  });

  it('có chỉ dẫn trả lời tiếng Việt', () => {
    expect(buildSystemPrompt(makeQuestion(1), ['A', 'B', 'C', 'D'])).toContain('tiếng Việt');
  });

  it('tắt tìm trên web: không dặn tra cứu web, chỉ trả lời theo kiến thức sẵn có', () => {
    const p = buildSystemPrompt(makeQuestion(1), ['A', 'B', 'C', 'D'], { webSearch: false });
    expect(p).not.toContain('link nguồn');
    expect(p).toContain('Không tra cứu web');
    expect(p).toContain('không bịa link');
  });

  it('cho hỏi ngoài câu đang làm; cần thông tin mới thì dùng tool tìm kiếm và dẫn link, không bịa link', () => {
    const p = buildSystemPrompt(makeQuestion(1), ['A', 'B', 'C', 'D']);
    expect(p).toContain('ngoài câu đang làm');
    expect(p).toContain('thông tin mới nhất');
    expect(p).toContain('link nguồn');
    expect(p).toContain('không bịa link');
  });

  it('dặn không dùng LaTeX', () => {
    expect(buildSystemPrompt(makeQuestion(1), ['A', 'B', 'C', 'D'])).toContain('Không dùng LaTeX');
  });

  it('có chỉ dẫn dùng tool tìm câu', () => {
    const p = buildSystemPrompt(makeQuestion(1), ['A', 'B', 'C', 'D']);
    expect(p).toContain('find_answered_questions');
    expect(p).toContain('Bạn chưa làm câu nào như vậy trong đề này.');
  });
});

const VI: QuestionVi = {
  id: 1,
  stemVi: 'Đề tiếng Việt',
  promptVi: 'Hỏi gì?',
  options: [
    { key: 'A', textVi: 'Lựa chọn A', reason: 'Lý do A sai' },
    { key: 'B', textVi: 'Lựa chọn B', reason: 'Lý do B đúng' },
    { key: 'C', textVi: 'Lựa chọn C', reason: 'Lý do C sai' },
    { key: 'D', textVi: 'Lựa chọn D', reason: 'Lý do D sai' },
  ],
  explanationVi: 'Giải thích chung',
  keyHint: 'Từ khóa: rẻ nhất',
  review: { reason: 'Nghi đáp án lỗi thời' },
};

describe('buildSystemPrompt: đối chiếu và mở hướng dẫn', () => {
  const q = makeQuestion(1, ['A', 'B', 'C', 'D'], ['B']);

  it('có giải thích tiếng Việt theo nhãn hiển thị, ghi chú và cờ review', () => {
    const p = buildSystemPrompt(q, ['C', 'A', 'B', 'D'], { vi: VI, note: 'Đáp án đáng ngờ', revealed: true });
    expect(p).toContain('Giải thích tiếng Việt');
    expect(p).toContain('C. Lý do B đúng');
    expect(p).toContain('A. Lý do C sai');
    expect(p).toContain('Giải thích chung');
    expect(p).toContain('Từ khóa: rẻ nhất');
    expect(p).toContain('Nghi đáp án lỗi thời');
    expect(p).toContain('Đáp án đáng ngờ');
  });

  it('không có giải thích tiếng Việt thì bỏ mục đó', () => {
    expect(buildSystemPrompt(q, ['A', 'B', 'C', 'D'], { revealed: true })).not.toContain('Giải thích tiếng Việt');
  });

  it('chưa xem hướng dẫn: prompt không có đáp án, giải thích, ghi chú review', () => {
    const p = buildSystemPrompt(q, ['A', 'B', 'C', 'D'], { vi: VI, note: 'NOTE-X', revealed: false });
    expect(p).not.toContain('Đáp án đúng');
    expect(p).not.toContain(VI.explanationVi);
    expect(p).not.toContain(VI.keyHint!);
    expect(p).not.toContain(VI.options[0].reason);
    expect(p).not.toContain('NOTE-X');
    expect(p).not.toContain('open_guide');
    expect(p).toContain('Xem hướng dẫn');
  });

  it('đã xem: vẫn có đáp án và giải thích như cũ', () => {
    const p = buildSystemPrompt(q, ['A', 'B', 'C', 'D'], { vi: VI, revealed: true });
    expect(p).toContain('Đáp án đúng');
    expect(p).toContain(VI.explanationVi);
    expect(p).toContain('đã thấy đáp án');
  });

  it('dặn câu tìm được có answerHidden thì không nói đáp án', () => {
    expect(buildSystemPrompt(q, ['A', 'B', 'C', 'D'], { revealed: true })).toContain('answerHidden');
  });
});

describe('trimHistory', () => {
  const msgs = (n: number): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: `m${i + 1}` }));

  it('giữ 40 tin gần nhất', () => {
    const out = trimHistory(msgs(45));
    expect(out).toHaveLength(40);
    expect(out[0].text).toBe('m6');
    expect(trimHistory(msgs(3))).toEqual(msgs(3));
  });
});

describe('normalizeHistory', () => {
  const u = (text: string): ChatMessage => ({ role: 'user', text });
  const m = (text: string): ChatMessage => ({ role: 'model', text });

  it('hai tin user liền nhau: giữ tin sau', () => {
    expect(normalizeHistory([u('a'), u('b'), m('c')])).toEqual([u('b'), m('c')]);
  });

  it('bỏ tin model đứng đầu', () => {
    expect(normalizeHistory([m('x'), u('a'), m('b')])).toEqual([u('a'), m('b')]);
  });

  it('hai tin model liền nhau: giữ tin sau', () => {
    expect(normalizeHistory([u('a'), m('b'), m('c')])).toEqual([u('a'), m('c')]);
  });

  it('bỏ tin user cuối chưa có trả lời', () => {
    expect(normalizeHistory([u('a'), m('b'), u('c')])).toEqual([u('a'), m('b')]);
  });

  it('xen kẽ đúng thì giữ nguyên', () => {
    const msgs = [u('a'), m('b'), u('c'), m('d')];
    expect(normalizeHistory(msgs)).toEqual(msgs);
  });
});

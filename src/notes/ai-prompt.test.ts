import { describe, expect, it } from 'vitest';
import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';
import { makeMainQuestion, makeQuestion } from '../test/fixtures';
import { NOTE_AI_UNCLEAR, buildNotePrompt } from './ai-prompt';

const htmlToTextIfNeeded = (q: Question, s: string) => (q.html ? htmlToText(s) : s);

describe('buildNotePrompt', () => {
  it('có đề, câu hỏi, các lựa chọn, đoạn tô và chuỗi "không rõ"; không có đáp án hay giải thích', () => {
    const q = { ...makeQuestion(2, ['A', 'B', 'C', 'D', 'E'], ['A', 'C']), explanationOrig: 'Giải thích gốc bí mật' };
    const p = buildNotePrompt(q, 'LEAST operational overhead');
    expect(p).toContain('LEAST operational overhead');
    expect(p).toContain(htmlToTextIfNeeded(q, q.stem));
    expect(p).toContain(q.prompt);
    for (const o of q.options) expect(p).toContain(o.text);
    expect(p).not.toMatch(/Đáp án đúng/i);
    expect(p).not.toContain(q.explanationOrig);
    expect(p).toContain(NOTE_AI_UNCLEAR);
    expect(p).toContain('tiếng Việt');
  });

  it('không gắn nhãn A/B/C cho lựa chọn', () => {
    const q = makeQuestion(1);
    const p = buildNotePrompt(q, 'Stem');
    for (const o of q.options) {
      expect(p).not.toContain(`${o.key}. ${o.text}`);
      expect(p).toContain(`- ${o.text}`);
    }
  });

  it('ghi chú trống: không có mục "Ghi chú hiện có", giữ yêu cầu giải thích đoạn tô', () => {
    const p = buildNotePrompt(makeQuestion(1), 'Stem', '   ');
    expect(p).not.toContain('Ghi chú hiện có');
    expect(p).toContain('đoạn đã tô nghĩa là gì');
  });

  it('ghi chú đã có: đưa vào prompt kèm cách xử lý câu hỏi và nội dung đã viết', () => {
    const p = buildNotePrompt(makeQuestion(1), 'Stem', 'Sao lại là managed service?');
    expect(p).toContain('Ghi chú hiện có');
    expect(p).toContain('"""Sao lại là managed service?"""');
    // Có câu hỏi thì trả lời câu hỏi; chỉ là nội dung thì bổ sung, không lặp lại.
    expect(p).toMatch(/câu hỏi.*trả lời/i);
    expect(p).toMatch(/không lặp lại/i);
    // Xin đáp án trong ghi chú: vẫn không nói, nhắc bấm "Xem hướng dẫn".
    expect(p).toContain('Xem hướng dẫn');
    expect(p).not.toMatch(/Đáp án đúng/i);
  });

  it('câu main chuyển HTML sang chữ', () => {
    const q = makeMainQuestion(10101);
    const p = buildNotePrompt(q, 'Main');
    expect(p).toContain(htmlToTextIfNeeded(q, q.stem));
    for (const o of q.options) expect(p).toContain(htmlToText(o.text));
    expect(p).not.toContain('<p>');
    expect(p).not.toContain(htmlToText(q.explanationOrig));
  });
});

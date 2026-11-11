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

  it('câu main chuyển HTML sang chữ', () => {
    const q = makeMainQuestion(10101);
    const p = buildNotePrompt(q, 'Main');
    expect(p).toContain(htmlToTextIfNeeded(q, q.stem));
    for (const o of q.options) expect(p).toContain(htmlToText(o.text));
    expect(p).not.toContain('<p>');
    expect(p).not.toContain(htmlToText(q.explanationOrig));
  });
});

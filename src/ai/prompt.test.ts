import { describe, expect, it } from 'vitest';
import { makeMainQuestion, makeQuestion } from '../test/fixtures';
import { buildSystemPrompt, normalizeHistory, trimHistory } from './prompt';
import type { ChatMessage } from './types';

describe('buildSystemPrompt', () => {
  it('dùng nhãn theo thứ tự hiển thị', () => {
    const p = buildSystemPrompt(makeQuestion(1, ['A', 'B', 'C', 'D'], ['B']), ['C', 'A', 'B', 'D']);
    expect(p).toContain('A. Option C of 1');
    expect(p).toContain('C. Option B of 1');
    expect(p).toContain('Đáp án đúng: C');
  });

  it('câu nhiều đáp án liệt kê đủ nhãn', () => {
    const p = buildSystemPrompt(makeQuestion(2, ['A', 'B', 'C', 'D'], ['A', 'D']), ['D', 'C', 'B', 'A']);
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

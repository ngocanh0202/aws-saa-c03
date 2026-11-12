import { describe, expect, it } from 'vitest';
import { ITEM_CONTENT_MAX, NOTE_MAX, TITLE_MAX, addHighlight, addItem, findItem, fitsLimit, locate, mergeNotes, removeHighlight, removeItem, setNote, updateItem, type Highlight, type QuestionNotes } from './model';

const empty = (): QuestionNotes => ({ qid: 5, highlights: [], updatedAt: 0 });
const hl = (over: Partial<Highlight> = {}): Highlight => ({
  id: 'h', part: 'stem', start: 0, end: 3, text: 'abc', note: '', updatedAt: 1, ...over,
});
const TEXT = 'abcdefghijklmnopqrstuvwxyz';

describe('addHighlight', () => {
  it('thêm đoạn mới', () => {
    const r = addHighlight(empty(), { part: 'stem', start: 2, end: 5, text: 'x' }, TEXT, 'n1', 10);
    expect(r.id).toBe('n1');
    expect(r.notes.updatedAt).toBe(10);
    expect(r.notes.highlights).toEqual([{ id: 'n1', part: 'stem', start: 2, end: 5, text: 'cde', note: '', updatedAt: 10 }]);
  });
  it('gộp hai đoạn chồng, nối note', () => {
    let n: QuestionNotes = { ...empty(), highlights: [hl({ id: 'a', start: 0, end: 5, text: 'abcde', note: 'a' }), hl({ id: 'b', start: 8, end: 12, text: 'ijkl', note: 'b' })] };
    const r = addHighlight(n, { part: 'stem', start: 4, end: 9, text: '' }, TEXT, 'new', 20);
    expect(r.id).toBe('a');
    expect(r.notes.highlights).toHaveLength(1);
    expect(r.notes.highlights[0]).toMatchObject({ id: 'a', start: 0, end: 12, text: TEXT.slice(0, 12), note: 'a\n\nb', updatedAt: 20 });
  });
  it('đoạn chạm nhau cũng gộp', () => {
    const n: QuestionNotes = { ...empty(), highlights: [hl({ id: 'a', start: 0, end: 3 })] };
    const r = addHighlight(n, { part: 'stem', start: 3, end: 6, text: '' }, TEXT, 'x', 1);
    expect(r.notes.highlights).toHaveLength(1);
    expect(r.notes.highlights[0]).toMatchObject({ start: 0, end: 6 });
  });
  it('khác part không gộp', () => {
    const n: QuestionNotes = { ...empty(), highlights: [hl({ id: 'a' })] };
    const r = addHighlight(n, { part: 'prompt', start: 0, end: 3, text: '' }, TEXT, 'x', 1);
    expect(r.notes.highlights).toHaveLength(2);
    expect(r.id).toBe('x');
  });
  it('note gộp bị cắt NOTE_MAX', () => {
    const n: QuestionNotes = { ...empty(), highlights: [hl({ id: 'a', note: 'a'.repeat(NOTE_MAX) }), hl({ id: 'b', start: 2, end: 6, note: 'b' })] };
    const r = addHighlight(n, { part: 'stem', start: 1, end: 4, text: '' }, TEXT, 'x', 1);
    expect(r.notes.highlights[0].note).toHaveLength(NOTE_MAX);
  });
});

describe('setNote / removeHighlight', () => {
  const n: QuestionNotes = { ...empty(), highlights: [hl({ id: 'a' }), hl({ id: 'b', start: 10, end: 13 })] };
  it('setNote cắt NOTE_MAX', () => {
    const r = setNote(n, 'a', 'x'.repeat(NOTE_MAX + 5), 9);
    expect(r.highlights[0].note).toHaveLength(NOTE_MAX);
    expect(r.highlights[0].updatedAt).toBe(9);
    expect(r.updatedAt).toBe(9);
    expect(r.highlights[1]).toBe(n.highlights[1]);
  });
  it('removeHighlight', () => {
    const r = removeHighlight(n, 'a', 9);
    expect(r.highlights.map((h) => h.id)).toEqual(['b']);
    expect(r.updatedAt).toBe(9);
  });
});

describe('locate', () => {
  it('đúng chỗ thì giữ', () => {
    expect(locate(hl({ start: 2, end: 5, text: 'cde' }), TEXT)).toEqual({ start: 2, end: 5 });
  });
  it('lệch thì chọn lần gần nhất', () => {
    const t = 'xx cat yy cat zz';
    expect(locate(hl({ start: 8, end: 11, text: 'cat' }), t)).toEqual({ start: 10, end: 13 });
    expect(locate(hl({ start: 0, end: 3, text: 'cat' }), t)).toEqual({ start: 3, end: 6 });
  });
  it('không thấy thì null', () => {
    expect(locate(hl({ text: 'zzz9' }), TEXT)).toBeNull();
  });
});

describe('mergeNotes', () => {
  const a: QuestionNotes = { qid: 1, highlights: [], updatedAt: 5 };
  it('updatedAt lớn hơn thắng', () => {
    expect(mergeNotes(a, { ...a, updatedAt: 6 })).toBe('remote');
    expect(mergeNotes({ ...a, updatedAt: 7 }, a)).toBe('local');
    expect(mergeNotes(undefined, a)).toBe('remote');
    expect(mergeNotes(a, undefined)).toBe('local');
  });
  it('bằng nhau: khác nội dung thì remote, giống thì same', () => {
    expect(mergeNotes(a, { ...a, highlights: [hl()] })).toBe('remote');
    expect(mergeNotes(a, { ...a })).toBe('same');
  });
});

describe('NoteItem', () => {
  const base: QuestionNotes = { qid: 5, highlights: [], updatedAt: 1 };

  it('addItem: tạo bản ghi nếu chưa có, cắt tiêu đề 200 / nội dung 10 000, trim tiêu đề, giữ highlights', () => {
    const n = addItem(undefined, 5, { kind: 'manual', title: `  ${'t'.repeat(250)}`, content: 'c'.repeat(10_050) }, 'm1', 9);
    expect(n.qid).toBe(5);
    expect(n.items![0]).toMatchObject({ id: 'm1', kind: 'manual', createdAt: 9, updatedAt: 9 });
    expect(n.items![0].title).toHaveLength(TITLE_MAX);
    expect(n.items![0].content).toHaveLength(ITEM_CONTENT_MAX);
    const withHl = { ...base, highlights: [{ id: 'h', part: 'stem' as const, start: 0, end: 1, text: 'S', note: '', updatedAt: 1 }] };
    expect(addItem(withHl, 5, { kind: 'ai', title: 'Q', content: 'A' }, 'a1', 2).highlights).toHaveLength(1);
  });

  it('updateItem / removeItem đổi updatedAt; findItem theo nguồn + tiêu đề + nội dung', () => {
    const n = addItem(base, 5, { kind: 'ai', title: 'Q', content: 'A' }, 'a1', 2);
    expect(findItem(n, 'ai', 'Q', 'A')?.id).toBe('a1');
    expect(findItem(n, 'manual', 'Q', 'A')).toBeUndefined();
    const u = updateItem(n, 'a1', { content: 'B' }, 3);
    expect(u.items![0]).toMatchObject({ title: 'Q', content: 'B', updatedAt: 3, createdAt: 2 });
    expect(u.updatedAt).toBe(3);
    const r = removeItem(u, 'a1', 4);
    expect(r.items).toEqual([]);
    expect(r.updatedAt).toBe(4);
  });

  it('fitsLimit: quá 90 000 ký tự JSON thì false', () => {
    let n = base;
    expect(fitsLimit(n)).toBe(true);
    for (let i = 0; i < 10; i++) n = addItem(n, 5, { kind: 'manual', title: 'T', content: 'x'.repeat(ITEM_CONTENT_MAX) }, `m${i}`, 1);
    expect(fitsLimit(n)).toBe(false);
  });
});

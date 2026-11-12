import { describe, expect, it } from 'vitest';
import { addHighlight, type QuestionNotes } from '../notes/model';
import { partText } from '../notes/part-text';
import { createNotesStore } from '../notes/store';
import { makeMainQuestion, makeQuestion, memoryStorage } from '../test/fixtures';
import { createHighlightTool, findPhrase, highlightPhrases } from './highlight-tool';

const question = {
  ...makeQuestion(7),
  stem: 'A company needs the LEAST operational overhead solution within 1 hour.',
  prompt: 'Which solution is MOST cost-effective?',
};

let n = 0;
const newId = () => `id${++n}`;

describe('findPhrase', () => {
  it('không phân biệt hoa/thường, khoảng trắng liên tiếp coi như một', () => {
    expect(findPhrase('Least  Operational\noverhead x', 'least operational overhead')).toEqual({ start: 0, end: 27 });
  });

  it('không có thì null; cụm rỗng thì null', () => {
    expect(findPhrase('abc', 'xyz')).toBeNull();
    expect(findPhrase('abc', '   ')).toBeNull();
  });

  it('ký tự đặc biệt của regex được hiểu là chữ thường', () => {
    expect(findPhrase('cost (USD) + 1.5x', 'cost (usd) + 1.5x')).toEqual({ start: 0, end: 17 });
  });
});

describe('highlightPhrases', () => {
  it('tô cụm trong đề: part stem, note rỗng, text lấy từ đề', () => {
    const r = highlightPhrases(undefined, question, 7, ['least operational overhead'], newId, 100);
    expect(r.highlighted).toEqual(['least operational overhead']);
    const h = r.notes.highlights[0];
    expect(h).toMatchObject({ part: 'stem', note: '', text: 'LEAST operational overhead', updatedAt: 100 });
    expect(r.notes).toMatchObject({ qid: 7, updatedAt: 100 });
  });

  it('cụm chỉ có trong dòng câu hỏi → part prompt', () => {
    const r = highlightPhrases(undefined, question, 7, ['MOST cost-effective'], newId, 100);
    expect(r.notes.highlights[0]).toMatchObject({ part: 'prompt', text: 'MOST cost-effective' });
  });

  it('chồng lên đoạn đã tô → bỏ qua, đoạn cũ giữ nguyên', () => {
    const base = addHighlight({ qid: 7, highlights: [], updatedAt: 1 }, { part: 'stem', start: 2, end: 9, text: 'company' }, question.stem, 'mine', 1).notes;
    const seeded: QuestionNotes = { ...base, highlights: base.highlights.map((h) => ({ ...h, note: 'của tôi' })) };
    const r = highlightPhrases(seeded, question, 7, ['A company needs'], newId, 100);
    expect(r.skipped).toEqual(['A company needs']);
    expect(r.highlighted).toEqual([]);
    expect(r.notes.highlights).toEqual(seeded.highlights);
  });

  it('cụm chạm sát đoạn đã tô cũng bỏ qua (không bị gộp)', () => {
    const base = addHighlight({ qid: 7, highlights: [], updatedAt: 1 }, { part: 'stem', start: 2, end: 8, text: 'compan' }, question.stem, 'mine', 1).notes;
    const r = highlightPhrases(base, question, 7, ['y needs'], newId, 100);
    expect(r.skipped).toEqual(['y needs']);
    expect(r.notes.highlights).toEqual(base.highlights);
  });

  it('hai cụm chồng nhau trong cùng lần gọi → cụm sau bị bỏ', () => {
    const r = highlightPhrases(undefined, question, 7, ['operational overhead', 'LEAST operational'], newId, 100);
    expect(r.highlighted).toEqual(['operational overhead']);
    expect(r.skipped).toEqual(['LEAST operational']);
    expect(r.notes.highlights).toHaveLength(1);
  });

  it('không tìm thấy → notFound', () => {
    const r = highlightPhrases(undefined, question, 7, ['Amazon S3'], newId, 100);
    expect(r.notFound).toEqual(['Amazon S3']);
    expect(r.notes.highlights).toEqual([]);
  });

  it('câu main (HTML): offset khớp textContent', () => {
    const q = makeMainQuestion(10101);
    const r = highlightPhrases(undefined, q, 10101, ['stem 10101'], newId, 100);
    const h = r.notes.highlights[0];
    expect(partText(q, 'stem').slice(h.start, h.end)).toBe(h.text);
    expect(h.text).toBe('stem 10101');
  });
});

describe('createHighlightTool', () => {
  function setup(open = true) {
    const notes = createNotesStore(memoryStorage());
    const tool = createHighlightTool({ notes, isOpen: () => open, question, canonicalQid: 3, newId, now: () => 500 });
    return { notes, tool };
  }

  it('tô và lưu theo canonical id', async () => {
    const { notes, tool } = setup();
    const res = (await tool.run({ phrases: 'within 1 hour\nAmazon S3' })) as { highlighted: string[]; notFound: string[] };
    expect(res.highlighted).toEqual(['within 1 hour']);
    expect(res.notFound).toEqual(['Amazon S3']);
    expect(notes.get(3)!.highlights[0]).toMatchObject({ text: 'within 1 hour', note: '' });
  });

  it('không còn ở Thi thử đang làm → báo lỗi, không ghi', async () => {
    const { notes, tool } = setup(false);
    const res = (await tool.run({ phrases: 'within 1 hour' })) as { error?: string };
    expect(res.error).toBeTruthy();
    expect(notes.get(3)).toBeUndefined();
  });

  it('chỉ xét 8 cụm đầu, bỏ cụm rỗng và cụm dài quá 120 ký tự', async () => {
    const { tool } = setup();
    const lines = ['x'.repeat(121), '', ...Array.from({ length: 10 }, (_, i) => `missing${i}`)];
    const res = (await tool.run({ phrases: lines.join('\n') })) as { notFound: string[]; highlighted: string[] };
    // Chỉ tìm 8 cụm đầu; cụm quá dài hay vượt số tối đa cũng báo là không tô.
    expect(res.notFound).toEqual([...Array.from({ length: 8 }, (_, i) => `missing${i}`), 'x'.repeat(121), 'missing8', 'missing9']);
    expect(res.highlighted).toEqual([]);
  });

  it('không tô được cụm nào → không lưu', async () => {
    const { notes, tool } = setup();
    await tool.run({ phrases: 'Amazon S3' });
    expect(notes.get(3)).toBeUndefined();
  });
});

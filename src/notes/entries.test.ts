import { describe, expect, it } from 'vitest';
import { makeBank, memoryStorage } from '../test/fixtures';
import { groupEntries, matchesEntry, noteLabel, noteSetId, sortEntries, toEntries, type NoteEntry } from './entries';
import type { QuestionNotes } from './model';
import { createNotesStore } from './store';

const { sets } = makeBank();

const hl = (id: string, text: string, note: string, updatedAt: number) => ({ id, part: 'stem' as const, start: 0, end: text.length, text, note, updatedAt });

const notes: QuestionNotes[] = [
  { qid: 3, updatedAt: 30, highlights: [hl('h1', 'Stem 3', 'ghi chú 3', 30), hl('h2', 'Stem', '  ', 31)] },
  // Bản cũ không có items.
  { qid: 70, updatedAt: 20, highlights: [hl('h3', 'Stem 70', 'dự phòng', 20)] },
  {
    qid: 10101,
    updatedAt: 50,
    highlights: [],
    items: [
      { id: 'a1', kind: 'ai', title: 'Tại sao?', content: 'Vì **S3**', createdAt: 40, updatedAt: 40 },
      { id: 'm1', kind: 'manual', title: 'Nhớ', content: 'Multi-AZ', createdAt: 50, updatedAt: 50 },
    ],
  },
];

const entries = toEntries(notes);
const titles = (es: NoteEntry[]) => es.map((e) => e.title);

describe('toEntries', () => {
  it('đoạn tô chỉ khi có ghi chú; đọc cả item và bản không có items', () => {
    expect(titles(entries)).toEqual(['Stem 3', 'Stem 70', 'Tại sao?', 'Nhớ']);
    expect(entries.map((e) => e.source)).toEqual(['highlight', 'highlight', 'ai', 'manual']);
    expect(entries[0]).toMatchObject({ key: '3:h1', qid: 3, id: 'h1', content: 'ghi chú 3', updatedAt: 30 });
  });
});

describe('noteSetId / noteLabel', () => {
  it('câu trong đề, câu dự phòng, câu main', () => {
    expect(noteSetId(3, sets)).toBe(1);
    expect(noteSetId(70, sets)).toBeNull();
    expect(noteSetId(10101, sets)).toBe(101);
    expect(noteLabel(3, sets)).toBe('Đề 1 · Câu 3');
    expect(noteLabel(70, sets)).toBe('Kho dự phòng · Câu 70');
    expect(noteLabel(10101, sets)).toBe('Main 1 · Câu 1');
  });
});

describe('sortEntries', () => {
  it('mới nhất, cũ nhất, theo đề & số câu', () => {
    expect(titles(sortEntries(entries, 'newest', sets))).toEqual(['Nhớ', 'Tại sao?', 'Stem 3', 'Stem 70']);
    expect(titles(sortEntries(entries, 'oldest', sets))).toEqual(['Stem 70', 'Stem 3', 'Tại sao?', 'Nhớ']);
    expect(titles(sortEntries(entries, 'question', sets))).toEqual(['Stem 3', 'Nhớ', 'Tại sao?', 'Stem 70']);
  });
});

describe('groupEntries', () => {
  const sorted = sortEntries(entries, 'newest', sets);

  it('không gộp → []', () => {
    expect(groupEntries(sorted, [], sets)).toEqual([]);
  });

  it('gộp theo câu hỏi mà không cần gộp theo đề', () => {
    const g = groupEntries(sorted, ['question'], sets);
    expect(g.map((x) => [x.label, x.count])).toEqual([
      ['Main 1 · Câu 1', 2],
      ['Đề 1 · Câu 3', 1],
      ['Kho dự phòng · Câu 70', 1],
    ]);
    expect(titles(g[0].entries!)).toEqual(['Nhớ', 'Tại sao?']);
    expect(g[0].groups).toBeUndefined();
  });

  it('nguồn rồi đề: hai tầng, tầng ngoài là nguồn', () => {
    const g = groupEntries(sorted, ['source', 'set'], sets);
    expect(g.map((x) => [x.label, x.count])).toEqual([
      ['Tự ghi chú', 1],
      ['Câu trả lời AI', 1],
      ['Tô đề', 2],
    ]);
    const highlight = g[2];
    expect(highlight.entries).toBeUndefined();
    expect(highlight.groups!.map((x) => [x.label, x.count])).toEqual([
      ['Đề 1', 1],
      ['Kho dự phòng', 1],
    ]);
    expect(titles(highlight.groups![0].entries!)).toEqual(['Stem 3']);
  });
});

describe('matchesEntry', () => {
  it('không dấu, theo tiêu đề, nội dung và nhãn câu', () => {
    const find = (q: string) => titles(entries.filter((e) => matchesEntry(e, q, sets)));
    expect(find('tai sao')).toEqual(['Tại sao?']);
    expect(find('multi az')).toEqual(['Nhớ']);
    expect(find('kho du phong')).toEqual(['Stem 70']);
    expect(find('')).toHaveLength(4);
  });
});

describe('store.list với items', () => {
  it('bản chỉ có item (không đoạn tô) vẫn được liệt kê', () => {
    const store = createNotesStore(memoryStorage());
    store.save({ qid: 9, highlights: [], items: [{ id: 'x', kind: 'manual', title: 'T', content: '', createdAt: 1, updatedAt: 1 }], updatedAt: 1 });
    store.save({ qid: 8, highlights: [], updatedAt: 2 });
    expect(store.list().map((n) => n.qid)).toEqual([9]);
  });
});

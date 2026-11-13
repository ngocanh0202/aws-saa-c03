import { describe, expect, it } from 'vitest';
import type { NoteEntry } from './entries';
import { buildDeck } from './flashcards';

const e = (id: string, content: string): NoteEntry => ({ key: `1:${id}`, qid: 1, source: 'manual', id, title: `T ${id}`, content, updatedAt: 1 });

describe('buildDeck', () => {
  it('bỏ ghi chú không có nội dung (lật ra không có gì để ôn)', () => {
    const deck = buildDeck([e('a', 'x'), e('b', '   '), e('c', 'y')], () => 0.5);
    expect(deck.map((d) => d.id).sort()).toEqual(['a', 'c']);
  });

  it('xáo ngẫu nhiên theo rand (Fisher–Yates), không mất hay lặp thẻ', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => e(id, id));
    const seq = [0.1, 0.9, 0.3, 0.7];
    let i = 0;
    const deck = buildDeck(items, () => seq[i++ % seq.length]);
    expect(deck.map((d) => d.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(deck.map((d) => d.id)).not.toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('không đổi mảng đầu vào', () => {
    const items = [e('a', 'x'), e('b', 'y')];
    buildDeck(items, () => 0);
    expect(items.map((d) => d.id)).toEqual(['a', 'b']);
  });
});

import type { NoteEntry } from './entries';

/**
 * Bộ thẻ ôn: chỉ ghi chú có nội dung (mặt sau), xáo ngẫu nhiên kiểu Fisher–Yates. Không đổi mảng đầu vào.
 * `rand` trả số trong [0, 1).
 */
export function buildDeck(entries: NoteEntry[], rand: () => number = Math.random): NoteEntry[] {
  const deck = entries.filter((e) => e.content.trim() !== '');
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

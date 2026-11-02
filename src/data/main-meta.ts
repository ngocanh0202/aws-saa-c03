import type { QuestionMeta } from './types';

/**
 * Nội dung main (meta, hướng dẫn tiếng Việt) chỉ soạn cho câu gốc; câu trùng nguyên văn ở file sau
 * (xem `twins` trong data/main.json) dùng lại bản của câu gốc, đổi id. Không ghi đè bản đã có riêng.
 */
export function expandTwins<T extends { id: number }>(items: T[], twins: [number, number][]): T[] {
  const byId = new Map(items.map((m) => [m.id, m]));
  const copies = twins.flatMap(([orig, twin]) => {
    const m = byId.get(orig);
    return m && !byId.has(twin) ? [{ ...m, id: twin }] : [];
  });
  return [...items, ...copies];
}

export function expandMainMetas(metas: QuestionMeta[], twins: [number, number][]): QuestionMeta[] {
  return expandTwins(metas, twins);
}

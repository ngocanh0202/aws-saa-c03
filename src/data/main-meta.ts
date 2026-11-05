import type { MainSet, QuestionMeta } from './types';

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

/**
 * Đề main mà mọi câu đều là câu trùng (vế sau của `twins`) của câu ở đề khác, ví dụ ptX_2 chỉ là
 * ptX_1 xáo lại. Đề này bị ẩn khỏi trang chủ; vẫn giữ trong bank để lượt thi cũ xem được.
 */
export function duplicateMainSetIds(sets: MainSet[], twins: [number, number][]): Set<number> {
  const twinIds = new Set(twins.map(([, twin]) => twin));
  return new Set(sets.filter((s) => s.questionIds.length > 0 && s.questionIds.every((id) => twinIds.has(id))).map((s) => s.id));
}

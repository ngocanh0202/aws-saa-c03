import type { QuestionMeta } from './types';

/**
 * Meta bộ main chỉ soạn cho câu gốc; câu trùng nguyên văn ở file sau (xem `twins` trong
 * data/main.json) dùng lại meta của câu gốc, đổi id.
 */
export function expandMainMetas(metas: QuestionMeta[], twins: [number, number][]): QuestionMeta[] {
  const byId = new Map(metas.map((m) => [m.id, m]));
  const copies = twins.flatMap(([orig, twin]) => {
    const m = byId.get(orig);
    return m && !byId.has(twin) ? [{ ...m, id: twin }] : [];
  });
  return [...metas, ...copies];
}

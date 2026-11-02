import { submitAttempt } from '../engine/actions';
import type { Attempt } from '../engine/attempt';
import type { AttemptStore } from './storage';

const isExpiredReal = (a: Attempt, now: number): boolean =>
  a.mode === 'real' && a.status === 'in-progress' && a.endsAt !== undefined && a.endsAt <= now;

/** Dùng khi render: như finalizeExpiredRealAttempts nhưng chỉ tính ra danh sách, không lưu (save gọi listener, cấm trong render). */
export function viewFinalized(attempts: Attempt[], now: number): Attempt[] {
  return attempts.map((a) => (isExpiredReal(a, now) ? submitAttempt(a, now) : a));
}

/**
 * Một lượt Thi thật hết giờ (`endsAt` đã qua) mà không ai mở lại /exam/:id sẽ mãi ở
 * trạng thái 'in-progress' — Timer chỉ tự nộp khi trang đang mở. Gọi hàm này trước khi
 * liệt kê/thống kê lượt thi (Home, SetStats) để các lượt đó hiện ra như đã nộp, với
 * submittedAt chốt ở endsAt (xem submitAttempt).
 */
export function finalizeExpiredRealAttempts(store: AttemptStore, now: number): void {
  for (const attempt of store.list()) {
    if (isExpiredReal(attempt, now)) store.save(submitAttempt(attempt, now));
  }
}

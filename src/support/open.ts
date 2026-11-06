import { makeErrorReport, type ErrorReport } from './model';

/** Yêu cầu mở khung hỗ trợ, có thể kèm báo lỗi điền sẵn. */
export type SupportRequest = { error?: ErrorReport };

const listeners = new Set<(req: SupportRequest) => void>();

/** Mở khung hỗ trợ (từ bất kỳ đâu trong UI). */
export function openSupport(req: SupportRequest = {}): void {
  for (const l of [...listeners]) l(req);
}

/** Khung hỗ trợ đăng ký nghe; trả về hàm hủy. */
export function onOpenSupport(listener: (req: SupportRequest) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Báo lỗi gắn với trang hiện tại và giờ hiện tại. */
export function errorReportHere(input: { message: string; code?: string }): ErrorReport {
  return makeErrorReport(input, location.hash || '#/', Date.now());
}

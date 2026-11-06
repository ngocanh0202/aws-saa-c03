import { makeErrorReport, type ErrorReport } from './model';

/** Yêu cầu mở khung hỗ trợ, có thể kèm báo lỗi điền sẵn. */
export type SupportRequest = { error?: ErrorReport };

const listeners = new Set<(req: SupportRequest) => void>();

/** Mở khung hỗ trợ (từ bất kỳ đâu trong UI). */
export function openSupport(req: SupportRequest = {}): void {
  for (const l of [...listeners]) l(req);
}

/** Yêu cầu chờ mở sau khi đăng nhập (chưa đăng nhập thì chưa có khung hỗ trợ nào nghe). */
const PENDING_MS = 2 * 60_000;
let pending: { req: SupportRequest; at: number } | null = null;

/** Chưa đăng nhập: giữ yêu cầu, khung hỗ trợ mở ngay khi đăng nhập xong (quá 2 phút thì bỏ). */
export function openSupportAfterSignIn(req: SupportRequest = {}): void {
  pending = { req, at: Date.now() };
}

/** Khung hỗ trợ đăng ký nghe (lúc vừa đăng nhập thì nhận luôn yêu cầu đang chờ); trả về hàm hủy. */
export function onOpenSupport(listener: (req: SupportRequest) => void): () => void {
  listeners.add(listener);
  const waiting = pending;
  pending = null;
  if (waiting && Date.now() - waiting.at <= PENDING_MS) listener(waiting.req);
  return () => void listeners.delete(listener);
}

const signInListeners = new Set<() => void>();

/** Nhờ menu tài khoản mở popup đăng nhập (vd từ nút "Liên hệ admin" khi chưa đăng nhập). */
export function requestSignIn(): void {
  for (const l of [...signInListeners]) l();
}

export function onRequestSignIn(listener: () => void): () => void {
  signInListeners.add(listener);
  return () => void signInListeners.delete(listener);
}

/** Báo lỗi gắn với trang hiện tại và giờ hiện tại. */
export function errorReportHere(input: { message: string; code?: string }): ErrorReport {
  return makeErrorReport(input, location.hash || '#/', Date.now());
}

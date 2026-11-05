import { ADMIN_EMAIL } from './admin';

export interface ErrorReport {
  message: string;
  code?: string;
  page: string;
  at: number;
}

export interface SupportMessage {
  id: string;
  from: 'user' | 'admin';
  text: string;
  at: number;
  error?: ErrorReport;
}

export interface SupportThread {
  uid: string;
  name: string;
  email?: string;
  updatedAt: number;
  last: string;
  lastFrom: 'user' | 'admin';
  unreadByAdmin: boolean;
  unreadByUser: boolean;
}

/** Giới hạn độ dài (ký tự) của từng trường. */
export const LIMITS = {
  text: 4000,
  errorMessage: 1000,
  errorCode: 100,
  page: 500,
  name: 100,
  email: 200,
  last: 80,
};

/** Dựng báo cáo lỗi, cắt theo LIMITS, bỏ code rỗng. */
export function makeErrorReport(
  input: { message: string; code?: string },
  page: string,
  at: number,
): ErrorReport {
  const report: ErrorReport = {
    message: input.message.slice(0, LIMITS.errorMessage),
    page: page.slice(0, LIMITS.page),
    at,
  };
  if (input.code) report.code = input.code.slice(0, LIMITS.errorCode);
  return report;
}

function clip(s: string): string {
  return s.length > LIMITS.last ? `${s.slice(0, LIMITS.last)}…` : s;
}

/** Dòng xem trước của cuộc trò chuyện: gộp khoảng trắng, cắt ≤ 80 ký tự. */
export function lastText(text: string, error?: ErrorReport): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t && error) return clip(`⚠ ${error.message.replace(/\s+/g, ' ').trim()}`);
  return clip(t);
}

/** Link mailto tới admin, kèm thông tin lỗi (nếu có). */
export function mailtoHref(error?: ErrorReport): string {
  const subject = encodeURIComponent('Lỗi trên web luyện thi SAA-C03');
  const lines: string[] = [];
  if (error) {
    lines.push(`Lỗi: ${error.message}`);
    if (error.code) lines.push(`Mã: ${error.code}`);
    lines.push(`Trang: ${error.page}`);
    lines.push(`Lúc: ${new Date(error.at).toISOString()}`);
  }
  return `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${encodeURIComponent(lines.join('\n'))}`;
}

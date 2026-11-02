import type { Mode } from '../engine/attempt';

export interface ExamLabels {
  question: (index: number, total: number) => string;
  flag: string;
  unflag: string;
  prev: string;
  next: string;
  end: string;
  timeRemaining: string;
  choose: (n: number) => string;
  confirmTitle: string;
  confirmBody: (unanswered: number, flagged: number) => string;
  confirm: string;
  cancel: string;
  guide: string;
  nav: string;
  /** Khung bên trái (danh sách câu + nút điều hướng); trên điện thoại mở bằng nút nổi. */
  panel: string;
  openPanel: string;
  closePanel: string;
  progress: (answered: number, total: number, flagged: number) => string;
}

export const EXAM_LABELS: Record<Mode, ExamLabels> = {
  real: {
    question: (i, n) => `Question ${i} of ${n}`,
    flag: 'Flag for review',
    unflag: 'Unflag',
    prev: 'Previous',
    next: 'Next',
    end: 'End exam',
    timeRemaining: 'Time remaining',
    choose: (n) => `Choose ${n}.`,
    confirmTitle: 'End exam?',
    confirmBody: (u, f) => `${u} unanswered, ${f} flagged.`,
    confirm: 'Yes, end exam',
    cancel: 'Return to exam',
    guide: '',
    nav: 'Question navigation',
    panel: 'Exam panel',
    openPanel: 'Show questions',
    closePanel: 'Close',
    progress: (a, n, f) => `${a}/${n} answered · ${f} flagged`,
  },
  practice: {
    question: (i, n) => `Câu ${i}/${n}`,
    flag: 'Đánh dấu xem lại',
    unflag: 'Bỏ đánh dấu',
    prev: 'Câu trước',
    next: 'Câu sau',
    end: 'Nộp bài',
    timeRemaining: '',
    choose: (n) => `Chọn ${n} đáp án`,
    confirmTitle: 'Nộp bài?',
    confirmBody: (u, f) => `Còn ${u} câu chưa làm, ${f} câu đang đánh dấu.`,
    confirm: 'Xác nhận nộp',
    cancel: 'Làm tiếp',
    guide: 'Xem hướng dẫn',
    nav: 'Danh sách câu',
    panel: 'Bảng điều khiển bài thi',
    openPanel: 'Hiện danh sách câu',
    closePanel: 'Đóng',
    progress: (a, n, f) => `Đã làm ${a}/${n} · đánh dấu ${f}`,
  },
};

import { useSyncExternalStore } from 'react';
import { useApp } from '../app/context';

export type AiJobTarget =
  | { page: 'attempt'; attemptId: string; qid: number; highlightId?: string } // chat (không highlightId) hoặc ghi chú trong lượt thi
  | { page: 'notes'; qid: number; highlightId: string }; // ghi chú soạn từ trang #/notes

/** label: "Câu 12" hoặc "Main 1 · Câu 5". */
export interface AiJob {
  /** form: AI hỗ trợ viết trong form ghi chú (không báo toast). */
  kind: 'chat' | 'note' | 'form';
  label: string;
  target: AiJobTarget;
}

export class AiGateBusyError extends Error {
  constructor() {
    super('AI đang bận với yêu cầu khác');
    this.name = 'AiGateBusyError';
  }
}

/**
 * Mỗi tab chỉ chạy một yêu cầu AI tại một thời điểm (chat hoặc soạn ghi chú). Giữ trong bộ nhớ,
 * không đồng bộ giữa tab/máy.
 */
export interface AiGate {
  current(): AiJob | null;
  /** Bận thì ném AiGateBusyError ngay, không chạy fn. Xong (resolve/reject) thì nhả và báo onFinished. */
  run<T>(job: AiJob, fn: () => Promise<T>): Promise<T>;
  subscribe(listener: () => void): () => void;
  onFinished(cb: (job: AiJob, ok: boolean) => void): () => void;
  /** Chỗ người học đang nhìn (khung chat/ popup đang mở); null khi đóng. */
  setViewing(key: string | null): void;
  viewing(): string | null;
  /** Yêu cầu mở sau khi điều hướng; nơi đích gọi take() với key của mình. */
  requestOpen(target: AiJobTarget): void;
  takeOpen(match: (t: AiJobTarget) => boolean): AiJobTarget | null;
  /** Xem yêu cầu mở đang chờ mà không xóa (ExamPage/ResultPage dùng để nhảy tới câu). */
  peekOpen(): AiJobTarget | null;
}

/** 'attempt:<id>:<qid>' | 'attempt:<id>:<qid>:<hl>' | 'notes:<qid>:<hl>'. */
export function targetKey(t: AiJobTarget): string {
  if (t.page === 'notes') return `notes:${t.qid}:${t.highlightId}`;
  return t.highlightId ? `attempt:${t.attemptId}:${t.qid}:${t.highlightId}` : `attempt:${t.attemptId}:${t.qid}`;
}

export function createAiGate(): AiGate {
  let job: AiJob | null = null;
  let viewingKey: string | null = null;
  let pending: AiJobTarget | null = null;
  const listeners = new Set<() => void>();
  const finished = new Set<(job: AiJob, ok: boolean) => void>();
  const notify = () => {
    for (const l of [...listeners]) l();
  };
  const finish = (done: AiJob, ok: boolean) => {
    job = null;
    notify();
    for (const cb of [...finished]) cb(done, ok);
  };
  return {
    current: () => job,
    run<T>(next: AiJob, fn: () => Promise<T>): Promise<T> {
      if (job) return Promise.reject(new AiGateBusyError());
      job = next;
      notify();
      let p: Promise<T>;
      try {
        p = fn();
      } catch (e) {
        p = Promise.reject(e);
      }
      return p.then(
        (v) => {
          finish(next, true);
          return v;
        },
        (e) => {
          finish(next, false);
          throw e;
        },
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onFinished(cb) {
      finished.add(cb);
      return () => void finished.delete(cb);
    },
    setViewing(key) {
      viewingKey = key;
    },
    viewing: () => viewingKey,
    requestOpen(target) {
      pending = target;
      notify();
    },
    takeOpen(match) {
      if (!pending || !match(pending)) return null;
      const t = pending;
      pending = null;
      notify();
      return t;
    },
    peekOpen: () => pending,
  };
}

/** Yêu cầu AI đang chạy trong tab (null khi rảnh); tự cập nhật. */
export function useAiGate(): AiJob | null {
  const { aiGate } = useApp();
  return useSyncExternalStore(aiGate.subscribe, aiGate.current);
}

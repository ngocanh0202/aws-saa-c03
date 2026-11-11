import { AiUserError } from './types';

/** Không nhận được đoạn nào trong chừng này thì coi như AI treo (cả trước đoạn đầu tiên). */
export const AI_IDLE_TIMEOUT_MS = 90_000;
export const AI_IDLE_MESSAGE = 'AI không phản hồi, vui lòng thử lại.';

export interface IdleWatchdog {
  /**
   * Có dấu hiệu AI còn chạy (gọi tool, đang suy nghĩ…): đếm lại từ đầu. `until`: đang chờ theo lịch
   * thử lại tới thời điểm này (ms) thì chỉ bắt đầu đếm từ lúc đó.
   */
  touch(until?: number): void;
  /**
   * Đọc `source` qua watchdog: mỗi đoạn nhận được thì đếm lại; quá hạn thì ném
   * AiUserError(AI_IDLE_MESSAGE) và thôi đọc (các đoạn đến sau bị bỏ).
   */
  wrap<T>(source: AsyncIterable<T>): AsyncGenerator<T>;
}

export function createIdleWatchdog(ms = AI_IDLE_TIMEOUT_MS, now: () => number = Date.now): IdleWatchdog {
  let deadline = now() + ms;
  /** Hẹn giờ lại cho lượt next() đang chờ (khi hạn đổi). */
  let rearm: (() => void) | null = null;

  const touch = (until?: number) => {
    deadline = Math.max(now(), until ?? 0) + ms;
    rearm?.();
  };

  /** Promise bị reject khi tới hạn; hủy bằng hàm trả về. */
  const expiry = (): { promise: Promise<never>; cancel: () => void } => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reject!: (e: unknown) => void;
    const promise = new Promise<never>((_, rej) => (reject = rej));
    const arm = () => {
      clearTimeout(timer);
      const left = deadline - now();
      if (left <= 0) reject(new AiUserError(AI_IDLE_MESSAGE));
      else timer = setTimeout(arm, left);
    };
    arm();
    rearm = arm;
    return {
      promise,
      cancel: () => {
        clearTimeout(timer);
        if (rearm === arm) rearm = null;
      },
    };
  };

  return {
    touch,
    async *wrap<T>(source: AsyncIterable<T>) {
      const it = source[Symbol.asyncIterator]();
      let finished = false;
      try {
        while (true) {
          const exp = expiry();
          let r: IteratorResult<T>;
          try {
            r = await Promise.race([it.next(), exp.promise]);
          } finally {
            exp.cancel();
          }
          if (r.done) {
            finished = true;
            return;
          }
          touch();
          yield r.value;
        }
      } finally {
        // Quá hạn hay người đọc dừng sớm: đóng nguồn ở nền (lượt next() đang treo có thể không bao giờ xong).
        if (!finished) it.return?.()?.catch(() => undefined);
      }
    },
  };
}

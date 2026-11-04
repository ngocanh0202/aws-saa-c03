/** Số lần tự thử lại khi Gemini báo hết lượt (429) hoặc quá tải (503). */
export const MAX_RETRIES = 4;
export const BASE_DELAY_MS = 2000;
/** Gemini bảo chờ lâu hơn thế này thì không tự chờ, báo người học luôn. */
export const MAX_WAIT_MS = 60_000;

/** Gemini từ chối vì hết lượt/quá tải; retryAfterMs lấy từ RetryInfo nếu Gemini có báo. */
export class AiBusyError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`Gemini busy (${status})`);
    this.name = 'AiBusyError';
  }
}

/** Đọc `RetryInfo.retryDelay` (vd "30s", "1.5s") trong error.details của Google API. */
export function parseRetryDelay(details: unknown): number | undefined {
  if (!Array.isArray(details)) return undefined;
  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const { '@type': type, retryDelay } = d as { '@type'?: unknown; retryDelay?: unknown };
    if (typeof type !== 'string' || !type.endsWith('RetryInfo') || typeof retryDelay !== 'string') continue;
    const m = /^(\d+(?:\.\d+)?)s$/.exec(retryDelay);
    if (m) return Math.round(Number(m[1]) * 1000);
  }
  return undefined;
}

/** Lần chờ thứ attempt (từ 0): 2s, 4s, 8s, 16s…, lệch ngẫu nhiên ±20% để các lần thử không dồn cùng lúc. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  return Math.round(BASE_DELAY_MS * 2 ** attempt * (0.8 + 0.4 * random()));
}

export interface RetryWait {
  /** Lần thử lại thứ mấy (từ 1). */
  attempt: number;
  max: number;
  /** Giờ (ms) sẽ thử lại. */
  until: number;
}

export interface RetryOptions {
  onWait?: (wait: RetryWait) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Chạy fn; gặp AiBusyError thì chờ (theo Gemini báo, hoặc tăng dần) rồi thử lại, tối đa MAX_RETRIES lần. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { onWait, sleep = realSleep, now = Date.now, random = Math.random } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof AiBusyError) || attempt >= MAX_RETRIES) throw e;
      const delay = e.retryAfterMs ?? backoffDelay(attempt, random);
      if (delay > MAX_WAIT_MS) throw e;
      onWait?.({ attempt: attempt + 1, max: MAX_RETRIES, until: now() + delay });
      await sleep(delay);
    }
  }
}

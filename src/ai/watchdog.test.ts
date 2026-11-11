import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiUserError } from './types';
import { AI_IDLE_MESSAGE, AI_IDLE_TIMEOUT_MS, createIdleWatchdog } from './watchdog';

/** Nguồn phát đoạn theo tay: push(chunk) / end(). */
function manual() {
  const queue: string[] = [];
  let wake: (() => void) | null = null;
  let ended = false;
  let returned = false;
  const source: AsyncIterable<string> = {
    [Symbol.asyncIterator]: () => ({
      async next() {
        while (queue.length === 0 && !ended) await new Promise<void>((r) => (wake = r));
        if (queue.length) return { value: queue.shift()!, done: false };
        return { value: undefined, done: true };
      },
      async return() {
        returned = true;
        return { value: undefined, done: true };
      },
    }),
  };
  return {
    source,
    push(c: string) {
      queue.push(c);
      wake?.();
    },
    end() {
      ended = true;
      wake?.();
    },
    returned: () => returned,
  };
}

async function collect(it: AsyncIterable<string>, out: string[]) {
  for await (const c of it) out.push(c);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createIdleWatchdog', () => {
  it('90 giây không có đoạn nào → ném AiUserError, đoạn đến sau bị bỏ', async () => {
    const src = manual();
    const out: string[] = [];
    const run = collect(createIdleWatchdog().wrap(src.source), out);
    const caught = run.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS - 1);
    let settled = false;
    void caught.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const e = await caught;
    expect(e).toBeInstanceOf(AiUserError);
    expect((e as AiUserError).userMessage).toBe(AI_IDLE_MESSAGE);
    src.push('muộn');
    await vi.advanceTimersByTimeAsync(0);
    expect(out).toEqual([]);
    expect(src.returned()).toBe(true);
  });

  it('mỗi đoạn đếm lại từ đầu', async () => {
    const src = manual();
    const out: string[] = [];
    let error: unknown = null;
    const run = collect(createIdleWatchdog().wrap(src.source), out).catch((e: unknown) => (error = e));
    await vi.advanceTimersByTimeAsync(80_000);
    src.push('a');
    await vi.advanceTimersByTimeAsync(80_000);
    src.push('b');
    await vi.advanceTimersByTimeAsync(80_000);
    src.end();
    await run;
    expect(error).toBeNull();
    expect(out).toEqual(['a', 'b']);
  });

  it('touch() đếm lại; touch(until) chỉ đếm từ lúc hết chờ thử lại', async () => {
    const src = manual();
    const wd = createIdleWatchdog();
    let error: unknown = null;
    const run = collect(wd.wrap(src.source), []).catch((e: unknown) => (error = e));
    await vi.advanceTimersByTimeAsync(80_000);
    wd.touch();
    await vi.advanceTimersByTimeAsync(80_000);
    wd.touch(Date.now() + 50_000);
    await vi.advanceTimersByTimeAsync(130_000);
    expect(error).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    await run;
    expect(error).toBeInstanceOf(AiUserError);
  });
});

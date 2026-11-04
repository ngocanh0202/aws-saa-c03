import { describe, expect, it } from 'vitest';
import { AiBusyError, MAX_RETRIES, backoffDelay, parseRetryDelay, withRetry } from './retry';

describe('parseRetryDelay', () => {
  it('đọc RetryInfo.retryDelay ("30s", "1.5s") ra mili giây', () => {
    expect(parseRetryDelay([{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }])).toBe(30_000);
    expect(parseRetryDelay([{ '@type': 'x', reason: 'RATE' }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1.5s' }])).toBe(1500);
  });

  it('không có hoặc sai định dạng thì undefined', () => {
    expect(parseRetryDelay(undefined)).toBeUndefined();
    expect(parseRetryDelay([{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: 'soon' }])).toBeUndefined();
    expect(parseRetryDelay('oops')).toBeUndefined();
  });
});

describe('backoffDelay', () => {
  it('tăng gấp đôi từ 2 giây, lệch ngẫu nhiên ±20%', () => {
    expect(backoffDelay(0, () => 0.5)).toBe(2000);
    expect(backoffDelay(3, () => 0.5)).toBe(16_000);
    expect(backoffDelay(1, () => 0)).toBe(3200);
    expect(backoffDelay(1, () => 1)).toBe(4800);
  });
});

function clock() {
  let t = 1_000;
  const waits: number[] = [];
  return {
    waits,
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
  };
}

describe('withRetry', () => {
  it('lỗi bận thì chờ rồi thử lại, báo giờ thử lại; thành công thì trả kết quả', async () => {
    const c = clock();
    const seen: { attempt: number; until: number }[] = [];
    let n = 0;
    const out = await withRetry(
      async () => {
        if (n++ < 2) throw new AiBusyError(429);
        return 'ok';
      },
      { ...c, random: () => 0.5, onWait: (w) => seen.push({ attempt: w.attempt, until: w.until }) },
    );
    expect(out).toBe('ok');
    expect(c.waits).toEqual([2000, 4000]);
    expect(seen).toEqual([
      { attempt: 1, until: 3000 },
      { attempt: 2, until: 7000 },
    ]);
  });

  it('Gemini báo thời gian chờ thì theo đó', async () => {
    const c = clock();
    let n = 0;
    await withRetry(
      async () => {
        if (n++ === 0) throw new AiBusyError(429, 7000);
        return 1;
      },
      c,
    );
    expect(c.waits).toEqual([7000]);
  });

  it(`hết ${MAX_RETRIES} lần thử lại thì ném lỗi bận cuối`, async () => {
    const c = clock();
    await expect(withRetry(async () => Promise.reject(new AiBusyError(503)), { ...c, random: () => 0.5 })).rejects.toBeInstanceOf(AiBusyError);
    expect(c.waits).toHaveLength(MAX_RETRIES);
  });

  it('phải chờ quá 60 giây thì không chờ, ném luôn', async () => {
    const c = clock();
    await expect(withRetry(async () => Promise.reject(new AiBusyError(429, 120_000)), c)).rejects.toMatchObject({ retryAfterMs: 120_000 });
    expect(c.waits).toEqual([]);
  });

  it('lỗi khác thì không thử lại', async () => {
    const c = clock();
    await expect(withRetry(async () => Promise.reject(new Error('boom')), c)).rejects.toThrow('boom');
    expect(c.waits).toEqual([]);
  });
});

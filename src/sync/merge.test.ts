import { describe, expect, it } from 'vitest';
import type { Attempt } from '../engine/attempt';
import type { StoreEntry } from '../storage/storage';
import { findGuestConflicts, pickWinner, planSync, sameAttempt, type RemoteSnapshot } from './merge';

function att(id: string, status: Attempt['status'] = 'in-progress', extra: Partial<Attempt> = {}): Attempt {
  return { id, setId: 1, questions: [], answers: {}, status, mode: 'practice', flagged: [], guideOpened: [], ...extra } as unknown as Attempt;
}
const entry = (attempt: Attempt, owner: string | undefined, updatedAt: number): StoreEntry => ({
  attempt,
  meta: owner === undefined ? { updatedAt } : { owner, updatedAt },
});
const snap = (...items: Array<[Attempt, number]>): RemoteSnapshot =>
  new Map(items.map(([attempt, updatedAt]) => [attempt.id, { attempt, updatedAt }]));

describe('sameAttempt', () => {
  it('so sánh theo nội dung', () => {
    expect(sameAttempt(att('a'), att('a'))).toBe(true);
    expect(sameAttempt(att('a'), att('a', 'submitted'))).toBe(false);
  });
});

describe('pickWinner', () => {
  it('submitted thắng in-progress dù in-progress mới hơn', () => {
    expect(pickWinner({ attempt: att('a', 'submitted'), updatedAt: 1 }, { attempt: att('a'), updatedAt: 9 })).toBe('local');
    expect(pickWinner({ attempt: att('a'), updatedAt: 9 }, { attempt: att('a', 'submitted'), updatedAt: 1 })).toBe('remote');
  });
  it('cùng trạng thái thì updatedAt mới hơn thắng; bằng nhau thì remote thắng', () => {
    expect(pickWinner({ attempt: att('a'), updatedAt: 5 }, { attempt: att('a'), updatedAt: 3 })).toBe('local');
    expect(pickWinner({ attempt: att('a'), updatedAt: 3 }, { attempt: att('a'), updatedAt: 5 })).toBe('remote');
    expect(pickWinner({ attempt: att('a'), updatedAt: 5 }, { attempt: att('a'), updatedAt: 5 })).toBe('remote');
  });
});

describe('findGuestConflicts', () => {
  it('khách không có trên cloud là xung đột; khách giống hệt cloud thì không; có owner thì không bao giờ', () => {
    const local = [
      entry(att('missing'), undefined, 1),
      entry(att('same'), undefined, 1),
      entry(att('diff'), undefined, 1),
      entry(att('owned'), 'u1', 1),
    ];
    const remote = snap([att('same'), 2], [att('diff', 'submitted'), 2]);
    expect(findGuestConflicts(local, remote).sort()).toEqual(['diff', 'missing']);
  });
});

describe('planSync', () => {
  it('cloud có, máy không có → apply với owner uid', () => {
    const plan = planSync([], snap([att('a'), 7]), 'u1');
    expect(plan.apply).toEqual([entry(att('a'), 'u1', 7)]);
    expect(plan.push).toEqual([]);
  });
  it('lượt của uid có trên máy mà cloud không có → push', () => {
    const local = [entry(att('a'), 'u1', 4)];
    const plan = planSync(local, snap(), 'u1');
    expect(plan.push).toEqual(local);
    expect(plan.apply).toEqual([]);
  });
  it('không đụng lượt của tài khoản khác', () => {
    const plan = planSync([entry(att('a'), 'u2', 4)], snap(), 'u1');
    expect(plan).toEqual({ apply: [], push: [] });
  });
  it('không đụng lượt khách khác bản cloud', () => {
    const plan = planSync([entry(att('a'), undefined, 4)], snap([att('a', 'submitted'), 9]), 'u1');
    expect(plan).toEqual({ apply: [], push: [] });
  });
  it('khách giống hệt cloud → nhận lại với owner uid', () => {
    const plan = planSync([entry(att('a'), undefined, 1)], snap([att('a'), 8]), 'u1');
    expect(plan.apply).toEqual([entry(att('a'), 'u1', 8)]);
    expect(plan.push).toEqual([]);
  });
  it('hai bên khác nhau → pickWinner quyết định', () => {
    const remoteWins = planSync([entry(att('a'), 'u1', 1)], snap([att('a', 'submitted'), 2]), 'u1');
    expect(remoteWins.apply).toEqual([entry(att('a', 'submitted'), 'u1', 2)]);
    expect(remoteWins.push).toEqual([]);
    const localWins = planSync([entry(att('a', 'submitted'), 'u1', 1)], snap([att('a'), 2]), 'u1');
    expect(localWins.push).toEqual([entry(att('a', 'submitted'), 'u1', 1)]);
    expect(localWins.apply).toEqual([]);
  });
  it('echo giống hệt và đã đúng owner → không apply, không push', () => {
    const plan = planSync([entry(att('a'), 'u1', 8)], snap([att('a'), 8]), 'u1');
    expect(plan).toEqual({ apply: [], push: [] });
  });
});

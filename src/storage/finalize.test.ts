import { createAttempt } from '../engine/attempt';
import { makeDeps } from '../test/fixtures';
import { finalizeExpiredRealAttempts, viewFinalized } from './finalize';

describe('finalizeExpiredRealAttempts', () => {
  it('chạy trước khi auth báo (viewer = null) vẫn giữ owner của lượt đã đồng bộ', () => {
    const deps = makeDeps();
    const base = { esl: false, seed: 1, now: 0, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta };
    const expired = { ...createAttempt({ ...base, id: 'r1', setId: 1, mode: 'real' }), endsAt: 500_000 };
    deps.store.put({ attempt: expired, meta: { owner: 'u1', updatedAt: 10 } });

    finalizeExpiredRealAttempts(deps.store, 1_000_000);

    const entry = deps.store.entries().find((e) => e.attempt.id === 'r1')!;
    expect(entry.attempt.status).toBe('submitted');
    expect(entry.meta.owner).toBe('u1');
  });
});

describe('viewFinalized', () => {
  it('viewFinalized nộp lượt Thi thật hết giờ mà không lưu', () => {
    const deps = makeDeps();
    const base = { esl: false, seed: 1, now: 0, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta };
    const expired = { ...createAttempt({ ...base, id: 'r1', setId: 1, mode: 'real' }), endsAt: 500_000 };
    const live = { ...createAttempt({ ...base, id: 'r2', setId: 1, mode: 'real' }), endsAt: 2_000_000 };
    const practice = createAttempt({ ...base, id: 'p1', setId: 1, mode: 'practice' });
    deps.store.save(expired);
    deps.store.save(live);
    deps.store.save(practice);

    const out = viewFinalized(deps.store.list(), 1_000_000);

    expect(out.find((a) => a.id === 'r1')!.status).toBe('submitted');
    expect(deps.store.get('r1')!.status).toBe('in-progress');
    expect(out.find((a) => a.id === 'r2')!.status).toBe('in-progress');
    expect(out.find((a) => a.id === 'p1')!.status).toBe('in-progress');
  });
});

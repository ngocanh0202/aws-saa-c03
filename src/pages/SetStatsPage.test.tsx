import { act, fireEvent, screen } from '@testing-library/react';
import { createAttempt } from '../engine/attempt';
import { submitAttempt } from '../engine/actions';
import { createSyncController } from '../sync/controller';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, renderApp } from '../test/fixtures';

describe('SetStatsPage', () => {
  it('hiện % đúng từng domain của mỗi lượt, lọc theo chế độ', () => {
    const deps = makeDeps();
    const base = createAttempt({ id: 'r1', setId: 1, mode: 'real', esl: true, seed: 1, now: 0, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    const answers = Object.fromEntries(base.questions.filter((q) => q.domain === 1).map((q) => [q.qid, deps.bank.questions.get(q.qid)!.answer]));
    deps.store.save(submitAttempt({ ...base, answers }, 60_000));

    renderApp('/set/1', deps);
    expect(screen.getByRole('heading', { name: 'Thống kê Đề 1' })).toBeInTheDocument();
    const firstRow = screen.getAllByRole('row')[1];
    expect(firstRow).toHaveTextContent('100%');
    expect(firstRow).toHaveTextContent('0%');
    fireEvent.click(screen.getByRole('button', { name: 'Thi thử' }));
    expect(screen.getByText('Chưa có lượt Thi thử nào cho đề này.')).toBeInTheDocument();
  });

  it('có Firebase: chỉ lưu lượt Thi thật hết giờ khi đã biết offset server', () => {
    const deps = makeDeps();
    const base = createAttempt({ id: 'r2', setId: 1, mode: 'real', esl: true, seed: 1, now: 0, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    deps.store.put({ attempt: { ...base, endsAt: 500_000 }, meta: { owner: 'u1', updatedAt: 1 } });
    const auth = fakeAuth();
    const remote = fakeRemote(null);
    const sync = createSyncController({ store: deps.store, auth, remote });
    renderApp('/set/1', { ...deps, sync });
    act(() => auth.emit({ uid: 'u1', name: 'An' }));
    expect(deps.store.get('r2')!.status).toBe('in-progress');
    act(() => remote.setServerOffset(0));
    expect(deps.store.get('r2')!.status).toBe('submitted');
  });
});

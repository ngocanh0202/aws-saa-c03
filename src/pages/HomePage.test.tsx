import { act, fireEvent, screen } from '@testing-library/react';
import type { Attempt } from '../engine/attempt';
import { createSyncController } from '../sync/controller';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, renderApp } from '../test/fixtures';

function expiredReal(deps: ReturnType<typeof makeDeps>, id: string): Attempt {
  const ids = deps.bank.sets.sets[0].questionIds;
  return {
    id,
    setId: 1,
    mode: 'real',
    seed: 1,
    esl: false,
    startedAt: 0,
    endsAt: 500_000,
    questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
  };
}

describe('HomePage', () => {
  it('hiện danh sách đề và nhắc ESL', () => {
    renderApp('/', makeDeps());
    expect(screen.getByRole('heading', { name: 'Đề 1' })).toBeInTheDocument();
    expect(screen.getByText(/đăng ký ESL \+30/)).toBeInTheDocument();
    expect(screen.getByText('Chưa có lượt thi nào.')).toBeInTheDocument();
  });

  it('bấm Thi thật tạo lượt thi có ESL bật sẵn (160 phút)', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Thi thật' }));
    const [attempt] = deps.store.list();
    expect(attempt.mode).toBe('real');
    expect(attempt.esl).toBe(true);
    expect(attempt.endsAt).toBe(1_000_000 + 160 * 60_000);
  });

  it('bỏ chọn ESL thì Thi thật còn 130 phút', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByLabelText(/ESL \+30 phút/));
    fireEvent.click(screen.getByRole('button', { name: 'Thi thật' }));
    expect(deps.store.list()[0].endsAt).toBe(1_000_000 + 130 * 60_000);
  });

  it('Thi thử không có endsAt', () => {
    const deps = makeDeps();
    renderApp('/', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Thi thử' }));
    expect(deps.store.list()[0].endsAt).toBeUndefined();
  });

  it('Thi thật hết giờ mà chưa mở lại vẫn hiện là đã xong, không phải "Làm tiếp"', () => {
    const deps = makeDeps();
    const ids = deps.bank.sets.sets[0].questionIds;
    const expired: Attempt = {
      id: 'expired-1',
      setId: 1,
      mode: 'real',
      seed: 1,
      esl: false,
      startedAt: 0,
      endsAt: 500_000, // đã qua so với now() = 1_000_000
      questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
      answers: {},
      flagged: [],
      guideOpened: [],
      status: 'in-progress',
    };
    deps.store.save(expired);

    renderApp('/', deps);

    expect(screen.queryByText('Đang làm dở')).not.toBeInTheDocument();
    expect(screen.getByText(/100 điểm/)).toBeInTheDocument();
    expect(deps.store.get('expired-1')?.status).toBe('submitted');
    expect(deps.store.get('expired-1')?.submittedAt).toBe(500_000);
  });

  it('lượt Thi thật hết giờ hiện trong lịch sử và được lưu là đã nộp', () => {
    const deps = makeDeps();
    const ids = deps.bank.sets.sets[0].questionIds;
    deps.store.save({
      id: 'expired-2',
      setId: 1,
      mode: 'real',
      seed: 1,
      esl: false,
      startedAt: 0,
      endsAt: 500_000,
      questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
      answers: {},
      flagged: [],
      guideOpened: [],
      status: 'in-progress',
    });
    renderApp('/', deps);
    expect(deps.store.get('expired-2')!.status).toBe('submitted');
    expect(screen.getByRole('link', { name: /Đề 1 · Thi thật · 100 điểm/ })).toBeInTheDocument();
  });

  it('có Firebase: chỉ lưu lượt Thi thật hết giờ khi đã biết offset server', () => {
    const deps = makeDeps();
    deps.store.put({ attempt: expiredReal(deps, 'expired-3'), meta: { owner: 'u1', updatedAt: 1 } });
    const auth = fakeAuth();
    const remote = fakeRemote(null);
    const sync = createSyncController({ store: deps.store, auth, remote });
    renderApp('/', { ...deps, sync });

    // Đang khởi tạo, rồi có phiên nhưng chưa biết offset: chưa lưu gì.
    expect(deps.store.get('expired-3')!.status).toBe('in-progress');
    act(() => auth.emit({ uid: 'u1', name: 'An' }));
    act(() => remote.emit('u1', new Map()));
    expect(deps.store.get('expired-3')!.status).toBe('in-progress');

    act(() => remote.setServerOffset(0));
    expect(deps.store.get('expired-3')!.status).toBe('submitted');
  });

  it('có Firebase mà chưa đăng nhập (khách): lưu lượt Thi thật hết giờ ngay khi auth báo', () => {
    const deps = makeDeps();
    deps.store.save(expiredReal(deps, 'expired-4'));
    const auth = fakeAuth();
    const sync = createSyncController({ store: deps.store, auth, remote: fakeRemote(null) });
    renderApp('/', { ...deps, sync });
    expect(deps.store.get('expired-4')!.status).toBe('in-progress');
    act(() => auth.emit(null));
    expect(deps.store.get('expired-4')!.status).toBe('submitted');
  });
});

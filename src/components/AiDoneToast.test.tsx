import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppProvider } from '../app/context';
import { targetKey, type AiJob } from '../ai/gate';
import { createAttempt } from '../engine/attempt';
import { submitAttempt } from '../engine/actions';
import { makeDeps } from '../test/fixtures';
import { AiDoneToast } from './AiDoneToast';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup() {
  const deps = makeDeps();
  const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: 1, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
  deps.store.save(attempt);
  render(
    <AppProvider deps={deps}>
      <MemoryRouter initialEntries={['/']}>
        <AiDoneToast />
        <Where />
      </MemoryRouter>
    </AppProvider>,
  );
  const gate = deps.aiGate;
  const finish = async (job: AiJob, ok = true) => {
    await act(async () => {
      await gate.run(job, () => (ok ? Promise.resolve() : Promise.reject(new Error('x')))).catch(() => undefined);
    });
  };
  return { deps, gate, attempt, finish };
}

const chat = (label = 'Câu 12', qid = 5): AiJob => ({ kind: 'chat', label, target: { page: 'attempt', attemptId: 'e1', qid } });

afterEach(() => vi.useRealTimers());

describe('AiDoneToast', () => {
  it('chat xong khi đang nhìn chỗ khác: báo kèm nút Đến câu', async () => {
    const s = setup();
    s.gate.setViewing('attempt:e1:999');
    await s.finish(chat());
    expect(screen.getByRole('status')).toHaveTextContent('AI đã trả lời ở Câu 12');
    expect(screen.getByRole('button', { name: 'Đến câu 12' })).toBeInTheDocument();
  });

  it('ghi chú xong và lỗi có câu riêng', async () => {
    const s = setup();
    await s.finish({ kind: 'note', label: 'Câu 12', target: { page: 'attempt', attemptId: 'e1', qid: 5, highlightId: 'h1' } });
    expect(screen.getByRole('status')).toHaveTextContent('AI đã soạn ghi chú ở Câu 12');
    await s.finish(chat(), false);
    expect(screen.getByRole('status')).toHaveTextContent('AI gặp lỗi ở Câu 12');
  });

  it('đang nhìn đúng chỗ lúc xong thì không báo', async () => {
    const s = setup();
    const job = chat();
    s.gate.setViewing(targetKey(job.target));
    await s.finish(job);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('thông báo mới thay thông báo cũ; ✕ ẩn', async () => {
    const s = setup();
    await s.finish(chat('Câu 3', 3));
    await s.finish(chat('Câu 4', 4));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('AI đã trả lời ở Câu 4');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tự ẩn sau 10 giây', async () => {
    vi.useFakeTimers();
    const s = setup();
    await s.finish(chat());
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Đến câu: lượt đang làm thì yêu cầu mở và tới /exam/<id>', async () => {
    const s = setup();
    const job = chat();
    await s.finish(job);
    fireEvent.click(screen.getByRole('button', { name: 'Đến câu 12' }));
    expect(s.gate.peekOpen()).toEqual(job.target);
    expect(screen.getByTestId('where')).toHaveTextContent('/exam/e1');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Đến câu: lượt đã nộp thì tới /result/<id>', async () => {
    const s = setup();
    s.deps.store.save(submitAttempt(s.attempt, 2));
    await s.finish(chat());
    fireEvent.click(screen.getByRole('button', { name: 'Đến câu 12' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/result/e1');
  });

  it('Đến câu: ghi chú soạn ở trang ghi chú thì về /notes', async () => {
    const s = setup();
    const job: AiJob = { kind: 'note', label: 'Main 1 · Câu 5', target: { page: 'notes', qid: 10105, highlightId: 'h1' } };
    await s.finish(job);
    fireEvent.click(screen.getByRole('button', { name: 'Đến Main 1 · Câu 5' }));
    expect(s.gate.peekOpen()).toEqual(job.target);
    expect(screen.getByTestId('where')).toHaveTextContent('/notes');
  });
});

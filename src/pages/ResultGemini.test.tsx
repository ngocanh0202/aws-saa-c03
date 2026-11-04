import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { submitAttempt } from '../engine/actions';
import type { Attempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const GEMINI = 'Hỏi Gemini';

function setup({ mode = 'real', signedIn = true }: { mode?: Attempt['mode']; signedIn?: boolean } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const ai = fakeAi();
  const chats = fakeChats();
  const deps = { ...makeDeps({ store, sync }), ai, chats };
  const ids = deps.bank.sets.sets[0].questionIds;
  const attempt = submitAttempt(
    {
      id: 'r1',
      setId: 1,
      mode,
      seed: 1,
      esl: false,
      startedAt: 0,
      questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
      answers: { [ids[0]]: ['A'] },
      flagged: [],
      guideOpened: [],
      status: 'in-progress',
    },
    60_000,
  );
  store.save(attempt);
  renderApp('/result/r1', deps);
  act(() => auth.emit(signedIn ? { uid: 'u1', name: 'An' } : null));
  if (signedIn) act(() => remote.emit('u1', new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
  return { store, ai, chats, ids };
}

async function ask(dialog: HTMLElement, text = 'Tại sao?') {
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi' }));
  });
}

describe('Hỏi Gemini ở trang xem lại', () => {
  it('chưa đăng nhập thì không có nút', () => {
    setup({ signedIn: false });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('mỗi câu có một nút, nằm trong khối câu (không nổi)', () => {
    setup();
    const buttons = screen.getAllByRole('button', { name: GEMINI });
    expect(buttons).toHaveLength(65);
    expect(buttons[0]).toHaveClass('btn-gemini--inline');
  });

  it('lượt Thi thật đã nộp: hỏi được, lưu đúng khóa, không có open_guide, lượt không đổi', async () => {
    const s = setup();
    fireEvent.click(screen.getAllByRole('button', { name: GEMINI })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' });
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved.at(-1)?.key).toBe(`u1/r1/${s.ids[0]}`));
    expect(s.ai.calls[0].options?.tools?.map((t) => t.name)).toEqual(['find_answered_questions']);
    expect(s.ai.calls[0].systemPrompt).toContain('đã thấy đáp án');
    expect(s.store.get('r1')!.guideOpened).toEqual([]);
  });

  it('mở câu khác thì khung đang mở đóng lại, chỉ còn một khung', () => {
    setup({ mode: 'practice' });
    fireEvent.click(screen.getAllByRole('button', { name: GEMINI })[0]);
    expect(screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: GEMINI })[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 2' })).toBeInTheDocument();
  });
});

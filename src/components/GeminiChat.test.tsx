import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../ai/types';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };
const GEMINI = 'Hỏi Gemini';

function setup({
  mode = 'practice',
  signedIn = true,
  withAi = true,
  history,
  loadError,
}: { mode?: 'practice' | 'real'; signedIn?: boolean; withAi?: boolean; history?: ChatMessage[]; loadError?: Error } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const ai = fakeAi();
  const base = makeDeps({ store, sync });
  const attempt = createAttempt({ id: 'e1', setId: 1, mode, esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
  store.save(attempt);
  const qid = attempt.questions[0].qid;
  const chats = fakeChats(history ? { [`u1/e1/${qid}`]: history } : {});
  chats.loadError = loadError;
  const deps = withAi ? { ...base, ai, chats } : base;
  renderApp('/exam/e1', deps);
  act(() => auth.emit(signedIn ? USER : null));
  // Cloud đã có đúng lượt này nên không hỏi xung đột dữ liệu khách.
  if (signedIn) act(() => remote.emit(USER.uid, new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
  return { store, auth, ai, chats, qid, key: `u1/e1/${qid}` };
}

async function openChat() {
  fireEvent.click(screen.getByRole('button', { name: GEMINI }));
  const dialog = screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' });
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  return dialog;
}

async function ask(dialog: HTMLElement, text = 'Tại sao?') {
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi' }));
  });
}

const guideOpened = (s: ReturnType<typeof setup>) => s.store.get('e1')!.guideOpened;

describe('Hỏi Gemini ở Thi thử', () => {
  it('ẩn khi chưa đăng nhập', () => {
    setup({ signedIn: false });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('ẩn khi không có ai', () => {
    setup({ withAi: false });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('ẩn ở Thi thật', () => {
    setup({ mode: 'real' });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('hiện ở Thi thử khi đã đăng nhập', () => {
    setup();
    expect(screen.getByRole('button', { name: GEMINI })).toBeInTheDocument();
  });

  it('gửi câu hỏi: prompt có đề + đáp án, câu trả lời stream hiện ra', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    expect(within(dialog).getByText(new RegExp(`Stem ${s.qid}`))).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
    expect(s.ai.calls[0].systemPrompt).toContain('Đáp án đúng:');
    expect(s.ai.calls[0].systemPrompt).toContain(`Stem ${s.qid}`);
    expect(s.ai.calls[0].sent).toEqual(['Tại sao?']);
  });

  it('câu được gắn nhãn khi có chữ đầu tiên', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    expect(guideOpened(s)).not.toContain(s.qid);
    await ask(dialog);
    await waitFor(() => expect(guideOpened(s)).toContain(s.qid));
  });

  it('lỗi trước chữ đầu tiên không gắn nhãn', async () => {
    const s = setup();
    s.ai.reply = new Error('blocked');
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini chưa trả lời được, thử gửi lại nhé.')).toBeInTheDocument());
    expect(guideOpened(s)).not.toContain(s.qid);
    expect(s.chats.saved).toEqual([]);
  });

  it('lỗi giữa chừng giữ chữ đã nhận', async () => {
    const s = setup();
    s.ai.reply = ['Một ', 'hai'];
    s.ai.failAfter = 1;
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini chưa trả lời được, thử gửi lại nhé.')).toBeInTheDocument());
    expect(within(dialog).getByText('Một')).toBeInTheDocument();
    expect(s.chats.saved).toEqual([]);
    expect(guideOpened(s)).toContain(s.qid);
  });

  it('lưu lịch sử sau mỗi lượt', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved).toHaveLength(1));
    expect(s.chats.saved[0]).toEqual({
      key: s.key,
      messages: [
        { role: 'user', text: 'Tại sao?' },
        { role: 'model', text: 'Vì S3' },
      ],
    });
  });

  it('mở lại thấy lịch sử cũ và gửi kèm cho model', async () => {
    const old: ChatMessage[] = [
      { role: 'user', text: 'Câu hỏi cũ' },
      { role: 'model', text: 'Trả lời cũ' },
    ];
    const s = setup({ history: old });
    const dialog = await openChat();
    expect(within(dialog).getByText('Câu hỏi cũ')).toBeInTheDocument();
    expect(within(dialog).getByText('Trả lời cũ')).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved).toHaveLength(1));
    expect(s.ai.calls[0].history).toHaveLength(2);
    expect(s.chats.saved[0].messages).toHaveLength(4);
  });

  it('lỗi tải lịch sử vẫn chat được', async () => {
    const s = setup({ loadError: new Error('denied') });
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    expect(within(dialog).getByText('Không tải được lịch sử trò chuyện.')).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
  });

  it('bỏ qua tin nhắn rỗng', async () => {
    const s = setup();
    const dialog = await openChat();
    await ask(dialog, '   ');
    expect(s.ai.calls).toEqual([]);
  });

  it('không gửi khi đang trả lời', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeDisabled();
    expect(within(dialog).getByRole('textbox')).toBeDisabled();
    await act(async () => s.ai.release());
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  });

  it('đăng xuất thì đóng popup', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    act(() => s.auth.emit(null));
    expect(screen.queryByRole('dialog', { name: 'Hỏi Gemini · Câu 1' })).toBeNull();
    // Câu trả lời đến sau khi đã đóng: không lỗi, không lưu.
    await act(async () => s.ai.release());
    expect(s.chats.saved).toEqual([]);
  });

  it('Esc đóng popup và trả lại cuộn trang', async () => {
    setup();
    await openChat();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});

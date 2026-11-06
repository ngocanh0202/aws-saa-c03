import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import type { ErrorReport } from '../support/model';
import { openSupport } from '../support/open';
import { createSyncController } from '../sync/controller';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeSupport } from '../test/fake-support';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const USER = { uid: 'u1', name: 'An', email: 'an@x.com', emailVerified: true };
const report: ErrorReport = { message: 'Không tải được dữ liệu', code: 'E42', page: '#/history', at: 1_700_000_000_000 };
const other: ErrorReport = { message: 'Lỗi khác', page: '#/', at: 1_700_000_001_000 };

function setup({ exam }: { exam?: 'practice' | 'real' } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const support = fakeSupport();
  const ai = fakeAi();
  const chats = fakeChats();
  const base = makeDeps({ store, sync });
  const remoteData = new Map();
  if (exam) {
    const attempt = createAttempt({ id: 'e1', setId: 1, mode: exam, esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
    store.save(attempt);
    remoteData.set(attempt.id, { attempt, updatedAt: 1 });
  }
  renderApp(exam ? '/exam/e1' : '/', { ...base, support, ai, chats });
  act(() => auth.emit(USER));
  act(() => remote.emit('u1', remoteData));
  return { support, auth };
}

const dialog = () => screen.getByRole('dialog', { name: 'Liên hệ admin' });

async function sendText(text: string) {
  const d = dialog();
  fireEvent.change(within(d).getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(within(d).getByRole('button', { name: 'Gửi' }));
  });
}

describe('Khung Liên hệ admin (người học)', () => {
  it('không render khi chưa đăng nhập', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const sync = createSyncController({ store, auth: fakeAuth(), remote: fakeRemote() });
    renderApp('/', { ...makeDeps({ store, sync }), support: fakeSupport() });
    act(() => openSupport());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mở bằng openSupport, gửi tin, tin hiện bên phải', async () => {
    const { support } = setup();
    act(() => openSupport());
    await sendText('Xin chào');
    expect(support.sent[0]).toEqual({ uid: 'u1', msg: { from: 'user', text: 'Xin chào' } });
    const msg = within(dialog()).getByText('Xin chào');
    expect(msg.closest('.gemini__msg')).toHaveClass('gemini__msg--user');
    expect(within(dialog()).getByRole('textbox')).toHaveValue('');
  });

  it('lỗi đính kèm: gỡ được, gửi khi ô trống, gửi xong thì thẻ biến mất', async () => {
    const { support } = setup();
    act(() => openSupport({ error: report }));
    expect(within(dialog()).getByText(`⚠ Lỗi đính kèm: ${report.message}`)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gỡ lỗi đính kèm' }));
    expect(within(dialog()).queryByText(/Lỗi đính kèm/)).toBeNull();
    act(() => openSupport({ error: report }));
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Gửi' }));
    });
    expect(support.sent[0]).toEqual({ uid: 'u1', msg: { from: 'user', text: '', error: report } });
    expect(within(dialog()).queryByText(/Lỗi đính kèm/)).toBeNull();
    // Tin có lỗi hiện khối lỗi: câu báo, mã, trang.
    expect(within(dialog()).getByText(/E42/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/#\/history/)).toBeInTheDocument();
  });

  it('đang gõ mà mở lại với lỗi khác: giữ chữ, thay lỗi', () => {
    setup();
    act(() => openSupport({ error: report }));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'abc' } });
    act(() => openSupport({ error: other }));
    expect(within(dialog()).getByRole('textbox')).toHaveValue('abc');
    expect(within(dialog()).getByText(`⚠ Lỗi đính kèm: ${other.message}`)).toBeInTheDocument();
    expect(within(dialog()).queryByText(`⚠ Lỗi đính kèm: ${report.message}`)).toBeNull();
  });

  it('gửi lỗi: giữ chữ, báo kèm link mailto', async () => {
    const { support } = setup();
    act(() => openSupport());
    support.sendError = new Error('denied');
    await sendText('Giúp với');
    expect(within(dialog()).getByRole('textbox')).toHaveValue('Giúp với');
    const alert = within(dialog()).getByRole('alert');
    expect(alert).toHaveTextContent('Không gửi được');
    expect(within(alert).getByRole('link').getAttribute('href')).toMatch(/^mailto:buihngocanh2@gmail\.com/);
    expect(support.sent).toEqual([]);
  });

  it('tin admin hiện bên trái; mở khung thì đánh dấu đã đọc', async () => {
    const { support } = setup();
    await act(async () => {
      await support.send('u1', { from: 'admin', text: 'Chào An' }, { name: 'Admin' });
    });
    expect(support.index.get('u1')?.unreadByUser).toBe(true);
    act(() => openSupport());
    const msg = within(dialog()).getByText('Chào An');
    expect(msg.closest('.gemini__msg')).toHaveClass('gemini__msg--model');
    await waitFor(() => expect(support.index.get('u1')?.unreadByUser).toBe(false));
  });

  it('một khung chat mỗi lúc: Gemini và hỗ trợ đóng nhau', () => {
    setup({ exam: 'practice' });
    act(() => openSupport());
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
    expect(screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Liên hệ admin' })).toBeNull();
    act(() => openSupport());
    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Hỏi Gemini · Câu 1' })).toBeNull();
  });

  it('đăng xuất khi khung mở: khung biến mất, không gửi', () => {
    const { support, auth } = setup();
    act(() => openSupport());
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'chưa gửi' } });
    act(() => auth.emit(null));
    expect(screen.queryByRole('dialog', { name: 'Liên hệ admin' })).toBeNull();
    expect(support.sent).toEqual([]);
  });

  it('Esc và ✕ đóng khung', () => {
    setup();
    act(() => openSupport());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => openSupport());
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('màn hình Thi thật: chữ tiếng Anh', () => {
    setup({ exam: 'real' });
    act(() => openSupport());
    const d = screen.getByRole('dialog', { name: 'Contact admin' });
    expect(within(d).getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});

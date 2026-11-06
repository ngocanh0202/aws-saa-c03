import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import type { SupportThread } from '../support/model';
import { openSupport } from '../support/open';
import { createSyncController } from '../sync/controller';
import { fakeSupport } from '../test/fake-support';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const ADMIN = { uid: 'adm', name: 'Admin', email: 'buihngocanh2@gmail.com', emailVerified: true };

const row = (t: Partial<SupportThread> & { uid: string; updatedAt: number }): SupportThread => ({
  name: '',
  last: '',
  lastFrom: 'user',
  unreadByAdmin: false,
  unreadByUser: false,
  ...t,
});

function setup({ seed = true, exam }: { seed?: boolean; exam?: 'real' } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const support = fakeSupport();
  if (seed) {
    support.index.set('u1', row({ uid: 'u1', name: 'An', email: 'an@x.com', updatedAt: 1, last: 'Cảm ơn admin' }));
    support.index.set('u2', row({ uid: 'u2', name: 'Bình', email: 'binh@x.com', updatedAt: 2, last: 'Không lưu được bài', unreadByAdmin: true }));
    support.threads.set('u2', [{ id: 'm1', from: 'user', text: 'Không lưu được bài', at: 2 }]);
  }
  const base = makeDeps({ store, sync });
  const remoteData = new Map();
  if (exam) {
    const attempt = createAttempt({ id: 'e1', setId: 1, mode: exam, esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
    store.save(attempt);
    remoteData.set(attempt.id, { attempt, updatedAt: 1 });
  }
  renderApp(exam ? '/exam/e1' : '/', { ...base, support });
  act(() => auth.emit(ADMIN));
  act(() => remote.emit('adm', remoteData));
  return { support };
}

const dialog = () => screen.getByRole('dialog', { name: 'Hộp thư hỗ trợ' });
const items = () => [...dialog().querySelectorAll('.gemini__item')] as HTMLElement[];

describe('Hộp thư hỗ trợ (admin)', () => {
  it('openSupport mở danh sách: mới nhất trước, chấm chưa đọc, tên, email, tin cuối', () => {
    setup();
    act(() => openSupport());
    const [first, second] = items();
    expect(items()).toHaveLength(2);
    expect(first).toHaveTextContent('Bình');
    expect(first).toHaveTextContent('binh@x.com');
    expect(first).toHaveTextContent('Không lưu được bài');
    expect(within(first).getByLabelText('Chưa đọc')).toBeInTheDocument();
    expect(second).toHaveTextContent('An');
    expect(second).toHaveTextContent('an@x.com');
    expect(second).toHaveTextContent('Cảm ơn admin');
    expect(within(second).queryByLabelText('Chưa đọc')).toBeNull();
  });

  it('bấm một dòng: mở cuộc trò chuyện, đánh dấu đã đọc, trả lời, quay lại danh sách', async () => {
    const { support } = setup();
    act(() => openSupport());
    fireEvent.click(items()[0]);
    const msg = within(dialog()).getByText('Không lưu được bài');
    // Tin của người học nằm bên trái khi admin đọc.
    expect(msg.closest('.gemini__msg')).toHaveClass('gemini__msg--model');
    await waitFor(() => expect(support.index.get('u2')?.unreadByAdmin).toBe(false));

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Đã sửa' } });
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Gửi' }));
    });
    expect(support.sent).toEqual([{ uid: 'u2', msg: { from: 'admin', text: 'Đã sửa' } }]);
    expect(support.index.get('u2')?.unreadByUser).toBe(true);

    fireEvent.click(within(dialog()).getByRole('button', { name: '← Danh sách' }));
    expect(items()).toHaveLength(2);
    expect(within(items()[0]).queryByLabelText('Chưa đọc')).toBeNull();
  });

  it('danh sách rỗng', () => {
    setup({ seed: false });
    act(() => openSupport());
    expect(within(dialog()).getByText('Chưa có cuộc trò chuyện nào.')).toBeInTheDocument();
  });

  it('bản ghi thiếu tên: hiện email, không có email thì hiện uid', () => {
    const { support } = setup({ seed: false });
    act(() => {
      support.index.set('u3', row({ uid: 'u3', email: 'c@x.com', updatedAt: 3 }));
      support.index.set('u4', row({ uid: 'u4', updatedAt: 4 }));
      openSupport();
    });
    const [u4, u3] = items();
    expect(within(u4).getByText('u4')).toBeInTheDocument();
    expect(within(u3).getAllByText('c@x.com').length).toBeGreaterThan(0);
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
    setup({ seed: false, exam: 'real' });
    act(() => openSupport());
    const d = screen.getByRole('dialog', { name: 'Support inbox' });
    expect(within(d).getByText('No conversations yet.')).toBeInTheDocument();
  });
});

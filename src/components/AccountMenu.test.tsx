import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAttempt, type Attempt } from '../engine/attempt';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { createStore } from '../storage/storage';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };

function attempt(id: string): Attempt {
  return {
    id,
    setId: 1,
    mode: 'practice',
    seed: 1,
    esl: false,
    startedAt: 100,
    questions: [],
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
  };
}

function setup(before?: (store: ReturnType<typeof createStore>) => void) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  before?.(store);
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  return { store, auth, remote, sync, deps: makeDeps({ store, sync }) };
}

describe('AccountMenu', () => {
  it('không có cấu hình Firebase thì không có nút đăng nhập', () => {
    renderApp('/', makeDeps());
    expect(screen.queryByText('Đăng nhập Google')).toBeNull();
  });

  it('auth chưa báo lần đầu (đang khởi tạo): không hiện nút đăng nhập', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    expect(screen.queryByRole('button', { name: 'Đăng nhập Google' })).toBeNull();
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    act(() => auth.emit(null));
    expect(screen.getByRole('button', { name: 'Đăng nhập Google' })).toBeTruthy();
  });

  it('chưa đăng nhập: bấm "Đăng nhập Google" gọi signIn', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập Google' }));
    expect(auth.signInCount).toBe(1);
  });

  it('đã đồng bộ: hiện tên và "Đăng xuất"; bấm thì gọi signOut', () => {
    const { auth, remote, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(USER));
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    act(() => remote.emit(USER.uid, new Map()));
    expect(screen.getByText('An Nguyen')).toBeTruthy();
    expect(screen.getByText('Đã đồng bộ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(auth.signOutCount).toBe(1);
  });

  it('màn hình Thi thật dùng "Sign in with Google"', () => {
    const { store, sync, auth } = setup();
    const deps = makeDeps({ store, sync });
    store.save(
      createAttempt({ id: 'real-1', setId: 1, mode: 'real', esl: true, seed: 7, now: 100, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }),
    );
    renderApp('/exam/real-1', deps);
    act(() => auth.emit(null));
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  });

  it('có xung đột: hộp thoại hiện số lượt thi; bấm "Dùng dữ liệu trên cloud" gọi resolveConflict(\'cloud\')', () => {
    const { auth, remote, sync, deps } = setup((s) => s.save(attempt('g1')));
    renderApp('/', deps);
    act(() => auth.emit(USER));
    act(() => remote.emit(USER.uid, new Map()));
    expect(sync.getState().kind).toBe('conflict');
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dùng dữ liệu trên cloud' }));
    expect(dialog.textContent).toContain('Máy này có dữ liệu chưa đăng nhập');
    expect(dialog.textContent).toContain('Có 1 lượt thi trên máy này chưa thuộc tài khoản An Nguyen.');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(sync.getState().kind).toBe('conflict');
    fireEvent.click(screen.getByRole('button', { name: 'Dùng dữ liệu trên cloud' }));
    expect(sync.getState().kind).toBe('synced');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mất kết nối: hiện "Mất kết nối, sẽ đồng bộ khi có mạng"', () => {
    const { auth, remote, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(USER));
    act(() => remote.emit(USER.uid, new Map()));
    act(() => remote.setOnline(false));
    expect(screen.getByText('Mất kết nối, sẽ đồng bộ khi có mạng')).toBeTruthy();
  });

  it('không đọc được cloud: hiện lỗi kèm nút đăng nhập; bấm thì mở lại phiên, không mở popup', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { auth, remote, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(USER));
    act(() => remote.emitError(USER.uid, new Error('permission_denied')));
    expect(screen.getByRole('alert').textContent).toContain('Security Rules');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập Google' }));
    expect(auth.signInCount).toBe(0);
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    act(() => remote.emit(USER.uid, new Map()));
    expect(screen.getByText('An Nguyen')).toBeTruthy();
    error.mockRestore();
  });
});

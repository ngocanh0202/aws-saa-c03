import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAttempt, type Attempt } from '../engine/attempt';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { createStore } from '../storage/storage';
import { fakeSupport } from '../test/fake-support';
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
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
  });

  it('auth chưa báo lần đầu (đang khởi tạo): không hiện nút đăng nhập', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    act(() => auth.emit(null));
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('chưa đăng nhập: "Đăng nhập" (có icon) mở popup 3 cách có icon; Google gọi signIn và đóng popup; Facebook đang tắt', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    const open = screen.getByRole('button', { name: 'Đăng nhập' });
    expect(open.querySelector('svg')).not.toBeNull();
    fireEvent.click(open);
    const popup = screen.getByRole('dialog', { name: 'Đăng nhập' });
    for (const name of ['Google', 'Email/Mật khẩu', 'Facebook']) {
      expect(within(popup).getByRole('button', { name: new RegExp(`^${name}`) }).querySelector('svg')).not.toBeNull();
    }
    const facebook = within(popup).getByRole('button', { name: /^Facebook/ });
    expect(facebook).toBeDisabled();
    fireEvent.click(facebook);
    expect(auth.signInCount).toBe(0);
    fireEvent.click(within(popup).getByRole('button', { name: 'Google' }));
    expect(auth.signInMethods).toEqual([{ kind: 'google' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Email/Mật khẩu: đóng popup chọn cách, mở form riêng; Esc đóng form', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email/Mật khẩu' }));
    expect(screen.queryByRole('dialog', { name: 'Đăng nhập' })).toBeNull();
    const form = screen.getByRole('dialog', { name: 'Đăng nhập bằng email' });
    fireEvent.keyDown(within(form).getByLabelText('Email'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(auth.signInCount).toBe(0);
  });

  it('form email: kiểm tra trước khi gửi, đăng nhập thì gọi signIn email', async () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email/Mật khẩu' }));
    const form = screen.getByRole('dialog', { name: 'Đăng nhập bằng email' });
    fireEvent.click(within(form).getByRole('button', { name: 'Đăng nhập' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Email không hợp lệ.');
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: ' an@example.com ' } });
    fireEvent.change(within(form).getByLabelText('Mật khẩu'), { target: { value: '123' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Đăng nhập' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('ít nhất 6 ký tự');
    expect(auth.signInCount).toBe(0);
    fireEvent.change(within(form).getByLabelText('Mật khẩu'), { target: { value: 'secret1' } });
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Đăng nhập' }));
    });
    expect(auth.signInMethods).toEqual([{ kind: 'email', mode: 'sign-in', email: 'an@example.com', password: 'secret1' }]);
  });

  it('form email: lỗi từ Firebase hiện trong form; chuyển sang Đăng ký cần nhập lại mật khẩu khớp', async () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email/Mật khẩu' }));
    let form = screen.getByRole('dialog', { name: 'Đăng nhập bằng email' });
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'an@example.com' } });
    fireEvent.change(within(form).getByLabelText('Mật khẩu'), { target: { value: 'secret1' } });
    auth.signInError = Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Đăng nhập' }));
    });
    expect(within(form).getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');

    fireEvent.click(within(form).getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }));
    form = screen.getByRole('dialog', { name: 'Đăng ký bằng email' });
    expect(within(form).getByLabelText('Email')).toHaveValue('an@example.com');
    fireEvent.change(within(form).getByLabelText('Nhập lại mật khẩu'), { target: { value: 'secret2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Tạo tài khoản' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Mật khẩu nhập lại không khớp.');
    fireEvent.change(within(form).getByLabelText('Nhập lại mật khẩu'), { target: { value: 'secret1' } });
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Tạo tài khoản' }));
    });
    expect(auth.signInMethods.at(-1)).toEqual({ kind: 'email', mode: 'sign-up', email: 'an@example.com', password: 'secret1' });
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

  it('màn hình Thi thật dùng chữ tiếng Anh ("Sign in")', () => {
    const { store, sync, auth } = setup();
    const deps = makeDeps({ store, sync });
    store.save(
      createAttempt({ id: 'real-1', setId: 1, mode: 'real', esl: true, seed: 7, now: 100, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }),
    );
    renderApp('/exam/real-1', deps);
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const popup = screen.getByRole('dialog', { name: 'Sign in' });
    expect(within(popup).getByRole('button', { name: 'Email/Password' })).toBeTruthy();
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

  describe('mục hỗ trợ', () => {
    const NORMAL: SyncUser = { uid: 'u1', name: 'An', email: 'an@x.com', emailVerified: true };
    const ADMIN: SyncUser = { uid: 'a1', name: 'Admin', email: 'buihngocanh2@gmail.com', emailVerified: true };

    function signedIn(user: SyncUser, withSupport = true, exam?: 'real') {
      const { store, auth, remote, sync } = setup();
      const support = fakeSupport();
      const base = makeDeps({ store, sync });
      const data = new Map();
      if (exam) {
        const a = createAttempt({ id: 'r1', setId: 1, mode: exam, esl: false, seed: 7, now: 100, sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
        store.save(a);
        data.set(a.id, { attempt: a, updatedAt: 1 });
      }
      renderApp(exam ? '/exam/r1' : '/', { ...base, ...(withSupport ? { support } : {}) });
      act(() => auth.emit(user));
      act(() => remote.emit(user.uid, data));
      return { support };
    }

    it('người thường: nút mở khung; tin mới có nhãn phụ', () => {
      signedIn(NORMAL);
      const btn = screen.getByRole('button', { name: /Liên hệ admin$/ });
      expect(btn).toHaveTextContent('💬 Liên hệ admin');
      expect(screen.queryByRole('button', { name: /Hộp thư hỗ trợ/ })).toBeNull();
      fireEvent.click(btn);
      expect(screen.getByRole('dialog', { name: 'Liên hệ admin' })).toBeInTheDocument();
    });

    it('người thường: unreadByUser thì nút có aria-label "Liên hệ admin, có tin mới"', async () => {
      const { support } = signedIn(NORMAL);
      await act(async () => {
        await support.send('u1', { from: 'admin', text: 'Chào' }, { name: 'Admin' });
      });
      const btn = screen.getByRole('button', { name: /Liên hệ admin, có tin mới/ });
      expect(btn).toHaveTextContent('(có tin mới)');
    });

    it('admin: "Hộp thư hỗ trợ (2)", không có "Liên hệ admin"', () => {
      signedIn(ADMIN);
      expect(screen.queryByRole('button', { name: /Liên hệ admin/ })).toBeNull();
      expect(screen.getByRole('button', { name: /Hộp thư hỗ trợ/ })).toHaveTextContent('📥 Hộp thư hỗ trợ');
    });

    it('admin: đếm thread chưa đọc', async () => {
      const { support } = signedIn(ADMIN);
      await act(async () => {
        await support.send('x1', { from: 'user', text: 'a' }, { name: 'X1' });
        await support.send('x2', { from: 'user', text: 'b' }, { name: 'X2' });
      });
      const btn = screen.getByRole('button', { name: /Hộp thư hỗ trợ/ });
      expect(btn).toHaveTextContent('📥 Hộp thư hỗ trợ (2)');
      fireEvent.click(btn);
      expect(screen.getByRole('dialog', { name: 'Hộp thư hỗ trợ' })).toBeInTheDocument();
    });

    it('không có support trong deps: không có hai mục', () => {
      signedIn(NORMAL, false);
      expect(screen.queryByRole('button', { name: /Liên hệ admin/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Hộp thư hỗ trợ/ })).toBeNull();
    });

    it('Thi thật: nhãn tiếng Anh', () => {
      signedIn(NORMAL, true, 'real');
      expect(screen.getByRole('button', { name: /Contact admin$/ })).toHaveTextContent('💬 Contact admin');
    });

    it('Thi thật, admin: "Support inbox"', () => {
      signedIn(ADMIN, true, 'real');
      expect(screen.getByRole('button', { name: /Support inbox/ })).toHaveTextContent('📥 Support inbox');
    });

    it('bấm mục thì đóng menu', () => {
      signedIn(NORMAL);
      const details = document.querySelector('details.account') as HTMLDetailsElement;
      details.open = true;
      fireEvent.click(screen.getByRole('button', { name: /Liên hệ admin$/ }));
      expect(details.open).toBe(false);
    });
  });

  it('không đọc được cloud: hiện lỗi kèm nút đăng nhập; bấm thì mở lại phiên, không mở popup', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { auth, remote, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(USER));
    act(() => remote.emitError(USER.uid, new Error('permission_denied')));
    expect(screen.getByRole('alert').textContent).toContain('Security Rules');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(auth.signInCount).toBe(0);
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    act(() => remote.emit(USER.uid, new Map()));
    expect(screen.getByText('An Nguyen')).toBeTruthy();
    error.mockRestore();
  });
});

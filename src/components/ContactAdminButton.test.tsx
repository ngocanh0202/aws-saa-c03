import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../app/context';
import { AiUserError } from '../ai/types';
import { LOCAL_CONNECT_ERROR } from '../ai/local';
import { createAiMode } from '../ai/ai-mode';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeSupport } from '../test/fake-support';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';
import { DEFAULT_LOCAL_SETTINGS } from '../ai/local-settings';
import { ContactAdminButton } from './ContactAdminButton';
import { LocalSettingsDialog } from './LocalSettingsDialog';

const USER = { uid: 'u1', name: 'An', email: 'an@x.com', emailVerified: true };

describe('ContactAdminButton', () => {
  it('đã đăng nhập: là nút, bấm mở khung Liên hệ admin kèm lỗi', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), support: fakeSupport() };
    renderApp('/', deps);
    act(() => auth.emit(USER));
    act(() => remote.emit('u1', new Map()));
    // Dựng nút bằng cách render thêm trong cùng provider.
    render(
      <AppProvider deps={deps}>
        <ContactAdminButton message="Lỗi thử" code="E1" />
      </AppProvider>,
    );
    const btn = screen.getByRole('button', { name: 'Liên hệ admin' });
    fireEvent.click(btn);
    const d = screen.getByRole('dialog', { name: 'Liên hệ admin' });
    expect(within(d).getByText('⚠ Lỗi đính kèm: Lỗi thử')).toBeInTheDocument();
  });

  it('admin đã đăng nhập: là nút, bấm mở hộp thư hỗ trợ (không có link email)', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), support: fakeSupport() };
    const admin = { uid: 'adm', name: 'Admin', email: 'buihngocanh2@gmail.com', emailVerified: true };
    renderApp('/', deps);
    act(() => auth.emit(admin));
    act(() => remote.emit('adm', new Map()));
    render(
      <AppProvider deps={deps}>
        <ContactAdminButton message="Lỗi thử" code="E1" />
      </AppProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Liên hệ admin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Liên hệ admin' }));
    expect(screen.getByRole('dialog', { name: 'Hộp thư hỗ trợ' })).toBeInTheDocument();
  });

  it('chưa đăng nhập: là nút, bấm mở popup đăng nhập; đăng nhập xong khung chat tự mở kèm lỗi', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), support: fakeSupport() };
    renderApp('/', deps);
    act(() => auth.emit(null));
    render(
      <AppProvider deps={deps}>
        <ContactAdminButton message="Lỗi thử" />
      </AppProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Liên hệ admin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Liên hệ admin' }));
    expect(screen.getByRole('dialog', { name: 'Đăng nhập' })).toBeInTheDocument();
    act(() => auth.emit(USER));
    act(() => remote.emit('u1', new Map()));
    const d = screen.getByRole('dialog', { name: 'Liên hệ admin' });
    expect(within(d).getByText('⚠ Lỗi đính kèm: Lỗi thử')).toBeInTheDocument();
  });

  it('không có Firebase (không đăng nhập được): không hiện nút', () => {
    render(
      <AppProvider deps={makeDeps()}>
        <ContactAdminButton message="Lỗi thử" />
      </AppProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Liên hệ admin' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Liên hệ admin' })).toBeNull();
  });

  it('english: nhãn Contact admin', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const sync = createSyncController({ store, auth: fakeAuth(), remote: fakeRemote() });
    render(
      <AppProvider deps={{ ...makeDeps({ store, sync }), support: fakeSupport() }}>
        <ContactAdminButton message="x" english />
      </AppProvider>,
    );
    expect(screen.getByRole('button', { name: 'Contact admin' })).toBeInTheDocument();
  });
});

describe('Nút Liên hệ admin ở các chỗ báo lỗi', () => {
  it('SignInDialog lỗi email: nút Liên hệ admin; đăng nhập xong khung chat mở kèm lỗi đó', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    renderApp('/', { ...makeDeps({ store, sync }), support: fakeSupport() });
    act(() => auth.emit(null));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email/Mật khẩu' }));
    const form = screen.getByRole('dialog', { name: 'Đăng nhập bằng email' });
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'an@example.com' } });
    fireEvent.change(within(form).getByLabelText('Mật khẩu'), { target: { value: 'secret1' } });
    auth.signInError = Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Đăng nhập' }));
    });
    const alert = within(form).getByRole('alert');
    expect(alert).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(within(form).queryByRole('link', { name: 'Liên hệ admin' })).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: 'Liên hệ admin' }));
    act(() => auth.emit(USER));
    act(() => remote.emit('u1', new Map()));
    const d = screen.getByRole('dialog', { name: 'Liên hệ admin' });
    expect(within(d).getByText('⚠ Lỗi đính kèm: Email hoặc mật khẩu không đúng.')).toBeInTheDocument();
  });

  it('AccountMenu lỗi (state error): nút Liên hệ admin mở popup đăng nhập', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const sync = createSyncController({ store, auth, remote: fakeRemote() });
    renderApp('/', { ...makeDeps({ store, sync }), support: fakeSupport() });
    act(() => auth.emit(null));
    auth.signInError = new Error('network down');
    await act(async () => {
      await sync.signIn({ kind: 'google' });
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Không đăng nhập được');
    expect(screen.queryByRole('link', { name: 'Liên hệ admin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Liên hệ admin' }));
    expect(screen.getByRole('dialog', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('Hỏi AI gửi lỗi kết nối: nút mở khung hỗ trợ với lỗi đó, khung Hỏi AI đóng', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const localAi = fakeAi();
    const base = makeDeps({ store, sync });
    const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
    store.save(attempt);
    renderApp('/exam/e1', { ...base, support: fakeSupport(), localAi, localChats: fakeChats(), aiMode: createAiMode(null) });
    act(() => auth.emit(USER));
    act(() => remote.emit('u1', new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
    localAi.reply = new AiUserError(LOCAL_CONNECT_ERROR);
    fireEvent.click(screen.getByRole('button', { name: /Chế độ AI thử nghiệm/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
    const chat = screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' });
    await waitFor(() => expect(within(chat).getByRole('button', { name: 'Gửi' })).toBeEnabled());
    fireEvent.change(within(chat).getByRole('textbox'), { target: { value: 'Tại sao?' } });
    await act(async () => {
      fireEvent.click(within(chat).getByRole('button', { name: 'Gửi' }));
    });
    fireEvent.click(await within(chat).findByRole('button', { name: 'Liên hệ admin' }));
    expect(screen.queryByRole('dialog', { name: 'Hỏi AI · Câu 1' })).toBeNull();
    const d = screen.getByRole('dialog', { name: 'Liên hệ admin' });
    expect(within(d).getByText(`⚠ Lỗi đính kèm: ${LOCAL_CONNECT_ERROR}`)).toBeInTheDocument();
  });

  it('LocalSettingsDialog lưu lỗi: có nút Liên hệ admin', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), support: fakeSupport() };
    render(
      <AppProvider deps={deps}>
        <LocalSettingsDialog initial={DEFAULT_LOCAL_SETTINGS} onSave={vi.fn(async () => Promise.reject(new Error('denied')))} onClose={() => {}} />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không lưu được cài đặt');
    expect(within(alert).getByRole('button', { name: 'Liên hệ admin' })).toBeInTheDocument();
  });
});

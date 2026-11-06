import { useEffect, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { isAdmin } from '../support/admin';
import { onRequestSignIn, openSupport } from '../support/open';
import type { AiModeStore } from '../ai/ai-mode';
import { useApp } from '../app/context';
import { ContactAdminButton } from './ContactAdminButton';
import { useAiMode } from './GeminiChat';
import { SignInDialog, SignInIcon } from './SignInDialog';
import type { SyncController, SyncUser } from '../sync/types';

function statusText(online: boolean, pending: number): string {
  if (!online) return 'Mất kết nối, sẽ đồng bộ khi có mạng';
  return pending > 0 ? 'Đang đồng bộ…' : 'Đã đồng bộ';
}

function Menu({ sync, english }: { sync: SyncController; english: boolean }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const [choosing, setChoosing] = useState(false);
  // Nút "Liên hệ admin" khi chưa đăng nhập nhờ mở popup đăng nhập.
  useEffect(() => onRequestSignIn(() => setChoosing(true)), []);
  if (state.kind === 'signed-out' || state.kind === 'error') {
    return (
      <span className="account">
        {state.kind === 'error' && (
          <span className="account__error" role="alert">
            {state.message}{' '}
            <ContactAdminButton message={state.message} english={english} />
          </span>
        )}
        <button type="button" className="icon-btn account__signin" onClick={() => setChoosing(true)}>
          <SignInIcon />
          {english ? 'Sign in' : 'Đăng nhập'}
        </button>
        {choosing && <SignInDialog sync={sync} english={english} onClose={() => setChoosing(false)} />}
      </span>
    );
  }
  // initializing: chưa biết đã đăng nhập hay chưa, không hiện nút đăng nhập rồi lại ẩn đi.
  if (state.kind === 'initializing' || state.kind === 'loading') return <span className="account__status">Đang tải…</span>;
  if (state.kind === 'conflict') return null;
  return <SignedInMenu sync={sync} user={state.user} online={state.online} pending={state.pending} english={english} />;
}

/**
 * Số tin hỗ trợ chưa đọc: người học 0/1 (unreadByUser), admin số thread unreadByAdmin.
 * Nghe một lần ở đây để cả chấm trên nút tài khoản lẫn mục trong menu cùng dùng.
 */
function useSupportUnread(user: SyncUser): number {
  const { support } = useApp();
  const admin = isAdmin(user);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!support) return;
    setUnread(0);
    if (admin) return support.listenInbox((list) => setUnread(list.filter((t) => t.unreadByAdmin).length), () => {});
    return support.listenOwnIndex(user.uid, (t) => setUnread(t?.unreadByUser ? 1 : 0));
  }, [support, admin, user.uid]);
  return unread;
}

function SignedInMenu({ sync, user, online, pending, english }: { sync: SyncController; user: SyncUser; online: boolean; pending: number; english: boolean }) {
  const unread = useSupportUnread(user);
  const dot = english ? 'New support message' : 'Có tin nhắn hỗ trợ mới';
  return (
    <details className="topbar__menu account">
      <summary className="account__summary">
        {user.photoURL && <img className="account__avatar" src={user.photoURL} alt="" width={24} height={24} referrerPolicy="no-referrer" />}
        <span>{user.name}</span>
        {/* Chấm báo tin mới thấy được khi menu còn đóng. */}
        {unread > 0 && <span className="support__dot" role="img" aria-label={dot} title={dot} />}
      </summary>
      <div className="topbar__menu-list account__panel">
        <p className="account__status">{statusText(online, pending)}</p>
        <AiModeToggle english={english} />
        <SupportEntry user={user} unread={unread} english={english} />
        <button type="button" className="icon-btn" onClick={() => void sync.signOut()}>
          {english ? 'Sign out' : 'Đăng xuất'}
        </button>
      </div>
    </details>
  );
}

/** Mục hỗ trợ: người học "Liên hệ admin", admin "Hộp thư hỗ trợ (n)". */
function SupportEntry({ user, unread, english }: { user: SyncUser; unread: number; english: boolean }) {
  const { support } = useApp();
  const admin = isAdmin(user);
  if (!support) return null;
  const open = (e: MouseEvent<HTMLButtonElement>) => {
    // Đóng menu để khung hỗ trợ không bị che.
    const details = e.currentTarget.closest('details');
    if (details) details.open = false;
    openSupport();
  };
  if (admin) {
    const label = english ? 'Support inbox' : 'Hộp thư hỗ trợ';
    return (
      <button type="button" className="icon-btn" onClick={open}>
        📥 {label}
        {unread > 0 ? ` (${unread})` : ''}
      </button>
    );
  }
  const label = english ? 'Contact admin' : 'Liên hệ admin';
  const fresh = english ? 'new message' : 'có tin mới';
  return (
    <button type="button" className="icon-btn" aria-label={unread > 0 ? `${label}, ${fresh}` : undefined} onClick={open}>
      💬 {label}
      {unread > 0 ? ` (${fresh})` : ''}
    </button>
  );
}

/** Bật/tắt chế độ AI thử nghiệm (LM Studio); chỉ có khi build có VITE_LOCAL_AI. */
function AiModeToggle({ english }: { english: boolean }) {
  const { aiMode } = useApp();
  return aiMode ? <Toggle aiMode={aiMode} english={english} /> : null;
}

function Toggle({ aiMode, english }: { aiMode: AiModeStore; english: boolean }) {
  const on = useAiMode(aiMode) === 'local';
  return (
    <button type="button" className="icon-btn account__ai-mode" aria-pressed={on} onClick={() => aiMode.set(on ? 'gemini' : 'local')}>
      🤖 {english ? 'Experimental AI mode' : 'Chế độ AI thử nghiệm'}: {on ? (english ? 'On' : 'Bật') : english ? 'Off' : 'Tắt'}
    </button>
  );
}

export function AccountMenu({ english }: { english: boolean }) {
  const { sync } = useApp();
  return sync ? <Menu sync={sync} english={english} /> : null;
}

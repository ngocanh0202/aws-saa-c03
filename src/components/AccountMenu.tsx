import { useEffect, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { isAdmin } from '../support/admin';
import { openSupport } from '../support/open';
import type { AiModeStore } from '../ai/ai-mode';
import { useApp } from '../app/context';
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
  if (state.kind === 'signed-out' || state.kind === 'error') {
    return (
      <span className="account">
        {state.kind === 'error' && (
          <span className="account__error" role="alert">
            {state.message}
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
  const { user, online, pending } = state;
  return (
    <details className="topbar__menu account">
      <summary className="account__summary">
        {user.photoURL && <img className="account__avatar" src={user.photoURL} alt="" width={24} height={24} referrerPolicy="no-referrer" />}
        <span>{user.name}</span>
      </summary>
      <div className="topbar__menu-list account__panel">
        <p className="account__status">{statusText(online, pending)}</p>
        <AiModeToggle english={english} />
        <SupportEntry user={user} english={english} />
        <button type="button" className="icon-btn" onClick={() => void sync.signOut()}>
          {english ? 'Sign out' : 'Đăng xuất'}
        </button>
      </div>
    </details>
  );
}

/** Mục hỗ trợ: người học "Liên hệ admin", admin "Hộp thư hỗ trợ (n)". Chỉ nghe dữ liệu khi đã đăng nhập. */
function SupportEntry({ user, english }: { user: SyncUser; english: boolean }) {
  const { support } = useApp();
  const admin = isAdmin(user);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!support) return;
    setUnread(0);
    if (admin) return support.listenInbox((list) => setUnread(list.filter((t) => t.unreadByAdmin).length), () => {});
    return support.listenOwnIndex(user.uid, (t) => setUnread(t?.unreadByUser ? 1 : 0));
  }, [support, admin, user.uid]);
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

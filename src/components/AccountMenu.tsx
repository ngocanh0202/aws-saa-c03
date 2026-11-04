import { useSyncExternalStore } from 'react';
import type { AiModeStore } from '../ai/ai-mode';
import { useApp } from '../app/context';
import { useAiMode } from './GeminiChat';
import type { SyncController } from '../sync/types';

function statusText(online: boolean, pending: number): string {
  if (!online) return 'Mất kết nối, sẽ đồng bộ khi có mạng';
  return pending > 0 ? 'Đang đồng bộ…' : 'Đã đồng bộ';
}

function Menu({ sync, english }: { sync: SyncController; english: boolean }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  if (state.kind === 'signed-out' || state.kind === 'error') {
    return (
      <span className="account">
        {state.kind === 'error' && (
          <span className="account__error" role="alert">
            {state.message}
          </span>
        )}
        <button type="button" className="icon-btn" onClick={() => void sync.signIn()}>
          {english ? 'Sign in with Google' : 'Đăng nhập Google'}
        </button>
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
        <button type="button" className="icon-btn" onClick={() => void sync.signOut()}>
          {english ? 'Sign out' : 'Đăng xuất'}
        </button>
      </div>
    </details>
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

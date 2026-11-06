import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { formatDate } from '../app/format';
import { isAdmin } from '../support/admin';
import { LIMITS, mailtoHref, type ErrorReport, type SupportMessage } from '../support/model';
import { onOpenSupport } from '../support/open';
import type { SupportStore } from '../support/types';
import type { SyncController, SyncUser } from '../sync/types';
import { claimChatFocus, onChatFocus } from './chat-focus';
import { signedInUser } from './GeminiChat';

const FOCUS_ID = 'support';

/** Chữ giao diện; màn hình Thi thật dùng tiếng Anh. */
const TEXT = {
  vi: {
    title: 'Liên hệ admin',
    close: 'Đóng',
    back: '← Quay lại',
    empty: 'Gửi câu hỏi hoặc báo lỗi cho admin. Admin sẽ trả lời ở đây.',
    attached: '⚠ Lỗi đính kèm: ',
    remove: 'Gỡ lỗi đính kèm',
    input: 'Tin nhắn cho admin',
    placeholder: 'Nhập tin nhắn…',
    send: 'Gửi',
    failed: 'Không gửi được. Kiểm tra mạng rồi thử lại, hoặc gửi email tới ',
    loadFailed: 'Không tải được tin nhắn.',
    error: 'Lỗi',
    code: 'Mã',
    page: 'Trang',
    at: 'Lúc',
  },
  en: {
    title: 'Contact admin',
    close: 'Close',
    back: '← Back',
    empty: 'Send a question or report a problem to the admin. Replies show up here.',
    attached: '⚠ Attached error: ',
    remove: 'Remove attached error',
    input: 'Message to admin',
    placeholder: 'Type a message…',
    send: 'Send',
    failed: 'Could not send. Check your connection and try again, or email ',
    loadFailed: 'Could not load messages.',
    error: 'Error',
    code: 'Code',
    page: 'Page',
    at: 'At',
  },
};
type Text = (typeof TEXT)['vi'];

/**
 * Khung chat hỗ trợ ở góc phải (cùng kiểu Hỏi AI). Chỉ hiện khi có đồng bộ, có store hỗ trợ và
 * đã đăng nhập; mở bằng `openSupport()`.
 */
export function SupportDock({ english }: { english: boolean }) {
  const { sync, support } = useApp();
  if (!sync || !support) return null;
  return <SignedIn sync={sync} support={support} english={english} />;
}

function SignedIn({ sync, support, english }: { sync: SyncController; support: SupportStore; english: boolean }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const user = signedInUser(state);
  if (!user) return null;
  // Admin: hộp thư hỗ trợ (Task 6).
  if (isAdmin(user)) return null;
  // key theo uid: đăng xuất/đổi tài khoản thì khung đóng hẳn, không gửi dưới uid cũ.
  return <UserDock key={user.uid} user={user} sync={sync} support={support} english={english} />;
}

function UserDock({ user, sync, support, english }: { user: SyncUser; sync: SyncController; support: SupportStore; english: boolean }) {
  const t = english ? TEXT.en : TEXT.vi;
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<ErrorReport | undefined>();
  useEffect(
    () =>
      onOpenSupport((req) => {
        claimChatFocus(FOCUS_ID);
        // Có lỗi mới thì thay lỗi cũ; chữ đang gõ giữ nguyên.
        if (req.error) setAttachment(req.error);
        setOpen(true);
      }),
    [],
  );
  useEffect(() => onChatFocus((other) => other !== FOCUS_ID && setOpen(false)), []);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="gemini-dock gemini" role="dialog" aria-label={t.title} lang={english ? 'en' : 'vi'}>
      <SupportThreadView
        uid={user.uid}
        reader="user"
        title={t.title}
        english={english}
        sender={user}
        sync={sync}
        support={support}
        onClose={close}
        attachment={attachment}
        onAttachmentChange={setAttachment}
      />
    </div>,
    document.body,
  );
}

interface ThreadProps {
  /** Cuộc trò chuyện của người học nào. */
  uid: string;
  /** Ai đang đọc: quyết định tin của ai nằm bên phải và cờ chưa đọc nào được xóa. */
  reader: 'user' | 'admin';
  title: string;
  onBack?: () => void;
  onClose: () => void;
  english?: boolean;
  /** Người đang gửi (tên/email ghi vào supportIndex khi là người học). */
  sender: SyncUser;
  sync: SyncController;
  support: SupportStore;
  attachment?: ErrorReport;
  onAttachmentChange?: (error: ErrorReport | undefined) => void;
}

/** Nội dung một cuộc trò chuyện hỗ trợ: thanh tiêu đề, danh sách tin, ô nhập. Dùng chung cho người học và admin. */
export function SupportThreadView({ uid, reader, title, onBack, onClose, english = false, sender, sync, support, attachment, onAttachmentChange }: ThreadProps) {
  const t = english ? TEXT.en : TEXT.vi;
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      support.listenThread(
        uid,
        (m) => {
          setLoadFailed(false);
          setMessages(m);
        },
        () => setLoadFailed(true),
      ),
    [support, uid],
  );

  // Đang mở mà có cờ chưa đọc của mình thì xóa (cả khi tin mới tới lúc khung đang mở).
  useEffect(
    () =>
      support.listenOwnIndex(uid, (thread) => {
        const unread = reader === 'user' ? thread?.unreadByUser : thread?.unreadByAdmin;
        if (unread) support.markRead(uid, reader).catch(() => undefined);
      }),
    [support, uid, reader],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    // Cắt theo giới hạn của rules, nếu không rules từ chối và người học thấy báo lỗi mạng sai.
    const text = input.trim().slice(0, LIMITS.text);
    if (busy || (!text && !attachment)) return;
    setBusy(true);
    setFailed(false);
    try {
      // Đã đăng xuất/đổi tài khoản giữa chừng thì không gửi.
      if (signedInUser(sync.getState())?.uid !== sender.uid) throw new Error('signed out');
      await support.send(uid, { from: reader, text, ...(attachment ? { error: attachment } : {}) }, { name: sender.name.slice(0, LIMITS.name), ...(sender.email ? { email: sender.email.slice(0, LIMITS.email) } : {}) });
      setInput('');
      onAttachmentChange?.(undefined);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };
  // Enter gửi, Shift+Enter xuống dòng; bỏ qua lúc đang gõ dấu bằng bộ gõ (IME).
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <header className="service-modal__bar">
        <div className="service-modal__title">
          <h1>{title}</h1>
        </div>
        <div className="gemini__tools">
          <button type="button" className="icon-btn" aria-label={t.close} title={t.close} onClick={onClose}>
            ✕
          </button>
        </div>
      </header>
      {onBack && (
        <button type="button" className="gemini__back" onClick={onBack}>
          {t.back}
        </button>
      )}
      <div className="service-modal__body">
        <div className="gemini__log" aria-live="polite">
          {loadFailed && <p className="gemini__notice">{t.loadFailed}</p>}
          {!loadFailed && messages.length === 0 && <p className="hint">{t.empty}</p>}
          {messages.map((m) => (
            // Tin của mình bên phải, của bên kia bên trái; chữ thường (không Markdown) vì do người dùng gõ.
            <div key={m.id} className={`gemini__msg support__msg gemini__msg--${m.from === reader ? 'user' : 'model'}`}>
              {m.text}
              {m.error && <ErrorBlock error={m.error} t={t} />}
            </div>
          ))}
          {failed && (
            <p className="gemini__notice" role="alert">
              {t.failed}
              <a href={mailtoHref(attachment)}>buihngocanh2@gmail.com</a>.
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>
      {attachment && (
        <div className="support__chip">
          <span>
            {t.attached}
            {attachment.message}
          </span>
          <button type="button" className="icon-btn" aria-label={t.remove} title={t.remove} onClick={() => onAttachmentChange?.(undefined)}>
            ✕
          </button>
        </div>
      )}
      <form className="gemini__form" onSubmit={onSubmit}>
        <textarea aria-label={t.input} rows={2} maxLength={LIMITS.text} value={input} placeholder={t.placeholder} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} />
        <button type="submit" className="btn-primary" disabled={busy || (!input.trim() && !attachment)}>
          {t.send}
        </button>
      </form>
    </>
  );
}

/** Khối lỗi trong bong bóng: câu báo, mã, trang, giờ. */
function ErrorBlock({ error, t }: { error: ErrorReport; t: Text }) {
  return (
    <dl className="support__error">
      <dt>{t.error}</dt>
      <dd>{error.message}</dd>
      {error.code && (
        <>
          <dt>{t.code}</dt>
          <dd>{error.code}</dd>
        </>
      )}
      <dt>{t.page}</dt>
      <dd>{error.page}</dd>
      <dt>{t.at}</dt>
      <dd>{formatDate(error.at)}</dd>
    </dl>
  );
}

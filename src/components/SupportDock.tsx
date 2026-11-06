import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { formatDate } from '../app/format';
import { isAdmin } from '../support/admin';
import { LIMITS, mailtoHref, type ErrorReport, type SupportMessage } from '../support/model';
import { onOpenSupport, type SupportRequest } from '../support/open';
import type { SupportStore } from '../support/types';
import type { SyncController, SyncUser } from '../sync/types';
import { claimChatFocus, onChatFocus } from './chat-focus';
import { signedInUser } from './GeminiChat';
import { SupportInbox } from './SupportInbox';

const FOCUS_ID = 'support';

/** Chữ giao diện; màn hình Thi thật dùng tiếng Anh. */
const TEXT = {
  vi: {
    title: 'Liên hệ admin',
    close: 'Đóng',
    back: '← Danh sách',
    empty: 'Gửi câu hỏi hoặc báo lỗi cho admin. Admin sẽ trả lời ở đây.',
    attached: '⚠ Lỗi đính kèm: ',
    remove: 'Gỡ lỗi đính kèm',
    input: 'Tin nhắn cho admin',
    placeholder: 'Nhập tin nhắn…',
    send: 'Gửi',
    failed: 'Không gửi được. Kiểm tra mạng rồi thử lại, hoặc gửi email tới ',
    tooFast: 'Gửi nhanh quá, đợi vài giây rồi gửi lại.',
    wait: 'Đợi vài giây rồi gửi tiếp',
    expand: 'Mở rộng',
    expandTitle: 'Mở rộng toàn màn hình',
    collapse: 'Thu nhỏ',
    closeWide: '✕ Đóng',
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
    tooFast: 'Sending too fast, wait a few seconds and try again.',
    wait: 'Wait a few seconds',
    expand: 'Expand',
    expandTitle: 'Expand to full screen',
    collapse: 'Collapse',
    closeWide: '✕ Close',
    loadFailed: 'Could not load messages.',
    error: 'Error',
    code: 'Code',
    page: 'Page',
    at: 'At',
  },
};
type Text = (typeof TEXT)['vi'];

/** Rules chỉ cho người học ghi supportIndex/{uid}/updatedAt cách lần trước ≥ 3 giây. */
const THROTTLE_MS = 3000;

/** Lỗi rules của Firebase (PERMISSION_DENIED); với tin hợp lệ thì gần như chỉ do gửi nhanh quá. */
function isPermissionDenied(e: unknown): boolean {
  const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
  return /permission[_ ]denied/i.test(`${String(code ?? '')} ${String(message ?? '')}`);
}

/** Phủ toàn màn hình hay khung nhỏ ở góc (giống Hỏi Gemini); phủ thì khóa cuộn trang. */
export function useExpanded(): [expanded: boolean, toggle: () => void] {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
  return [expanded, useCallback(() => setExpanded((x) => !x), [])];
}

/** Lớp và thuộc tính của khung theo trạng thái mở rộng. */
export function dockProps(expanded: boolean) {
  return { className: expanded ? 'service-modal gemini' : 'gemini-dock gemini', 'aria-modal': expanded || undefined };
}

/** Nút ⤢/⤡ và nút đóng ở thanh tiêu đề; dùng chung cho khung người học và hộp thư admin. */
export function DockTools({ expanded, onToggleExpand, onClose, english = false }: { expanded: boolean; onToggleExpand: () => void; onClose: () => void; english?: boolean }) {
  const t = english ? TEXT.en : TEXT.vi;
  return (
    <div className="gemini__tools">
      <button type="button" className="icon-btn" aria-label={expanded ? t.collapse : t.expand} title={expanded ? t.collapse : t.expandTitle} onClick={onToggleExpand}>
        {expanded ? '⤡' : '⤢'}
      </button>
      <button type="button" className={expanded ? 'service-modal__close' : 'icon-btn'} aria-label={t.close} title={t.close} onClick={onClose}>
        {expanded ? t.closeWide : '✕'}
      </button>
    </div>
  );
}

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
  // key theo uid: đăng xuất/đổi tài khoản thì khung đóng hẳn, không gửi dưới uid cũ.
  if (isAdmin(user)) return <SupportInbox key={user.uid} user={user} sync={sync} support={support} english={english} />;
  return <UserDock key={user.uid} user={user} sync={sync} support={support} english={english} />;
}

/**
 * Mở/đóng khung hỗ trợ: mở bằng `openSupport()` (giành quyền khung chat duy nhất), đóng khi khung
 * chat khác mở hoặc bấm Esc. Dùng chung cho người học và admin.
 */
export function useSupportOpen(onOpen?: (req: SupportRequest) => void): [open: boolean, close: () => void] {
  const [open, setOpen] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  useEffect(
    () =>
      onOpenSupport((req) => {
        claimChatFocus(FOCUS_ID);
        onOpenRef.current?.(req);
        setOpen(true);
      }),
    [],
  );
  useEffect(() => onChatFocus((other) => other !== FOCUS_ID && setOpen(false)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return [open, useCallback(() => setOpen(false), [])];
}

function UserDock({ user, sync, support, english }: { user: SyncUser; sync: SyncController; support: SupportStore; english: boolean }) {
  const t = english ? TEXT.en : TEXT.vi;
  const [attachment, setAttachment] = useState<ErrorReport | undefined>();
  // Có lỗi mới thì thay lỗi cũ; chữ đang gõ giữ nguyên.
  const [open, close] = useSupportOpen((req) => req.error && setAttachment(req.error));
  const [expanded, toggleExpand] = useExpanded();

  if (!open) return null;
  return createPortal(
    <div {...dockProps(expanded)} role="dialog" aria-label={t.title} lang={english ? 'en' : 'vi'}>
      <SupportThreadView
        uid={user.uid}
        reader="user"
        title={t.title}
        english={english}
        sender={user}
        sync={sync}
        support={support}
        onClose={close}
        expanded={expanded}
        onToggleExpand={toggleExpand}
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
  /** Khung đang phủ toàn màn hình (trạng thái giữ ở khung chứa). */
  expanded: boolean;
  onToggleExpand: () => void;
  english?: boolean;
  /** Người đang gửi (tên/email ghi vào supportIndex khi là người học). */
  sender: SyncUser;
  sync: SyncController;
  support: SupportStore;
  attachment?: ErrorReport;
  onAttachmentChange?: (error: ErrorReport | undefined) => void;
}

/** Nội dung một cuộc trò chuyện hỗ trợ: thanh tiêu đề, danh sách tin, ô nhập. Dùng chung cho người học và admin. */
export function SupportThreadView({ uid, reader, title, onBack, onClose, expanded, onToggleExpand, english = false, sender, sync, support, attachment, onAttachmentChange }: ThreadProps) {
  const t = english ? TEXT.en : TEXT.vi;
  const { now } = useApp();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<false | 'network' | 'tooFast'>(false);
  /** Người học: lúc sớm nhất rules cho gửi tiếp (updatedAt + 3 giây; tin admin cũng đổi updatedAt). */
  const [nextAt, setNextAt] = useState(0);
  const [waiting, setWaiting] = useState(false);
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
        if (reader === 'user') setNextAt(thread ? thread.updatedAt + THROTTLE_MS : 0);
        const unread = reader === 'user' ? thread?.unreadByUser : thread?.unreadByAdmin;
        if (unread) support.markRead(uid, reader).catch(() => undefined);
      }),
    [support, uid, reader],
  );

  // Tắt nút Gửi tới nextAt rồi tự bật lại.
  useEffect(() => {
    const left = nextAt - now();
    setWaiting(left > 0);
    if (left <= 0) return;
    const id = setTimeout(() => setWaiting(false), left);
    return () => clearTimeout(id);
  }, [nextAt, now]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    // Cắt theo giới hạn của rules, nếu không rules từ chối và người học thấy báo lỗi mạng sai.
    const text = input.trim().slice(0, LIMITS.text);
    if (busy || waiting || (!text && !attachment)) return;
    setBusy(true);
    setFailed(false);
    try {
      // Đã đăng xuất/đổi tài khoản giữa chừng thì không gửi.
      if (signedInUser(sync.getState())?.uid !== sender.uid) throw new Error('signed out');
      await support.send(uid, { from: reader, text, ...(attachment ? { error: attachment } : {}) }, {
        name: sender.name.slice(0, LIMITS.name),
        // Rules đòi email đúng bằng email đăng nhập: cắt thì chắc chắn bị từ chối, nên quá dài thì bỏ.
        ...(sender.email && sender.email.length <= LIMITS.email ? { email: sender.email } : {}),
      });
      setInput('');
      onAttachmentChange?.(undefined);
    } catch (e) {
      setFailed(isPermissionDenied(e) ? 'tooFast' : 'network');
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
        <DockTools expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose} english={english} />
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
          {failed === 'tooFast' && (
            <p className="gemini__notice" role="alert">
              {t.tooFast}
            </p>
          )}
          {failed === 'network' && (
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
      {waiting && <p className="hint support__wait">{t.wait}</p>}
      <form className="gemini__form" onSubmit={onSubmit}>
        <textarea aria-label={t.input} rows={2} maxLength={LIMITS.text} value={input} placeholder={t.placeholder} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} />
        <button type="submit" className="btn-primary" disabled={busy || waiting || (!input.trim() && !attachment)}>
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

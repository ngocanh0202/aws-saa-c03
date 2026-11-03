import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { buildSystemPrompt } from '../ai/prompt';
import { createSearchTool } from '../ai/search';
import type { AiChat, AiClient, ChatHistoryStore, ChatMessage } from '../ai/types';
import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';
import type { SyncController, SyncState, SyncUser } from '../sync/types';
import { Markdown } from './Markdown';

interface Props {
  attemptId: string;
  /** Vị trí câu trong lượt thi, bắt đầu từ 1. */
  number: number;
  question: Question;
  order: string[];
  /** Gọi khi câu trả lời có chữ đầu tiên (để gắn nhãn câu đã xem gợi ý). */
  onFirstReply: () => void;
}

/** User đang đăng nhập (kể cả lúc đang tải/xung đột dữ liệu); không có thì null. */
export function signedInUser(state: SyncState): SyncUser | null {
  return 'user' in state ? state.user : null;
}

const PREVIEW = 80;

function GeminiIcon() {
  const id = useId();
  return (
    <svg className="gemini-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill={`url(#${id})`} />
    </svg>
  );
}

/** Nút "Hỏi Gemini" cho câu đang làm ở Thi thử; chỉ hiện khi có AI và đã đăng nhập Google. */
export function GeminiButton(props: Props) {
  const { sync, ai, chats } = useApp();
  if (!sync || !ai || !chats) return null;
  return <SignedIn sync={sync} ai={ai} chats={chats} {...props} />;
}

function SignedIn({ sync, ...rest }: Props & { sync: SyncController; ai: AiClient; chats: ChatHistoryStore }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const user = signedInUser(state);
  // key theo uid: đăng xuất (hay đổi tài khoản) thì popup và cuộc trò chuyện bị bỏ hẳn.
  return user ? <Launcher key={user.uid} uid={user.uid} {...rest} /> : null;
}

function Launcher(props: Props & { uid: string; ai: AiClient; chats: ChatHistoryStore }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Như chat Messenger: khung chat mở ra thay chỗ nút, đóng lại thì nút hiện lại.
  return open ? (
    <ChatDialog {...props} onClose={close} />
  ) : (
    <button type="button" className="btn-gemini" aria-label="Hỏi Gemini" onClick={() => setOpen(true)}>
      <GeminiIcon />
      Hỏi Gemini
    </button>
  );
}

function ChatDialog({
  uid,
  ai,
  chats,
  attemptId,
  number,
  question,
  order,
  onFirstReply,
  onClose,
}: Props & { uid: string; ai: AiClient; chats: ChatHistoryStore; onClose: () => void }) {
  const qid = question.id;
  const { store, bank } = useApp();
  const [searching, setSearching] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  /** false = khung chat nhỏ ở góc (trang vẫn dùng được); true = phủ toàn màn hình. */
  const [expanded, setExpanded] = useState(false);
  const chatRef = useRef<AiChat | null>(null);
  // Popup đã đóng (Esc, đăng xuất…) thì bỏ phần stream còn lại, không cập nhật hay lưu gì nữa.
  const alive = useRef(true);
  // Luôn gọi bản onFirstReply mới nhất, kể cả khi stream bắt đầu từ lần render trước.
  const firstReply = useRef(onFirstReply);
  firstReply.current = onFirstReply;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      alive.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Chỉ khóa cuộn trang khi phủ toàn màn hình.
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [expanded]);

  useEffect(() => {
    let live = true;
    chats.load(uid, attemptId, qid).then(
      (saved) => live && setMessages(saved),
      () => live && setLoadFailed(true),
    ).finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [chats, uid, attemptId, qid]);

  useEffect(() => {
    if (loaded && !busy) inputRef.current?.focus();
  }, [loaded, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !loaded) return;
    const history = messages;
    const asked: ChatMessage[] = [...history, { role: 'user', text }];
    setInput('');
    setSendFailed(false);
    setSaveFailed(false);
    setBusy(true);
    setMessages(asked);
    let reply = '';
    try {
      // Một phiên chat cho mỗi lần mở popup; adapter tự cắt và chuẩn hóa history.
      // startChat có thể ném lỗi ngay (history không hợp lệ) nên nằm trong try.
      const setId = store.get(attemptId)?.setId ?? 0;
      const chat = (chatRef.current ??= ai.startChat(buildSystemPrompt(question, order), history, {
        tools: [createSearchTool(store, bank, { setId, attemptId, qid })],
        onToolCall: () => alive.current && setSearching(true),
      }));
      for await (const chunk of chat.send(text)) {
        if (!alive.current) return;
        if (!chunk) continue;
        setSearching(false);
        if (!reply) firstReply.current();
        reply += chunk;
        setMessages([...asked, { role: 'model', text: reply }]);
      }
      if (!alive.current) return;
      if (!reply) throw new Error('empty reply');
      chats.save(uid, attemptId, qid, [...asked, { role: 'model', text: reply }]).catch(() => {
        // Lần trả lời sau sẽ lưu lại toàn bộ; trong lúc đó báo để người dùng biết (vd: vượt giới hạn dung lượng).
        if (alive.current) setSaveFailed(true);
      });
    } catch {
      if (alive.current) setSendFailed(true);
    } finally {
      if (alive.current) {
        setBusy(false);
        setSearching(false);
      }
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

  const stem = question.html ? htmlToText(question.stem) : question.stem;
  const preview = stem.length > PREVIEW ? `${stem.slice(0, PREVIEW).trimEnd()}…` : stem;

  return createPortal(
    <div
      className={expanded ? 'service-modal gemini' : 'gemini-dock gemini'}
      role="dialog"
      aria-modal={expanded || undefined}
      aria-labelledby="gemini-title"
      lang="vi"
    >
      <header className="service-modal__bar">
        <div className="service-modal__title">
          <h1 id="gemini-title">Hỏi Gemini · Câu {number}</h1>
          <p className="hint gemini__stem">{preview}</p>
        </div>
        <div className="gemini__tools">
          <button
            type="button"
            className="icon-btn"
            aria-label={expanded ? 'Thu nhỏ' : 'Mở rộng'}
            title={expanded ? 'Thu nhỏ' : 'Mở rộng toàn màn hình'}
            onClick={() => setExpanded((x) => !x)}
          >
            {expanded ? '⤡' : '⤢'}
          </button>
          <button type="button" className={expanded ? 'service-modal__close' : 'icon-btn'} aria-label="Đóng" title="Đóng (Esc)" onClick={onClose}>
            {expanded ? '✕ Đóng' : '✕'}
          </button>
        </div>
      </header>
      <div className="service-modal__body">
        <div className="gemini__log" aria-live="polite">
          {loadFailed && <p className="gemini__notice">Không tải được lịch sử trò chuyện.</p>}
          {loaded && messages.length === 0 && !loadFailed && (
            <p className="hint">Hỏi bất cứ điều gì về câu này, ví dụ vì sao một lựa chọn sai.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`gemini__msg gemini__msg--${m.role}`}>
              {m.role === 'model' ? <Markdown text={m.text} /> : m.text}
            </div>
          ))}
          {busy && messages[messages.length - 1]?.role === 'user' && (
            <p className="hint">{searching ? 'Gemini đang tìm trong các câu bạn đã làm…' : 'Gemini đang trả lời…'}</p>
          )}
          {sendFailed && (
            <p className="gemini__notice" role="alert">
              Gemini chưa trả lời được, thử gửi lại nhé.
            </p>
          )}
          {saveFailed && <p className="gemini__notice">Không lưu được lịch sử trò chuyện.</p>}
          <div ref={endRef} />
        </div>
      </div>
      <form className="gemini__form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          aria-label="Câu hỏi cho Gemini"
          rows={2}
          value={input}
          disabled={busy || !loaded}
          placeholder="Nhập câu hỏi…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn-primary" disabled={busy || !loaded}>
          Gửi
        </button>
      </form>
    </div>,
    document.body,
  );
}

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { formatDate, setLabel } from '../app/format';
import { buildSystemPrompt } from '../ai/prompt';
import { createSearchTool } from '../ai/search';
import type { AiChat, AiClient, ChatHistoryStore, ChatMessage, ChatSummary } from '../ai/types';
import { htmlToText } from '../data/html-text';
import { markGuideOpened } from '../engine/actions';
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

/** Cuộc trò chuyện đang mở trong khung: câu đang làm (home) hoặc một câu ở lượt cũ. */
interface Target {
  attemptId: string;
  number: number;
  question: Question;
  order: string[];
  setId: number;
  onFirstReply: () => void;
}

const keyOf = (attemptId: string, qid: number) => `${attemptId}/${qid}`;

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
  const { store, bank } = useApp();
  /** false = khung chat nhỏ ở góc (trang vẫn dùng được); true = phủ toàn màn hình. */
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'chat' | 'list'>('chat');
  /** null = câu đang làm. */
  const [picked, setPicked] = useState<{ attemptId: string; qid: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const homeSetId = store.get(attemptId)?.setId ?? 0;
  const home: Target = { attemptId, number, question, order, setId: homeSetId, onFirstReply };
  const homeLabel = `${setLabel(homeSetId)} · Câu ${number}`;

  /** Dựng cuộc trò chuyện ở lượt cũ; lượt hay câu không còn thì null. */
  const resolve = (id: string, qid: number): Target | null => {
    const a = store.get(id);
    const index = a ? a.questions.findIndex((q) => q.qid === qid) : -1;
    const q = bank.questions.get(qid);
    if (!a || a.status === 'incompatible' || index < 0 || !q) return null;
    return {
      attemptId: id,
      number: index + 1,
      question: q,
      order: a.questions[index].optionOrder,
      setId: a.setId,
      // Như mở hướng dẫn, nhưng chỉ với lượt Thi thử còn dở; lượt đã nộp thì không đổi.
      onFirstReply: () => {
        const latest = store.get(id);
        if (latest?.mode === 'practice' && latest.status === 'in-progress' && !latest.guideOpened.includes(qid)) {
          store.save(markGuideOpened(latest, qid));
        }
      },
    };
  };

  const isHome = !picked || (picked.attemptId === attemptId && picked.qid === question.id);
  const target = (!isHome && picked && resolve(picked.attemptId, picked.qid)) || home;
  const atHome = target === home;

  const stem = target.question.html ? htmlToText(target.question.stem) : target.question.stem;
  const preview = stem.length > PREVIEW ? `${stem.slice(0, PREVIEW).trimEnd()}…` : stem;
  const title =
    view === 'list' ? 'Trò chuyện cũ' : atHome ? `Hỏi Gemini · Câu ${number}` : `Hỏi Gemini · ${setLabel(target.setId)} · Câu ${target.number}`;

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
          <h1 id="gemini-title">{title}</h1>
          {view === 'chat' && <p className="hint gemini__stem">{preview}</p>}
        </div>
        <div className="gemini__tools">
          <button
            type="button"
            className="icon-btn"
            aria-label="Trò chuyện cũ"
            aria-pressed={view === 'list'}
            title="Trò chuyện cũ"
            disabled={busy}
            onClick={() => setView((v) => (v === 'list' ? 'chat' : 'list'))}
          >
            🕘
          </button>
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
      {view === 'list' ? (
        <ChatList
          uid={uid}
          chats={chats}
          home={{ attemptId, qid: question.id, label: homeLabel }}
          resolve={resolve}
          onPick={(id, qid) => {
            setPicked({ attemptId: id, qid });
            setView('chat');
          }}
        />
      ) : (
        <>
          {!atHome && (
            <button type="button" className="gemini__back" disabled={busy} onClick={() => setPicked(null)}>
              ← Quay lại {homeLabel}
            </button>
          )}
          <Conversation key={keyOf(target.attemptId, target.question.id)} uid={uid} ai={ai} chats={chats} target={target} onBusy={setBusy} />
        </>
      )}
    </div>,
    document.body,
  );
}

function ChatList({
  uid,
  chats,
  home,
  resolve,
  onPick,
}: {
  uid: string;
  chats: ChatHistoryStore;
  home: { attemptId: string; qid: number; label: string };
  resolve: (attemptId: string, qid: number) => Target | null;
  onPick: (attemptId: string, qid: number) => void;
}) {
  const [items, setItems] = useState<ChatSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    chats.list(uid).then(
      (list) => live && setItems(list),
      () => live && setItems([]),
    );
    return () => {
      live = false;
    };
  }, [chats, uid]);

  // Bỏ câu đang làm (đã đứng đầu) và cuộc trò chuyện của lượt không còn trong máy.
  const others = (items ?? [])
    .filter((c) => keyOf(c.attemptId, c.qid) !== keyOf(home.attemptId, home.qid))
    .map((c) => ({ c, t: resolve(c.attemptId, c.qid) }))
    .filter((x): x is { c: ChatSummary; t: Target } => x.t !== null)
    .sort((x, y) => y.c.updatedAt - x.c.updatedAt);

  return (
    <div className="service-modal__body">
      <ul className="gemini__list">
        <li>
          <button type="button" className="gemini__item is-current" onClick={() => onPick(home.attemptId, home.qid)}>
            <strong>{home.label}</strong> <span className="hint">(câu đang làm)</span>
          </button>
        </li>
        {others.map(({ c, t }) => (
          <li key={keyOf(c.attemptId, c.qid)}>
            <button type="button" className="gemini__item" onClick={() => onPick(c.attemptId, c.qid)}>
              <strong>
                {setLabel(t.setId)} · Câu {t.number}
              </strong>{' '}
              <span className="hint">· {formatDate(c.updatedAt)}</span>
              <small>{c.last}</small>
            </button>
          </li>
        ))}
      </ul>
      {items === null ? (
        <p className="hint gemini__empty">Đang tải…</p>
      ) : (
        others.length === 0 && <p className="hint gemini__empty">Chưa có cuộc trò chuyện nào.</p>
      )}
    </div>
  );
}

function Conversation({
  uid,
  ai,
  chats,
  target,
  onBusy,
}: {
  uid: string;
  ai: AiClient;
  chats: ChatHistoryStore;
  target: Target;
  /** Báo khung ngoài để khóa chuyển cuộc trò chuyện khi đang trả lời (chuyển đi sẽ bỏ câu trả lời). */
  onBusy: (busy: boolean) => void;
}) {
  const { attemptId, question, order, setId } = target;
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
  const chatRef = useRef<AiChat | null>(null);
  // Khung đã đóng hay đã chuyển sang cuộc trò chuyện khác thì bỏ phần stream còn lại, không cập nhật hay lưu gì nữa.
  const alive = useRef(true);
  // Luôn gọi bản onFirstReply mới nhất, kể cả khi stream bắt đầu từ lần render trước.
  const firstReply = useRef(target.onFirstReply);
  firstReply.current = target.onFirstReply;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => onBusy(busy), [busy, onBusy]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
      // Phiên có thể kẹt ở lượt gọi tool chưa có kết quả; lần gửi sau mở phiên mới từ lịch sử chữ.
      chatRef.current = null;
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

  return (
    <>
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
    </>
  );
}

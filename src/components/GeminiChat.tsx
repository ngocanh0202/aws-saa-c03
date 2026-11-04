import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { formatDate, setLabel } from '../app/format';
import { createGuideTool } from '../ai/guide-tool';
import { buildSystemPrompt } from '../ai/prompt';
import { memoryCooldownFor, type Cooldown } from '../ai/cooldown';
import { inflightFor, inflightKey } from '../ai/inflight';
import { AiBusyError } from '../ai/retry';
import { SEARCH_TOOL, createSearchTool } from '../ai/search';
import { TITLE_MAX, type AiChat, type AiClient, type ChatHistoryStore, type ChatMessage, type ChatSummary } from '../ai/types';
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
  /**
   * Mở hướng dẫn như bấm nút (Gemini gọi tool open_guide khi người học xin đáp án). Không truyền
   * (bài đã nộp…) thì Gemini không có tool này.
   */
  onOpenGuide?: () => void;
  /** Người học đã thấy đáp án và hướng dẫn; mặc định true khi không có onOpenGuide. */
  revealed?: boolean;
  /** Nút nằm trong khối câu (trang xem lại có nhiều câu) thay vì nổi ở góc phải. */
  inline?: boolean;
}

/** Chỉ một khung chat mở tại một thời điểm: mở khung này thì báo các khung khác đóng lại. */
const openListeners = new Set<(id: string) => void>();

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

function Launcher({ inline, ...props }: Props & { uid: string; ai: AiClient; chats: ChatHistoryStore }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const onOther = (other: string) => other !== id && setOpen(false);
    openListeners.add(onOther);
    return () => void openListeners.delete(onOther);
  }, [id]);
  const show = () => {
    for (const l of [...openListeners]) l(id);
    setOpen(true);
  };
  // Như chat Messenger: khung chat mở ra thay chỗ nút, đóng lại thì nút hiện lại.
  return open ? (
    <ChatDialog {...props} onClose={close} />
  ) : (
    <button type="button" className={inline ? 'btn-gemini btn-gemini--inline' : 'btn-gemini'} aria-label="Hỏi Gemini" onClick={show}>
      <GeminiIcon />
      Hỏi Gemini
    </button>
  );
}

/** "Đề 3" → "Đ3", "Main 1" → "M1" (tiêu đề khung chat trên mobile). */
const shortSetLabel = (setId: number) => (setId > 100 ? `M${setId - 100}` : `Đ${setId}`);

/** Cuộc trò chuyện đang mở trong khung: câu đang làm (home) hoặc một câu ở lượt cũ. */
interface Target {
  attemptId: string;
  number: number;
  question: Question;
  order: string[];
  setId: number;
  onOpenGuide?: () => void;
  revealed: boolean;
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
  onOpenGuide,
  revealed,
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
  const home: Target = { attemptId, number, question, order, setId: homeSetId, onOpenGuide, revealed: revealed ?? !onOpenGuide };
  const homeLabel = `${setLabel(homeSetId)} · Câu ${number}`;

  /** Dựng cuộc trò chuyện ở lượt cũ; lượt hay câu không còn thì null. */
  const resolve = (id: string, qid: number): Target | null => {
    const a = store.get(id);
    const index = a ? a.questions.findIndex((q) => q.qid === qid) : -1;
    const q = bank.questions.get(qid);
    if (!a || a.status === 'incompatible' || index < 0 || !q) return null;
    const open = a.mode === 'practice' && a.status === 'in-progress';
    return {
      attemptId: id,
      number: index + 1,
      question: q,
      order: a.questions[index].optionOrder,
      setId: a.setId,
      // Mở hướng dẫn chỉ có nghĩa với lượt Thi thử còn dở; lượt đã nộp thì không đổi gì.
      ...(open
        ? {
            onOpenGuide: () => {
              const latest = store.get(id);
              // Câu trả lời chạy nền có thể tới sau khi lượt đã nộp: lượt đã nộp thì không sửa.
              if (latest?.mode === 'practice' && latest.status === 'in-progress' && !latest.guideOpened.includes(qid)) {
                store.save(markGuideOpened(latest, qid));
              }
            },
            revealed: a.guideOpened.includes(qid),
          }
        : { revealed: true }),
    };
  };

  const isHome = !picked || (picked.attemptId === attemptId && picked.qid === question.id);
  const target = (!isHome && picked && resolve(picked.attemptId, picked.qid)) || home;
  const atHome = target === home;

  const stem = target.question.html ? htmlToText(target.question.stem) : target.question.stem;
  const preview = stem.length > PREVIEW ? `${stem.slice(0, PREVIEW).trimEnd()}…` : stem;
  const title =
    view === 'list' ? 'Trò chuyện cũ' : atHome ? `Hỏi Gemini · Câu ${number}` : `Hỏi Gemini · ${setLabel(target.setId)} · Câu ${target.number}`;
  // Bản gọn cho mobile: "Gemini Đ3 · Câu 12" / "Gemini M1 · Câu 5".
  const shortLabel = view === 'list' ? null : atHome ? `Câu ${number}` : `${shortSetLabel(target.setId)} · Câu ${target.number}`;

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
          {/* Tên đầy đủ cho trình đọc màn hình (aria-label); CSS chọn bản dài hay bản gọn để hiển thị. */}
          <h1 id="gemini-title" aria-label={title}>
            <span className="gemini__title-full" aria-hidden="true">
              {title}
            </span>
            <span className="gemini__title-short" aria-hidden="true">
              {shortLabel === null ? (
                title
              ) : (
                <>
                  <span className="gemini__brand">Gemini</span> {shortLabel}
                </>
              )}
            </span>
          </h1>
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
          home={{ attemptId, qid: question.id, setId: homeSetId, label: homeLabel }}
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

/** Chuỗi để tìm: không phân biệt hoa thường và dấu tiếng Việt, gộp khoảng trắng. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    // Dấu câu ("·", ",") thành khoảng trắng để "de 1 cau 3" khớp "Đề 1 · Câu 3"; giữ / và : của ngày giờ.
    .replace(/[^\p{L}\p{N}/:]+/gu, ' ')
    .trim();
}

interface Row {
  c: ChatSummary;
  t: Target;
  key: string;
  /** "<đề> · Câu <n>". */
  defaultName: string;
  current: boolean;
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
  home: { attemptId: string; qid: number; setId: number; label: string };
  resolve: (attemptId: string, qid: number) => Target | null;
  onPick: (attemptId: string, qid: number) => void;
}) {
  const [items, setItems] = useState<ChatSummary[] | null>(null);
  /** Mặc định chỉ hiện cuộc trò chuyện về câu đang làm, ở mọi lượt cùng đề. */
  const [onlyThis, setOnlyThis] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [renameFailed, setRenameFailed] = useState(false);
  // Thông báo lỗi đổi tên tự tắt sau 5 giây.
  useEffect(() => {
    if (!renameFailed) return;
    const t = setTimeout(() => setRenameFailed(false), 5000);
    return () => clearTimeout(t);
  }, [renameFailed]);
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

  const homeKey = keyOf(home.attemptId, home.qid);
  // Bỏ cuộc trò chuyện của lượt không còn trong máy.
  const rows: Row[] = (items ?? [])
    .map((c) => ({ c, t: resolve(c.attemptId, c.qid) }))
    .filter((x): x is { c: ChatSummary; t: Target } => x.t !== null)
    .map(({ c, t }) => ({ c, t, key: keyOf(c.attemptId, c.qid), defaultName: `${setLabel(t.setId)} · Câu ${t.number}`, current: keyOf(c.attemptId, c.qid) === homeKey }))
    .sort((x, y) => y.c.updatedAt - x.c.updatedAt);

  const q = normalizeSearch(query);
  const searching = q.length > 0;
  const pinned = !searching && onlyThis;
  const shown = searching
    ? rows.filter((r) => [r.c.title ?? '', r.defaultName, formatDate(r.c.updatedAt)].some((s) => normalizeSearch(s).includes(q)))
    : onlyThis
      ? rows.filter((r) => !r.current && r.c.qid === home.qid && r.t.setId === home.setId)
      : rows;
  const homeRow = rows.find((r) => r.current);

  // Bỏ lọc hay đang tìm thì nhóm theo bộ đề, nhóm có hoạt động gần nhất lên trước (rows đã sắp mới nhất trước).
  const groups: { setId: number; rows: Row[] }[] = [];
  for (const r of shown) {
    const g = groups.find((x) => x.setId === r.t.setId);
    if (g) g.rows.push(r);
    else groups.push({ setId: r.t.setId, rows: [r] });
  }

  const save = async (r: Row) => {
    const title = draft.trim().slice(0, TITLE_MAX) || null;
    setEditing(null);
    try {
      await chats.rename(uid, r.c.attemptId, r.c.qid, title);
      setRenameFailed(false);
      setItems((list) => list && list.map((c) => (c === r.c ? { ...c, title: title ?? undefined } : c)));
    } catch {
      setRenameFailed(true);
    }
  };

  const item = (r: Row | undefined, opts: { label?: string } = {}) => {
    const key = r?.key ?? homeKey;
    const name = r?.c.title || r?.defaultName || opts.label!;
    if (r && editing === r.key) {
      return (
        <li key={key} className="gemini__row">
          <input
            className="gemini__rename"
            aria-label="Tên cuộc trò chuyện"
            autoFocus
            maxLength={TITLE_MAX}
            value={draft}
            placeholder={r.defaultName}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save(r);
              } else if (e.key === 'Escape') {
                // Không để Esc đóng cả khung chat.
                e.stopPropagation();
                setEditing(null);
              }
            }}
          />
        </li>
      );
    }
    return (
      <li key={key} className="gemini__row">
        <button
          type="button"
          className={`gemini__item${key === homeKey ? ' is-current' : ''}`}
          onClick={() => (r ? onPick(r.c.attemptId, r.c.qid) : onPick(home.attemptId, home.qid))}
        >
          <strong>{name}</strong>
          {key === homeKey && <span className="hint"> (câu đang làm)</span>}
          {r && <span className="hint"> · {formatDate(r.c.updatedAt)}</span>}
          {r?.c.title && <small>{r.defaultName}</small>}
          {r && <small>{r.c.last}</small>}
        </button>
        {r && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Đổi tên"
            title="Đổi tên"
            onClick={() => {
              setDraft(r.c.title ?? '');
              setEditing(r.key);
              setRenameFailed(false);
            }}
          >
            ✎
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="service-modal__body">
      <div className="gemini__filters">
        <input
          type="search"
          aria-label="Tìm cuộc trò chuyện"
          placeholder="Tìm theo tên hoặc ngày…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> Chỉ câu này
        </label>
      </div>
      {renameFailed && <p className="gemini__notice">Không đổi được tên.</p>}
      {pinned ? (
        <ul className="gemini__list">
          {item(homeRow, { label: home.label })}
          {shown.map((r) => item(r))}
        </ul>
      ) : (
        groups.map((g) => (
          <section key={g.setId} className="gemini__group">
            <h2>{setLabel(g.setId)}</h2>
            <ul className="gemini__list">{g.rows.map((r) => item(r))}</ul>
          </section>
        ))
      )}
      {items === null ? (
        <p className="hint gemini__empty">Đang tải…</p>
      ) : (
        shown.length === 0 && (
          <p className="hint gemini__empty">
            {searching ? 'Không tìm thấy cuộc trò chuyện nào.' : onlyThis ? 'Chưa có cuộc trò chuyện nào về câu này.' : 'Chưa có cuộc trò chuyện nào.'}
          </p>
        )
      )}
    </div>
  );
}

/** Giờ hết khóa Gemini (null = không khóa); tự cập nhật mỗi giây để đếm ngược. */
function useCooldown(cooldown: Cooldown): number | null {
  const [, tick] = useState(0);
  useEffect(() => cooldown.subscribe(() => tick((x) => x + 1)), [cooldown]);
  const until = cooldown.until();
  useEffect(() => {
    if (until === null) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until;
}

const secondsLeft = (until: number) => Math.max(1, Math.ceil((until - Date.now()) / 1000));
const clockTime = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

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
  /** Báo khung ngoài để khóa chuyển cuộc trò chuyện khi đang trả lời. */
  onBusy: (busy: boolean) => void;
}) {
  const { attemptId, question, order, setId } = target;
  const qid = question.id;
  const key = inflightKey(uid, attemptId, qid);
  const { store, bank, sync, aiCooldown } = useApp();
  const inflight = inflightFor(chats);
  const cooldown = aiCooldown ?? memoryCooldownFor(ai);
  const until = useCooldown(cooldown);
  // Câu trả lời còn chạy từ lần mở khung trước (đã sang câu khác rồi quay lại): theo dõi tiếp.
  const [running] = useState(() => inflight.get(key));
  const [searching, setSearching] = useState(running?.searching ?? false);
  const [messages, setMessages] = useState<ChatMessage[]>(running?.messages ?? []);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  /** Lần gửi trước hỏng vì Gemini hết lượt/quá tải. */
  const [busyFailed, setBusyFailed] = useState(false);
  /** Đang chờ để tự thử lại (lần mấy / tối đa). */
  const [retry, setRetry] = useState(running?.retry);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(running !== undefined);
  const [input, setInput] = useState('');
  const chatRef = useRef<AiChat | null>(null);
  // Đã nhận tin từ câu trả lời đang chạy thì lịch sử tải về (có thể cũ hơn) không được ghi đè.
  const fromInflight = useRef(running !== undefined);
  // Luôn gọi bản onOpenGuide mới nhất, kể cả khi stream bắt đầu từ lần render trước.
  const openGuide = useRef(target.onOpenGuide);
  openGuide.current = target.onOpenGuide;
  // Trạng thái "đã thấy đáp án" mà phiên chat hiện tại được báo; đổi thì mở phiên mới để Gemini biết.
  const sessionRevealed = useRef(target.revealed);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => onBusy(busy), [busy, onBusy]);

  useEffect(
    () =>
      inflight.subscribe(key, (e) => {
        fromInflight.current = true;
        if (e.kind === 'save-failed') return setSaveFailed(true);
        setMessages(e.messages);
        setBusy(e.kind === 'progress');
        setSearching(e.kind === 'progress' && e.searching);
        setRetry(e.kind === 'progress' ? e.retry : undefined);
        if (e.kind === 'done') {
          setSendFailed(e.failed);
          setBusyFailed(e.failed && !!e.busy);
        }
      }),
    [inflight, key],
  );

  useEffect(() => {
    let live = true;
    chats.load(uid, attemptId, qid).then(
      (saved) => live && !fromInflight.current && setMessages(saved),
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

  /**
   * Chạy ở nền, không phụ thuộc khung chat còn mở hay không: mọi cập nhật đi qua `inflight`, khung
   * nào đang mở câu này thì nhận. Chỉ dừng (không lưu) khi user đã đăng xuất hay đổi tài khoản.
   */
  const send = async () => {
    const text = input.trim();
    if (!text || busy || !loaded || cooldown.until() !== null) return;
    const history = messages;
    const asked: ChatMessage[] = [...history, { role: 'user', text }];
    const signedIn = () => !sync || signedInUser(sync.getState())?.uid === uid;
    setInput('');
    setSendFailed(false);
    setBusyFailed(false);
    setSaveFailed(false);
    let reply = '';
    let searchingNow = false;
    let retryNow: { attempt: number; max: number } | undefined;
    // Gemini gọi open_guide thì chờ trả lời xong mới mở hướng dẫn (lỗi giữa chừng thì không mở).
    let guideRequested = false;
    const progress = () =>
      inflight.emit(key, {
        kind: 'progress',
        messages: reply ? [...asked, { role: 'model', text: reply }] : asked,
        searching: searchingNow,
        retry: retryNow,
      });
    progress();
    try {
      // Một phiên chat cho mỗi lần mở khung; adapter tự cắt và chuẩn hóa history.
      // startChat có thể ném lỗi ngay (history không hợp lệ) nên nằm trong try.
      if (chatRef.current && sessionRevealed.current !== target.revealed) chatRef.current = null;
      sessionRevealed.current = target.revealed;
      const prompt = buildSystemPrompt(question, order, { vi: bank.vi.get(qid), note: bank.meta.get(qid)?.note, revealed: target.revealed });
      const chat = (chatRef.current ??= ai.startChat(prompt, history, {
        tools: [
          createSearchTool(store, bank, { setId, attemptId, qid }),
          ...(target.onOpenGuide
            ? [
                createGuideTool(() => {
                  guideRequested = true;
                }),
              ]
            : []),
        ],
        onToolCall: (name) => {
          // Dòng chờ "đang tìm" chỉ dành cho tool tìm câu.
          if (name !== SEARCH_TOOL) return;
          searchingNow = true;
          progress();
        },
        // Gemini hết lượt/quá tải: khóa mọi khung chat tới giờ thử lại và hiện đếm ngược.
        retry: {
          onWait: (w) => {
            cooldown.set(w.until);
            retryNow = { attempt: w.attempt, max: w.max };
            progress();
          },
        },
      }));
      for await (const chunk of chat.send(text)) {
        if (!signedIn()) throw new Error('signed out');
        if (!chunk) continue;
        searchingNow = false;
        retryNow = undefined;
        reply += chunk;
        progress();
      }
      if (!reply) throw new Error('empty reply');
      if (!signedIn()) throw new Error('signed out');
      const done: ChatMessage[] = [...asked, { role: 'model', text: reply }];
      inflight.emit(key, { kind: 'done', messages: done, failed: false });
      if (guideRequested) openGuide.current?.();
      chats.save(uid, attemptId, qid, done).catch(() => {
        // Lần trả lời sau sẽ lưu lại toàn bộ; trong lúc đó báo để người dùng biết (vd: vượt giới hạn dung lượng).
        inflight.emit(key, { kind: 'save-failed' });
      });
    } catch (e) {
      // Phiên có thể kẹt ở lượt gọi tool chưa có kết quả; lần gửi sau mở phiên mới từ lịch sử chữ.
      chatRef.current = null;
      const busyError = e instanceof AiBusyError;
      // Gemini báo phải chờ (quá lâu để tự chờ, hoặc đã thử lại hết lượt): khóa tới giờ đó.
      if (busyError && e.retryAfterMs) cooldown.set(Date.now() + e.retryAfterMs);
      inflight.emit(key, { kind: 'done', messages: reply ? [...asked, { role: 'model', text: reply }] : asked, failed: true, busy: busyError });
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
            <p className="hint">
              {retry && until !== null
                ? `Gemini đang hết lượt, tự thử lại sau ${secondsLeft(until)} giây… (lần ${retry.attempt}/${retry.max})`
                : searching
                  ? 'Gemini đang tìm trong các câu bạn đã làm…'
                  : 'Gemini đang trả lời…'}
            </p>
          )}
          {!busy && until !== null ? (
            <p className="gemini__notice" role="alert">
              Gemini đang hết lượt. Thử lại sau {secondsLeft(until)} giây (lúc {clockTime(until)}).
            </p>
          ) : (
            sendFailed && (
              <p className="gemini__notice" role="alert">
                {busyFailed ? 'Gemini đang hết lượt, thử lại sau ít phút.' : 'Gemini chưa trả lời được, thử gửi lại nhé.'}
              </p>
            )
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
        <button type="submit" className="btn-primary" disabled={busy || !loaded || until !== null}>
          Gửi
        </button>
      </form>
    </>
  );
}

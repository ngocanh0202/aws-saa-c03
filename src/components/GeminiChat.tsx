import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { formatDate, setLabel } from '../app/format';
import { buildSystemPrompt } from '../ai/prompt';
import type { AiModeStore } from '../ai/ai-mode';
import { memoryCooldownFor, type Cooldown } from '../ai/cooldown';
import { AiGateBusyError, targetKey, useAiGate, type AiJobTarget } from '../ai/gate';
import { inflightFor, inflightKey, type InflightRegistry } from '../ai/inflight';
import { DEFAULT_LOCAL_SETTINGS, type LocalAiSettings, type LocalSettingsStore } from '../ai/local-settings';
import { AiBusyError } from '../ai/retry';
import { SEARCH_TOOL, createSearchTool } from '../ai/search';
import { createIdleWatchdog, type IdleWatchdog } from '../ai/watchdog';
import { SIMILAR_THRESHOLD, findCachedReply, similarity } from '../ai/similar';
import { HIGHLIGHT_SUGGESTION, chatSuggestions } from '../ai/suggestions';
import { pickFollowups, splitFollowups, visibleReply } from '../ai/followups';
import { HIGHLIGHT_TOOL, createHighlightTool } from '../ai/highlight-tool';
import { TOO_LONG_MESSAGE, addItem, findItem, fitsLimit, newHighlightId, removeItem } from '../notes/model';
import { IconBookmark } from './icons';
import { AiUserError, TITLE_MAX, type AiChat, type AiClient, type ChatHistoryStore, type ChatMessage, type ChatSummary } from '../ai/types';
import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';
import type { SyncState, SyncUser } from '../sync/types';
import { claimChatFocus, onChatFocus } from './chat-focus';
import { ContactAdminButton } from './ContactAdminButton';
import { LocalSettingsDialog } from './LocalSettingsDialog';
import { Markdown } from './Markdown';

/** Câu trả lời thay thế khi AI đã tô từ khóa nhưng không viết lời nào. */
const HIGHLIGHT_DONE = 'Đã tô các từ khóa quan trọng trong đề.';

interface Props {
  attemptId: string;
  /** Vị trí câu trong lượt thi, bắt đầu từ 1. */
  number: number;
  question: Question;
  order: string[];
  /** Người học đã thấy đáp án và hướng dẫn (đã mở, hoặc bài đã nộp); mặc định true. */
  revealed?: boolean;
  /** Nút nằm trong khối câu (trang xem lại có nhiều câu) thay vì nổi ở góc phải. */
  inline?: boolean;
}

/** User đang đăng nhập (kể cả lúc đang tải/xung đột dữ liệu); không có thì null. */
export function signedInUser(state: SyncState): SyncUser | null {
  return 'user' in state ? state.user : null;
}

const PREVIEW = 80;
const LOAD_FAILED = 'Không tải được lịch sử trò chuyện.';
const SAVE_FAILED = 'Không lưu được lịch sử trò chuyện.';

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

function RobotIcon() {
  return (
    <svg className="gemini-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M2 12v3M22 12v3" />
      <circle cx="12" cy="3.5" r="1" />
    </svg>
  );
}

/** Tên hiện trên nút và trong khung: Gemini, hoặc "AI" ở chế độ AI thử nghiệm (LM Studio). */
export type Brand = 'Gemini' | 'AI';

const noSubscribe = () => () => undefined;
const geminiMode = () => 'gemini' as const;

/** Chế độ đang chọn; không có AI thử nghiệm thì luôn Gemini. */
export function useAiMode(aiMode: AiModeStore | undefined) {
  return useSyncExternalStore(aiMode?.subscribe ?? noSubscribe, aiMode?.get ?? geminiMode);
}

const noState = () => null;

export interface ActiveAi {
  client: AiClient;
  brand: Brand;
  uid: string;
  /** Chỉ có ở AI thử nghiệm: tham số ⚙ lưu theo tài khoản. */
  settingsStore?: LocalSettingsStore;
  /** Nơi lưu lịch sử chat của chế độ đang chọn. */
  chats: ChatHistoryStore;
}

/**
 * AI đang dùng (theo chế độ trong menu tài khoản), chỉ khi có `sync`, đã đăng nhập Google và có đủ
 * client + nơi lưu chat của chế độ đó; không thì null. Dùng chung cho nút chat và nút AI soạn ghi chú.
 */
export function useActiveAi(): ActiveAi | null {
  const { sync, ai, chats, localAi, localChats, aiMode, localSettings } = useApp();
  const mode = useAiMode(aiMode);
  const state = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? noState);
  const local = mode === 'local' && localAi && localChats ? { ai: localAi, chats: localChats } : null;
  const client = local?.ai ?? ai;
  const store = local?.chats ?? chats;
  const user = state ? signedInUser(state) : null;
  if (!sync || !client || !store || !user) return null;
  return { client, brand: local ? 'AI' : 'Gemini', uid: user.uid, chats: store, ...(local && localSettings ? { settingsStore: localSettings } : {}) };
}

/**
 * Nút "Hỏi Gemini" (hoặc "Hỏi AI" ở chế độ thử nghiệm); chỉ hiện khi có AI của chế độ đang chọn
 * và đã đăng nhập Google.
 */
export function GeminiButton(props: Props) {
  const active = useActiveAi();
  if (!active) return null;
  // key theo uid và chế độ: đăng xuất, đổi tài khoản hay đổi Gemini ↔ AI thử nghiệm thì khung chat đóng hẳn.
  return <Launcher key={`${active.uid}:${active.brand}`} uid={active.uid} ai={active.client} chats={active.chats} brand={active.brand} {...props} />;
}

/** Câu này có câu trả lời đang chạy ngầm (đã đóng khung hay sang câu khác) hay không. */
function useRunning(inflight: InflightRegistry, key: string): boolean {
  const [running, setRunning] = useState(() => inflight.get(key) !== undefined);
  useEffect(() => {
    setRunning(inflight.get(key) !== undefined);
    return inflight.subscribe(key, (e) => setRunning(e.kind === 'progress'));
  }, [inflight, key]);
  return running;
}

/** Khung cần tự mở sau khi chuyển Gemini → AI thử nghiệm (`${attemptId}/${qid}`), để người học khỏi bấm lại nút. */
let openAfterSwitch: string | null = null;

function Launcher({ inline, ...props }: Props & { uid: string; ai: AiClient; chats: ChatHistoryStore; brand: Brand }) {
  const id = useId();
  const { aiGate } = useApp();
  const launcherKey = keyOf(props.attemptId, props.question.id);
  const { attemptId } = props;
  const qid = props.question.id;
  /** Yêu cầu mở từ thông báo "Đến câu …" (khung chat của đúng câu này, không phải ghi chú). */
  const isMine = useCallback(
    (t: AiJobTarget) => t.page === 'attempt' && t.attemptId === attemptId && t.qid === qid && !t.highlightId,
    [attemptId, qid],
  );
  const [open, setOpen] = useState(() => {
    if (openAfterSwitch === launcherKey) return true;
    const pending = aiGate.peekOpen();
    return pending !== null && isMine(pending);
  });
  useEffect(() => {
    if (openAfterSwitch === launcherKey) openAfterSwitch = null;
  }, [launcherKey]);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    return onChatFocus((other) => other !== id && setOpen(false));
  }, [id]);
  const show = useCallback(() => {
    claimChatFocus(id);
    setOpen(true);
  }, [id]);
  // Nhận yêu cầu mở (lúc mount, hoặc khi đang ở sẵn câu này mà người học bấm "Đến câu …").
  useEffect(() => {
    const take = () => {
      if (aiGate.takeOpen(isMine)) show();
    };
    take();
    return aiGate.subscribe(take);
  }, [aiGate, isMine, show]);
  const running = useRunning(inflightFor(props.chats), inflightKey(props.uid, props.attemptId, props.question.id));
  // Như chat Messenger: khung chat mở ra thay chỗ nút, đóng lại thì nút hiện lại.
  return open ? (
    <ChatDialog {...props} onClose={close} />
  ) : (
    <button
      type="button"
      className={['btn-gemini', inline && 'btn-gemini--inline', running && 'btn-gemini--running'].filter(Boolean).join(' ')}
      aria-label={`Hỏi ${props.brand}`}
      title={running ? 'AI đang trả lời câu này' : undefined}
      onClick={show}
    >
      {props.brand === 'AI' ? <RobotIcon /> : <GeminiIcon />}
      Hỏi {props.brand}
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
  revealed,
  brand,
  onClose,
}: Props & { uid: string; ai: AiClient; chats: ChatHistoryStore; brand: Brand; onClose: () => void }) {
  const { store, bank, localAi, aiMode, localSettings } = useApp();
  // Nút ⚙ chỉ có ở AI thử nghiệm; cài đặt lưu theo tài khoản, chưa tải xong hoặc tải lỗi thì dùng mặc định.
  const settingsStore = brand === 'AI' ? localSettings : undefined;
  const [settings, setSettings] = useState<LocalAiSettings>(DEFAULT_LOCAL_SETTINGS);
  const [settingsState, setSettingsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (!settingsStore) return;
    let live = true;
    settingsStore.load(uid).then(
      (s) => {
        if (!live) return;
        setSettings(s);
        setSettingsState('ready');
      },
      // Tải lỗi: vẫn hỏi được bằng mặc định, nhưng khóa ⚙ để không ghi đè bản trên Firebase.
      () => live && setSettingsState('failed'),
    );
    return () => {
      live = false;
    };
  }, [settingsStore, uid]);
  // Gemini hết lượt mà có AI thử nghiệm: cho chuyển sang ngay trong khung, rồi mở lại khung của đúng câu này.
  const switchToLocal =
    brand === 'Gemini' && localAi && aiMode
      ? () => {
          openAfterSwitch = keyOf(attemptId, question.id);
          aiMode.set('local');
        }
      : undefined;
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
  const home: Target = { attemptId, number, question, order, setId: homeSetId, revealed: revealed ?? true };
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
      revealed: open ? a.guideOpened.includes(qid) : true,
    };
  };

  const isHome = !picked || (picked.attemptId === attemptId && picked.qid === question.id);
  const target = (!isHome && picked && resolve(picked.attemptId, picked.qid)) || home;
  const atHome = target === home;

  const stem = target.question.html ? htmlToText(target.question.stem) : target.question.stem;
  const preview = stem.length > PREVIEW ? `${stem.slice(0, PREVIEW).trimEnd()}…` : stem;
  const title =
    view === 'list' ? 'Trò chuyện cũ' : atHome ? `Hỏi ${brand} · Câu ${number}` : `Hỏi ${brand} · ${setLabel(target.setId)} · Câu ${target.number}`;
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
                  <span className="gemini__brand">{brand}</span> {shortLabel}
                </>
              )}
            </span>
          </h1>
          {view === 'chat' && <p className="hint gemini__stem">{preview}</p>}
        </div>
        <div className="gemini__tools">
          {settingsStore && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Cài đặt Hỏi AI"
              title={settingsState === 'failed' ? 'Không tải được cài đặt, đang dùng mặc định' : 'Cài đặt Hỏi AI'}
              disabled={settingsState !== 'ready'}
              onClick={() => setSettingsOpen(true)}
            >
              ⚙
            </button>
          )}
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
          <Conversation
            key={keyOf(target.attemptId, target.question.id)}
            uid={uid}
            ai={ai}
            chats={chats}
            brand={brand}
            target={target}
            settings={settingsStore ? settings : undefined}
            onBusy={setBusy}
            onSwitchToLocal={switchToLocal}
          />
        </>
      )}
      {settingsOpen && settingsStore && (
        <LocalSettingsDialog
          initial={settings}
          onSave={async (next) => {
            await settingsStore.save(uid, next);
            setSettings(next);
          }}
          onClose={() => setSettingsOpen(false)}
        />
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
  brand,
  target,
  settings,
  onBusy,
  onSwitchToLocal,
}: {
  uid: string;
  ai: AiClient;
  chats: ChatHistoryStore;
  brand: Brand;
  target: Target;
  /** Cài đặt ⚙ (chỉ AI thử nghiệm); đổi thì lần gửi sau mở phiên mới. */
  settings?: LocalAiSettings;
  /** Báo khung ngoài để khóa chuyển cuộc trò chuyện khi đang trả lời. */
  onBusy: (busy: boolean) => void;
  /** Có thì hiện nút chuyển sang AI thử nghiệm khi Gemini hết lượt. */
  onSwitchToLocal?: () => void;
}) {
  const { attemptId, question, order, setId } = target;
  const qid = question.id;
  const key = inflightKey(uid, attemptId, qid);
  const { store, bank, sync, aiCooldown, aiGate, notes } = useApp();
  const inflight = inflightFor(chats);
  // AI tô từ khóa chỉ ở lượt Thi thử đang làm (highlight chỉ hiện ở đó).
  const isPracticeOpen = () => {
    const a = store.get(attemptId);
    return a?.mode === 'practice' && a.status === 'in-progress';
  };
  const canHighlight = isPracticeOpen();
  // Ghi chú (đánh dấu câu trả lời): Thi thử đang làm hoặc lượt đã nộp (cả Thi thật).
  const canNote = canHighlight || store.get(attemptId)?.status === 'submitted';
  // Mỗi tab chỉ một yêu cầu AI: yêu cầu ở chỗ khác đang chạy thì khóa ô nhập của khung này.
  const gateTarget: AiJobTarget = { page: 'attempt', attemptId, qid };
  const myKey = targetKey(gateTarget);
  const gateJob = useAiGate();
  const locked = gateJob !== null && targetKey(gateJob.target) !== myKey ? gateJob : null;
  // Khung đang mở câu này: trả lời xong thì không cần thông báo.
  useEffect(() => {
    aiGate.setViewing(myKey);
    return () => {
      if (aiGate.viewing() === myKey) aiGate.setViewing(null);
    };
  }, [aiGate, myKey]);
  // Khóa sau lỗi hết lượt chỉ dùng chung cho Gemini; AI thử nghiệm có bản riêng (thực tế không bị 429).
  const cooldown = brand === 'Gemini' ? (aiCooldown ?? memoryCooldownFor(ai)) : memoryCooldownFor(ai);
  const until = useCooldown(cooldown);
  // Câu trả lời còn chạy từ lần mở khung trước (đã sang câu khác rồi quay lại): theo dõi tiếp.
  const [running] = useState(() => inflight.get(key));
  const [searching, setSearching] = useState(running?.searching ?? false);
  const [highlighting, setHighlighting] = useState(running?.highlighting ?? false);
  const [messages, setMessages] = useState<ChatMessage[]>(running?.messages ?? []);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  /** Lần gửi trước hỏng vì Gemini hết lượt/quá tải. */
  const [busyFailed, setBusyFailed] = useState(false);
  /** Câu báo lỗi riêng (vd không kết nối được AI thử nghiệm). */
  const [failMessage, setFailMessage] = useState<string | undefined>();
  /** Model đang suy nghĩ (reasoning), chưa có chữ trả lời. */
  const [thinking, setThinking] = useState(running?.thinking ?? false);
  /** Đang chờ để tự thử lại (lần mấy / tối đa). */
  const [retry, setRetry] = useState(running?.retry);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Đánh dấu câu trả lời bị từ chối vì ghi chú của câu đã quá dài. */
  const [noteError, setNoteError] = useState(false);
  const [busy, setBusy] = useState(running !== undefined);
  const [input, setInput] = useState('');
  const chatRef = useRef<AiChat | null>(null);
  const watchdogRef = useRef<IdleWatchdog | null>(null);
  // Đã nhận tin từ câu trả lời đang chạy thì lịch sử tải về (có thể cũ hơn) không được ghi đè.
  const fromInflight = useRef(running !== undefined);
  // Trạng thái "đã thấy đáp án" mà phiên chat hiện tại được báo; đổi thì mở phiên mới để Gemini biết.
  const sessionRevealed = useRef(target.revealed);
  const sessionSettings = useRef(settings);
  const sessionHighlight = useRef(canHighlight);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Gợi ý đã hỏi (câu người học giống ≥ 85%) thì không hiện lại.
  const fixedSuggestions = chatSuggestions(bank.meta.get(qid)?.services ?? [], bank.services, { highlight: canHighlight });
  const askedTexts = messages.filter((m) => m.role === 'user').map((m) => m.text);
  // Câu hỏi tiếp theo AI gợi ý (chỉ của câu trả lời mới nhất) đứng trước gợi ý cố định.
  const lastModel = messages[messages.length - 1]?.role === 'model' ? messages[messages.length - 1] : undefined;
  const suggestions = [
    ...pickFollowups(lastModel?.suggestions ?? [], fixedSuggestions, askedTexts),
    ...fixedSuggestions.filter((t) => !askedTexts.some((a) => similarity(a, t) >= SIMILAR_THRESHOLD)),
  ];
  // Lần gửi trước lỗi và câu hỏi cuối chưa có trả lời: cho gửi lại.
  const canRetry = sendFailed && !busy && messages[messages.length - 1]?.role === 'user';

  useEffect(() => onBusy(busy), [busy, onBusy]);

  useEffect(
    () =>
      inflight.subscribe(key, (e) => {
        fromInflight.current = true;
        if (e.kind === 'save-failed') return setSaveFailed(true);
        setMessages(e.messages);
        setBusy(e.kind === 'progress');
        setSearching(e.kind === 'progress' && e.searching);
        setHighlighting(e.kind === 'progress' && !!e.highlighting);
        setRetry(e.kind === 'progress' ? e.retry : undefined);
        setThinking(e.kind === 'progress' && !!e.thinking);
        if (e.kind === 'done') {
          setSendFailed(e.failed);
          setBusyFailed(e.failed && !!e.busy);
          setFailMessage(e.message);
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
   * Gửi chữ trong ô nhập, hoặc một câu hỏi gợi ý (gửi luôn, không đụng ô nhập).
   * base: lịch sử gửi kèm (gửi lại câu hỏi lỗi thì bỏ chính câu đó khỏi lịch sử để không lặp).
   */
  const send = async (suggestion?: string, base: ChatMessage[] = messages) => {
    const text = (suggestion ?? input).trim();
    if (!text || busy || !loaded || cooldown.until() !== null || aiGate.current() !== null) return;
    const history = base;
    const asked: ChatMessage[] = [...history, { role: 'user', text }];
    // Câu trả lời tạo lúc chưa xem đáp án được gắn `hidden` để không dùng lại sau khi xem.
    const modelMsg = (t: string): ChatMessage => ({ role: 'model', text: t, ...(target.revealed ? {} : { hidden: true as const }) });
    const signedIn = () => !sync || signedInUser(sync.getState())?.uid === uid;
    if (suggestion === undefined) setInput('');
    setSendFailed(false);
    setBusyFailed(false);
    setFailMessage(undefined);
    setSaveFailed(false);
    // Câu hỏi giống câu đã có trả lời: dùng lại câu trả lời đó, không gửi cho AI (đỡ tốn lượt, tránh 429).
    // Nhờ tô từ khóa thì luôn hỏi AI (đoạn tô có thể đã bị xóa), không dùng lại câu trả lời cũ.
    const wantsHighlight = similarity(text, HIGHLIGHT_SUGGESTION) >= SIMILAR_THRESHOLD;
    const cached = wantsHighlight ? null : findCachedReply(history, text, target.revealed);
    if (cached !== null) {
      const reused: ChatMessage = { ...modelMsg(cached.text), cached: true, ...(cached.suggestions?.length ? { suggestions: cached.suggestions } : {}) };
      const done: ChatMessage[] = [...asked, reused];
      inflight.emit(key, { kind: 'done', messages: done, failed: false });
      chats.save(uid, attemptId, qid, done).catch(() => inflight.emit(key, { kind: 'save-failed' }));
      return;
    }
    const job = { kind: 'chat' as const, label: `Câu ${target.number}`, target: gateTarget };
    // Chạy qua gate. Lỗi của AI đã báo trong khung; gate bận (đã chặn ở trên, chỉ xảy ra khi đua) thì trả lại chữ.
    await aiGate.run(job, () => answer(text, history, asked, modelMsg, signedIn)).catch((e) => {
      if (e instanceof AiGateBusyError && suggestion === undefined) setInput(text);
    });
  };

  /**
   * Chạy ở nền, không phụ thuộc khung chat còn mở hay không: mọi cập nhật đi qua `inflight`, khung
   * nào đang mở câu này thì nhận. Chỉ dừng (không lưu) khi user đã đăng xuất hay đổi tài khoản.
   * Ném lại lỗi để gate biết yêu cầu hỏng.
   */
  const answer = async (
    text: string,
    history: ChatMessage[],
    asked: ChatMessage[],
    modelMsg: (t: string) => ChatMessage,
    signedIn: () => boolean,
  ) => {
    // AI im lặng quá lâu (kể cả trước chữ đầu tiên) thì báo lỗi và nhả gate; chữ đến sau bị bỏ.
    // Phiên chat dùng lại qua nhiều lần gửi nên các callback của phiên đọc watchdog qua ref.
    const watchdog = createIdleWatchdog();
    watchdogRef.current = watchdog;
    let reply = '';
    let searchingNow = false;
    let highlightingNow = false;
    let highlightedAny = false;
    let retryNow: { attempt: number; max: number } | undefined;
    let thinkingNow = false;
    const progress = () =>
      inflight.emit(key, {
        kind: 'progress',
        messages: visibleReply(reply) ? [...asked, modelMsg(visibleReply(reply))] : asked,
        searching: searchingNow,
        highlighting: highlightingNow,
        retry: retryNow,
        thinking: thinkingNow,
      });
    progress();
    try {
      // Một phiên chat cho mỗi lần mở khung; adapter tự cắt và chuẩn hóa history.
      // startChat có thể ném lỗi ngay (history không hợp lệ) nên nằm trong try.
      const highlightNow = isPracticeOpen();
      if (
        chatRef.current &&
        (sessionRevealed.current !== target.revealed || sessionSettings.current !== settings || sessionHighlight.current !== highlightNow)
      )
        chatRef.current = null;
      sessionRevealed.current = target.revealed;
      sessionSettings.current = settings;
      sessionHighlight.current = highlightNow;
      const prompt = buildSystemPrompt(question, order, {
        vi: bank.vi.get(qid),
        note: bank.meta.get(qid)?.note,
        revealed: target.revealed,
        webSearch: settings?.webSearch,
        highlightTool: highlightNow,
        fixedSuggestions: chatSuggestions(bank.meta.get(qid)?.services ?? [], bank.services, { highlight: highlightNow }),
      });
      const tools = [createSearchTool(store, bank, { setId, attemptId, qid })];
      if (highlightNow)
        tools.push(
          createHighlightTool({ notes, isOpen: isPracticeOpen, question, canonicalQid: bank.canonical(qid), newId: newHighlightId, now: () => Date.now() }),
        );
      const chat = (chatRef.current ??= ai.startChat(prompt, history, {
        settings,
        tools,
        onToolCall: (name) => {
          watchdogRef.current?.touch();
          // Dòng chờ riêng cho tool tìm câu và tool tô từ khóa.
          if (name === SEARCH_TOOL) searchingNow = true;
          else if (name === HIGHLIGHT_TOOL) highlightingNow = highlightedAny = true;
          else return;
          progress();
        },
        onThinking: () => {
          watchdogRef.current?.touch();
          if (thinkingNow) return;
          thinkingNow = true;
          progress();
        },
        // Gemini hết lượt/quá tải: khóa mọi khung chat tới giờ thử lại và hiện đếm ngược.
        retry: {
          onWait: (w) => {
            watchdogRef.current?.touch(w.until);
            cooldown.set(w.until);
            retryNow = { attempt: w.attempt, max: w.max };
            progress();
          },
        },
      }));
      for await (const chunk of watchdog.wrap(chat.send(text))) {
        if (!signedIn()) throw new Error('signed out');
        if (!chunk) continue;
        searchingNow = false;
        highlightingNow = false;
        retryNow = undefined;
        thinkingNow = false;
        reply += chunk;
        progress();
      }
      // Tách câu hỏi gợi ý ở cuối (sau dấu <<GOI_Y>>) khỏi câu trả lời.
      const split = splitFollowups(reply);
      // AI đã tô rồi chỉ gửi gợi ý (không có lời): vẫn coi là xong.
      if (!split.text.trim() && highlightedAny && split.suggestions.length > 0) split.text = HIGHLIGHT_DONE;
      if (!split.text.trim()) throw new Error('empty reply');
      if (!signedIn()) throw new Error('signed out');
      const final: ChatMessage = { ...modelMsg(split.text), ...(split.suggestions.length ? { suggestions: split.suggestions } : {}) };
      const done: ChatMessage[] = [...asked, final];
      inflight.emit(key, { kind: 'done', messages: done, failed: false });
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
      const partial = splitFollowups(reply).text;
      inflight.emit(key, { kind: 'done', messages: partial ? [...asked, modelMsg(partial)] : asked, failed: true, busy: busyError, message: e instanceof AiUserError ? e.userMessage : undefined });
      throw e;
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

  const sendFailMessage = failMessage ?? (busyFailed ? `${brand} đang hết lượt, thử lại sau ít phút.` : `${brand} chưa trả lời được, thử gửi lại nhé.`);

  return (
    <>
      <div className="service-modal__body">
        <div className="gemini__log" aria-live="polite">
          {loadFailed && (
            <p className="gemini__notice">
              <span>{LOAD_FAILED}</span> <ContactAdminButton message={LOAD_FAILED} />
            </p>
          )}
          {loaded && messages.length === 0 && !loadFailed && (
            <p className="hint">Hỏi bất cứ điều gì về câu này, ví dụ vì sao một lựa chọn sai.</p>
          )}
          {messages.map((m, i) =>
            canRetry && i === messages.length - 1 ? (
              // Câu hỏi cuối chưa có trả lời (gửi lỗi): nút ↻ bên trái để gửi lại đúng câu đó.
              <div key={i} className="gemini__retry-row">
                <button
                  type="button"
                  className="icon-btn gemini__retry"
                  aria-label="Gửi lại câu hỏi"
                  title="Gửi lại câu hỏi"
                  disabled={!loaded || until !== null || locked !== null}
                  onClick={() => void send(m.text, messages.slice(0, -1))}
                >
                  ↻
                </button>
                <div className="gemini__msg gemini__msg--user">{m.text}</div>
              </div>
            ) : (
              <div key={i} className={`gemini__msg gemini__msg--${m.role}`}>
                {m.role === 'model' ? <Markdown text={m.text} /> : m.text}
                {m.cached && <p className="gemini__cached">Trả lời lại từ lần hỏi trước</p>}
                {/* Đánh dấu câu trả lời đã xong vào ghi chú (tiêu đề = câu hỏi ngay trước). */}
                {m.role === 'model' && canNote && !(busy && i === messages.length - 1) && (
                  <BookmarkButton qid={bank.canonical(qid)} title={questionBefore(messages, i)} content={m.text} onTooLong={() => setNoteError(true)} />
                )}
              </div>
            ),
          )}
          {busy && messages[messages.length - 1]?.role === 'user' && (
            <p className="hint">
              {retry && until !== null
                ? `${brand} đang hết lượt, tự thử lại sau ${secondsLeft(until)} giây… (lần ${retry.attempt}/${retry.max})`
                : searching
                  ? `${brand} đang tìm trong các câu bạn đã làm…`
                  : highlighting
                    ? `${brand} đang tô từ khóa…`
                  : thinking
                    ? `${brand} đang suy nghĩ…`
                    : `${brand} đang trả lời…`}
            </p>
          )}
          {!busy && until !== null ? (
            <p className="gemini__notice" role="alert">
              {brand} đang hết lượt. Thử lại sau {secondsLeft(until)} giây (lúc {clockTime(until)}).
            </p>
          ) : (
            sendFailed && (
              <p className="gemini__notice" role="alert">
                <span>{sendFailMessage}</span> <ContactAdminButton message={sendFailMessage} />
              </p>
            )
          )}
          {onSwitchToLocal && !busy && (until !== null || busyFailed) && (
            <button type="button" className="gemini__switch" onClick={onSwitchToLocal}>
              🤖 Chuyển sang AI thử nghiệm
            </button>
          )}
          {noteError && (
            <p className="gemini__notice" role="alert">
              {TOO_LONG_MESSAGE}
            </p>
          )}
          {saveFailed && (
            <p className="gemini__notice">
              <span>{SAVE_FAILED}</span> <ContactAdminButton message={SAVE_FAILED} />
            </p>
          )}
          {/* Gợi ý nằm cuối vùng chat, mỗi dòng một câu; ẩn khi đang trả lời hoặc đã hỏi hết. */}
          {!busy && loaded && suggestions.length > 0 && (
            <div className="gemini__suggest" role="group" aria-label="Câu hỏi gợi ý">
              <p className="gemini__suggest-title">Gợi ý</p>
              {suggestions.map((text) => (
                <button key={text} type="button" className="gemini__suggest-item" disabled={until !== null || locked !== null} onClick={() => void send(text)}>
                  {text}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form className="gemini__form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          aria-label={`Câu hỏi cho ${brand}`}
          rows={2}
          value={input}
          disabled={busy || !loaded || locked !== null}
          placeholder="Nhập câu hỏi…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn-primary" disabled={busy || !loaded || until !== null || locked !== null}>
          Gửi
        </button>
      </form>
      {locked && (
        <p className="gemini__locked" role="note">
          {locked.kind === 'note' ? `AI đang soạn ghi chú ở ${locked.label}` : `AI đang trả lời ở ${locked.label}`}
        </p>
      )}
    </>
  );
}

/** Câu người học hỏi gần nhất phía trước tin thứ i. */
function questionBefore(messages: ChatMessage[], i: number): string {
  for (let j = i - 1; j >= 0; j--) if (messages[j].role === 'user' && messages[j].text.trim()) return messages[j].text;
  return 'Câu trả lời AI';
}

/** Nút lưu/bỏ một câu trả lời AI khỏi ghi chú của câu (canonical qid). */
function BookmarkButton({ qid, title, content, onTooLong }: { qid: number; title: string; content: string; onTooLong: () => void }) {
  const { notes, now } = useApp();
  const saved = useSyncExternalStore(notes.subscribe, () => findItem(notes.get(qid), 'ai', title, content)?.id ?? null);
  const toggle = () => {
    const cur = notes.get(qid);
    if (saved && cur) return notes.save(removeItem(cur, saved, now()));
    const next = addItem(cur, qid, { kind: 'ai', title, content }, newHighlightId(), now());
    if (fitsLimit(next)) notes.save(next);
    else onTooLong();
  };
  const label = saved ? 'Bỏ khỏi ghi chú' : 'Lưu vào ghi chú';
  return (
    <button type="button" className={`icon-btn gemini__bookmark${saved ? ' is-saved' : ''}`} aria-label={label} title={label} aria-pressed={saved !== null} onClick={toggle}>
      <IconBookmark filled={saved !== null} />
    </button>
  );
}

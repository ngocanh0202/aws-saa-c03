import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { formatDate } from '../app/format';
import { normalizeSearch } from '../components/GeminiChat';
import { GuidePanel } from '../components/GuidePanel';
import { IconAi, IconClose, IconDelete, IconHighlight, IconNote } from '../components/icons';
import { Markdown } from '../components/Markdown';
import { QuestionCard } from '../components/QuestionCard';
import type { SetsFile } from '../data/types';
import {
  GROUP_LABEL,
  SOURCE_LABEL,
  groupEntries,
  matchesEntry,
  noteLabel,
  sortEntries,
  toEntries,
  type EntryGroup,
  type GroupKey,
  type NoteEntry,
  type NoteSource,
  type SortKey,
} from '../notes/entries';
import { ITEM_CONTENT_MAX, NOTE_MAX, TITLE_MAX, TOO_LONG_MESSAGE, fitsLimit, removeHighlight, removeItem, setNote, updateItem, type QuestionNotes } from '../notes/model';

/** Cách xem (sắp xếp, gộp) nhớ theo máy; không đọc/ghi được storage thì dùng mặc định. */
const VIEW_KEY = 'saa-c03:notes-view:v1';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'oldest', label: 'Cũ nhất' },
  { key: 'question', label: 'Theo đề & số câu' },
];
const GROUP_KEYS: GroupKey[] = ['set', 'question', 'source'];

interface View {
  sort: SortKey;
  group: GroupKey[];
}

function loadView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as Partial<View> | null;
    const sort = SORTS.some((s) => s.key === v?.sort) ? v!.sort! : 'newest';
    const group = Array.isArray(v?.group) ? v!.group!.filter((g, i, a) => GROUP_KEYS.includes(g) && a.indexOf(g) === i) : [];
    return { sort, group };
  } catch {
    return { sort: 'newest', group: [] };
  }
}

function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    // không lưu được: chỉ nhớ trong phiên
  }
}

const SOURCE_ICON: Record<NoteSource, () => ReactNode> = {
  highlight: () => <IconHighlight />,
  ai: () => <IconAi />,
  manual: () => <IconNote />,
};

export function NotesPage() {
  const { notes: store, bank, aiGate } = useApp();
  // list() trả mảng mới mỗi lần: lấy theo phiên bản (chuỗi JSON) để useSyncExternalStore không lặp vô hạn.
  const json = useSyncExternalStore(store.subscribe, () => JSON.stringify(store.list()));
  const list = JSON.parse(json) as QuestionNotes[];
  const [query, setQuery] = useState('');
  const [view, setView] = useState(loadView);
  const [openQid, setOpenQid] = useState<number | null>(null);
  const sets = bank.sets;

  // Mở từ thông báo AI (AI soạn xong ghi chú đoạn tô): mở khung câu đó; popup do Highlighter trong khung tự mở (takeOpen).
  const pending = useSyncExternalStore(aiGate.subscribe, aiGate.peekOpen);
  useEffect(() => {
    if (pending?.page === 'notes') setOpenQid(pending.qid);
  }, [pending]);

  const changeView = (v: View) => {
    setView(v);
    saveView(v);
  };
  const toggleGroup = (g: GroupKey) =>
    changeView({ ...view, group: view.group.includes(g) ? view.group.filter((x) => x !== g) : [...view.group, g] });

  const needle = normalizeSearch(query.trim());
  const entries = sortEntries(
    toEntries(list).filter((e) => bank.questions.has(e.qid) && matchesEntry(e, needle, sets)),
    view.sort,
    sets,
  );
  const groups = groupEntries(entries, view.group, sets);
  const total = toEntries(list).length;

  return (
    <main className="page notes-page">
      <h1>Ghi chú của tôi</h1>
      {total === 0 ? (
        <p>Chưa có ghi chú. Tô đề rồi ghi chú, đánh dấu câu trả lời của AI, hoặc bấm "Ghi chú" khi làm bài.</p>
      ) : (
        <>
          <div className="notes-tools">
            <input
              type="search"
              className="notes-page__search"
              aria-label="Tìm ghi chú"
              placeholder="Tìm trong tiêu đề và nội dung…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="notes-tools__sort">
              Sắp xếp{' '}
              <select value={view.sort} onChange={(e) => changeView({ ...view, sort: e.target.value as SortKey })}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="notes-tools__group" role="group" aria-label="Gộp theo">
              <span>Gộp theo</span>
              {GROUP_KEYS.map((g) => {
                const level = view.group.indexOf(g);
                return (
                  <button key={g} type="button" className="chip" aria-pressed={level !== -1} onClick={() => toggleGroup(g)}>
                    {level !== -1 && <span className="chip__level" aria-label={`tầng ${level + 1}`}>{level + 1}</span>}
                    {GROUP_LABEL[g]}
                  </button>
                );
              })}
            </div>
          </div>
          {entries.length === 0 && <p>Không có ghi chú nào khớp.</p>}
          {view.group.length === 0 ? (
            <EntryList entries={entries} sets={sets} onOpen={setOpenQid} />
          ) : (
            groups.map((g) => <Group key={g.key} group={g} sets={sets} onOpen={setOpenQid} />)
          )}
        </>
      )}
      {openQid !== null && <QuestionDialog qid={openQid} onClose={() => setOpenQid(null)} />}
    </main>
  );
}

function Group({ group, sets, onOpen }: { group: EntryGroup; sets: SetsFile; onOpen: (qid: number) => void }) {
  return (
    <details className="notes-group" open>
      <summary>
        {group.label} <span className="notes-group__count">({group.count})</span>
      </summary>
      {group.groups ? group.groups.map((g) => <Group key={g.key} group={g} sets={sets} onOpen={onOpen} />) : <EntryList entries={group.entries ?? []} sets={sets} onOpen={onOpen} />}
    </details>
  );
}

function EntryList({ entries, sets, onOpen }: { entries: NoteEntry[]; sets: SetsFile; onOpen: (qid: number) => void }) {
  return (
    <div className="notes-list">
      {entries.map((e) => (
        <Entry key={e.key} entry={e} sets={sets} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Entry({ entry: e, sets, onOpen }: { entry: NoteEntry; sets: SetsFile; onOpen: (qid: number) => void }) {
  const { notes, now } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = () => {
    const cur = notes.get(e.qid);
    if (!cur) return;
    notes.save(e.source === 'highlight' ? removeHighlight(cur, e.id, now()) : removeItem(cur, e.id, now()));
  };

  return (
    <article className={`notes-entry notes-entry--${e.source}`} id={`note-${e.key}`}>
      <p className="notes-entry__meta">
        <span className="notes-entry__source" title={SOURCE_LABEL[e.source]}>
          {SOURCE_ICON[e.source]()} {SOURCE_LABEL[e.source]}
        </span>
        <span>{noteLabel(e.qid, sets)}</span>
        <span>{formatDate(e.updatedAt)}</span>
      </p>
      {editing ? (
        <EntryEditor entry={e} onDone={() => setEditing(false)} />
      ) : (
        <>
          <h2 className="notes-entry__title">{e.source === 'highlight' ? <mark className="hl">{e.title}</mark> : e.title}</h2>
          {e.content.trim() !== '' && (e.source === 'ai' ? <Markdown text={e.content} /> : <p className="notes-entry__content">{e.content}</p>)}
          <div className="notes-entry__actions">
            <button type="button" onClick={() => onOpen(e.qid)}>
              Mở câu hỏi
            </button>
            <button type="button" onClick={() => setEditing(true)}>
              Sửa
            </button>
            {confirmDelete ? (
              <>
                <span>Xóa ghi chú này?</span>
                <button type="button" className="btn-danger" onClick={remove}>
                  Xóa
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Hủy
                </button>
              </>
            ) : (
              <button type="button" className="icon-btn" aria-label="Xóa ghi chú" title="Xóa ghi chú" onClick={() => setConfirmDelete(true)}>
                <IconDelete />
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

/** Sửa tại chỗ: ghi chú AI/tự ghi sửa cả tiêu đề; đoạn tô chỉ sửa nội dung (tiêu đề là chữ trong đề). */
function EntryEditor({ entry: e, onDone }: { entry: NoteEntry; onDone: () => void }) {
  const { notes, now } = useApp();
  const highlight = e.source === 'highlight';
  const [title, setTitle] = useState(e.title);
  const [content, setContent] = useState(e.content);
  const [tooLong, setTooLong] = useState(false);

  const save = (ev: FormEvent) => {
    ev.preventDefault();
    if (!highlight && title.trim() === '') return;
    const cur = notes.get(e.qid);
    if (!cur) return onDone();
    const next = highlight ? setNote(cur, e.id, content, now()) : updateItem(cur, e.id, { title, content }, now());
    if (!fitsLimit(next)) return setTooLong(true);
    notes.save(next);
    onDone();
  };

  return (
    <form className="notes-entry__edit" onSubmit={save}>
      {!highlight && <input className="note-form__input" aria-label="Tiêu đề" maxLength={TITLE_MAX} value={title} onChange={(ev) => setTitle(ev.target.value)} />}
      <textarea
        className="note-form__input"
        aria-label="Nội dung"
        rows={5}
        maxLength={highlight ? NOTE_MAX : ITEM_CONTENT_MAX}
        value={content}
        autoFocus
        onChange={(ev) => setContent(ev.target.value)}
      />
      {tooLong && (
        <p className="note-form__error" role="alert">
          {TOO_LONG_MESSAGE}
        </p>
      )}
      <div className="notes-entry__actions">
        <button type="submit" className="btn-primary" disabled={!highlight && title.trim() === ''}>
          Lưu
        </button>
        <button type="button" onClick={onDone}>
          Hủy
        </button>
      </div>
    </form>
  );
}

/** Khung xem câu: đề, đáp án đúng và hướng dẫn; vẫn tô/sửa ghi chú đoạn tô được. */
function QuestionDialog({ qid, onClose }: { qid: number; onClose: () => void }) {
  const { bank } = useApp();
  const question = bank.questions.get(qid);
  const label = noteLabel(qid, bank.sets);
  useEffect(() => {
    // Esc đang đóng popup ghi chú đoạn tô thì để popup xử lý, không đóng khung.
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || document.querySelector('.hl-pop, .hl-sheet')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!question) return null;
  const order = question.options.map((o) => o.key);
  return (
    <div className="dialog notes-question" role="presentation" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="dialog__box notes-question__box" role="dialog" aria-modal="true" aria-label={`Câu hỏi · ${label}`}>
        <div className="notes-question__head">
          <h2>{label}</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <QuestionCard
          question={question}
          order={order}
          // Đáp án đúng hiện như đã chọn đúng (tô xanh), không có lựa chọn của người học.
          selected={question.answer}
          reveal
          showOrigLabels={!bank.vi.has(qid) && !question.html}
          annotate={{ qid, label, target: (hl) => ({ page: 'notes', qid, highlightId: hl }) }}
        />
        <GuidePanel question={question} order={order} vi={bank.vi.get(qid)} meta={bank.meta.get(qid)} services={bank.services} />
      </div>
    </div>
  );
}

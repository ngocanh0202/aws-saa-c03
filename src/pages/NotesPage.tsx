import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { normalizeSearch } from '../components/GeminiChat';
import { GuidePanel } from '../components/GuidePanel';
import { IconClose, IconNote } from '../components/icons';
import { QuestionCard } from '../components/QuestionCard';
import type { SetsFile } from '../data/types';
import {
  FREE_LABEL,
  GROUP_LABEL,
  groupEntries,
  matchesEntry,
  noteLabel,
  sortEntries,
  toEntries,
  type EntryGroup,
  type GroupKey,
  type NoteEntry,
  type SortKey,
} from '../notes/entries';
import { createFreeNote, fitsLimit, isFreeNote, newFreeQid, newHighlightId, type QuestionNotes } from '../notes/model';
import { FlashcardsDialog } from '../notes/FlashcardsDialog';
import { NoteForm } from '../notes/NoteForm';
import { NoteSheet } from '../notes/NoteSheet';
import { NoteEntryCard } from '../notes/NoteEntryCard';

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

export function NotesPage() {
  const { notes: store, bank, aiGate, now } = useApp();
  // list() trả mảng mới mỗi lần: lấy theo phiên bản (chuỗi JSON) để useSyncExternalStore không lặp vô hạn.
  const json = useSyncExternalStore(store.subscribe, () => JSON.stringify(store.list()));
  const list = JSON.parse(json) as QuestionNotes[];
  const [query, setQuery] = useState('');
  const [view, setView] = useState(loadView);
  const [openQid, setOpenQid] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  /** Bộ ghi chú đem ôn (chụp lúc bấm, theo ô tìm); null khi đóng. */
  const [reviewing, setReviewing] = useState<NoteEntry[] | null>(null);
  const sets = bank.sets;

  // Mở từ thông báo AI (AI soạn xong ghi chú đoạn tô): mở khung câu đó; popup do Highlighter trong khung tự mở (takeOpen).
  const pending = useSyncExternalStore(aiGate.subscribe, aiGate.peekOpen);
  useEffect(() => {
    if (pending?.page === 'notes') setOpenQid(pending.qid);
  }, [pending]);

  // Ghi chú tự do: bản ghi riêng với qid âm, không gắn câu nào.
  const createFree = (v: { title: string; content: string }) => {
    const next = createFreeNote(newFreeQid(now()), v, newHighlightId(), now());
    if (!fitsLimit(next)) return false;
    store.save(next);
    setCreating(false);
    return true;
  };

  const changeView = (v: View) => {
    setView(v);
    saveView(v);
  };
  const toggleGroup = (g: GroupKey) =>
    changeView({ ...view, group: view.group.includes(g) ? view.group.filter((x) => x !== g) : [...view.group, g] });

  const needle = normalizeSearch(query.trim());
  const entries = sortEntries(
    toEntries(list).filter((e) => (isFreeNote(e.qid) || bank.questions.has(e.qid)) && matchesEntry(e, needle, sets)),
    view.sort,
    sets,
  );
  const groups = groupEntries(entries, view.group, sets);
  const total = toEntries(list).length;

  return (
    <main className="page notes-page">
      <h1>Ghi chú của tôi</h1>
      <div className="notes-tools">
        <button type="button" className="btn-primary notes-tools__new" onClick={() => setCreating(true)}>
          <IconNote /> Ghi chú mới
        </button>
        {total > 0 && (
          <button
            type="button"
            className="notes-tools__review"
            disabled={!entries.some((e) => e.content.trim() !== '')}
            title={query.trim() ? 'Ôn các ghi chú khớp ô tìm, thứ tự ngẫu nhiên' : 'Ôn tất cả ghi chú, thứ tự ngẫu nhiên'}
            onClick={() => setReviewing(entries)}
          >
            <span aria-hidden="true">🃏</span> Ôn flashcard
          </button>
        )}
        {total > 0 && (
          <>
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
          </>
        )}
      </div>
      {total === 0 ? (
        <p>Chưa có ghi chú. Tô đề rồi ghi chú, đánh dấu câu trả lời của AI, bấm "Ghi chú" khi làm bài, hoặc tạo "Ghi chú mới".</p>
      ) : (
        <>
          {entries.length === 0 && <p>Không có ghi chú nào khớp.</p>}
          {view.group.length === 0 ? (
            <EntryList entries={entries} sets={sets} onOpen={setOpenQid} />
          ) : (
            groups.map((g) => <Group key={g.key} group={g} sets={sets} onOpen={setOpenQid} />)
          )}
        </>
      )}
      {openQid !== null && <QuestionDialog qid={openQid} onClose={() => setOpenQid(null)} />}
      {reviewing && <FlashcardsDialog entries={reviewing} onClose={() => setReviewing(null)} />}
      {creating && (
        <NoteSheet title={<><IconNote /> Ghi chú mới</>} ariaLabel="Ghi chú mới" onClose={() => setCreating(false)}>
          <NoteForm qid={0} label={FREE_LABEL} onSave={createFree} />
        </NoteSheet>
      )}
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
  const { bank } = useApp();
  return (
    <div className="notes-list">
      {entries.map((e) => (
        <NoteEntryCard key={e.key} entry={e} label={noteLabel(e.qid, sets)} question={bank.questions.get(e.qid)} onOpen={onOpen} />
      ))}
    </div>
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

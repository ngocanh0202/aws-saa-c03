import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { claimChatFocus, onChatFocus } from '../components/chat-focus';
import { normalizeSearch } from '../components/GeminiChat';
import { IconNote } from '../components/icons';
import type { Question } from '../data/types';
import { FREE_LABEL, matchesEntry, noteLabel, sortEntries, toEntries } from './entries';
import { addItem, createFreeNote, fitsLimit, isFreeNote, newFreeQid, newHighlightId, type QuestionNotes } from './model';
import { NoteEntryCard } from './NoteEntryCard';
import { NoteForm } from './NoteForm';
import { NoteSheet } from './NoteSheet';

export interface NotePanelProps {
  /** Canonical id. */
  qid: number;
  label: string;
  question: Question;
  onClose: () => void;
}

type Scope = 'question' | 'all';

/**
 * Khung ghi chú nổi ở góc như khung chat. "Câu này": ghi chú của câu (mới nhất trước), form thêm gắn vào câu.
 * "Tất cả": mọi ghi chú (kể cả ghi chú chung) để tra lại kiến thức, form thêm tạo ghi chú chung. Tìm không dấu
 * trong tiêu đề, nội dung và nhãn câu. Không có "Mở câu hỏi" để không rời bài đang làm.
 */
export function NotePanel({ qid, label, question, onClose }: NotePanelProps) {
  const { notes, bank, now } = useApp();
  const [scope, setScope] = useState<Scope>('question');
  const [query, setQuery] = useState('');
  // list() trả mảng mới mỗi lần: theo dõi bằng chuỗi JSON để useSyncExternalStore có giá trị ổn định.
  const json = useSyncExternalStore(notes.subscribe, () =>
    JSON.stringify(scope === 'question' ? [notes.get(qid)].filter(Boolean) : notes.list()),
  );
  const list = JSON.parse(json) as QuestionNotes[];
  const sets = bank.sets;
  const needle = normalizeSearch(query.trim());
  const entries = sortEntries(
    toEntries(list).filter((e) => (isFreeNote(e.qid) || bank.questions.has(e.qid)) && matchesEntry(e, needle, sets)),
    'newest',
    sets,
  );
  const all = scope === 'all';

  const add = (v: { title: string; content: string }) => {
    const next = all ? createFreeNote(newFreeQid(now()), v, newHighlightId(), now()) : addItem(notes.get(qid), qid, { kind: 'manual', ...v }, newHighlightId(), now());
    if (!fitsLimit(next)) return false;
    notes.save(next);
    return true;
  };

  return (
    <NoteSheet
      docked
      title={
        <>
          <IconNote /> Ghi chú <span className="note-form__label">· {label}</span>
        </>
      }
      ariaLabel={`Ghi chú · ${label}`}
      onClose={onClose}
    >
      <div className="note-panel__scope">
        <div className="chips" role="group" aria-label="Phạm vi">
          <button type="button" className="chip" aria-pressed={!all} onClick={() => setScope('question')}>
            Câu này
          </button>
          <button type="button" className="chip" aria-pressed={all} onClick={() => setScope('all')}>
            Tất cả
          </button>
        </div>
        <input
          type="search"
          className="notes-page__search"
          aria-label="Tìm ghi chú"
          placeholder="Tìm ghi chú…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {entries.length === 0 ? (
        <p className="note-panel__empty">{needle ? 'Không có ghi chú nào khớp.' : all ? 'Chưa có ghi chú nào.' : 'Chưa có ghi chú nào cho câu này.'}</p>
      ) : (
        <div className="notes-list note-panel__list">
          {entries.map((e) => {
            const own = e.qid === qid;
            return (
              <NoteEntryCard
                key={e.key}
                entry={e}
                label={own ? label : noteLabel(e.qid, sets)}
                hideLabel={own && !all}
                question={own ? question : bank.questions.get(e.qid)}
                level={3}
              />
            );
          })}
        </div>
      )}
      <section className="note-panel__add" aria-label={all ? 'Thêm ghi chú chung' : 'Thêm ghi chú'}>
        {/* key: đổi câu hay phạm vi thì form trống lại, không mang chữ đang gõ sang chỗ khác. */}
        <NoteForm key={`${scope}:${qid}`} question={all ? undefined : question} qid={all ? 0 : qid} label={all ? FREE_LABEL : label} onSave={add} resetOnSave />
      </section>
    </NoteSheet>
  );
}

/**
 * Nút "Ghi chú" mở khung ghi chú. `compact`: chỉ icon (nút nổi trên màn hình hẹp). Khung không đóng khi đổi
 * câu (theo câu mới). Như khung chat, mỗi lúc chỉ một khung mở: mở khung này thì khung chat đóng và ngược lại.
 */
export function NoteButton({ qid, label, question, className = '', compact = false }: { qid: number; label: string; question: Question; className?: string; compact?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => onChatFocus((other) => other !== id && setOpen(false)), [id]);
  const show = () => {
    claimChatFocus(id);
    setOpen(true);
  };
  return (
    <>
      <button type="button" className={`btn-note ${className}`.trim()} aria-label={compact ? 'Ghi chú' : undefined} title={compact ? 'Ghi chú' : undefined} onClick={show}>
        <IconNote /> {!compact && 'Ghi chú'}
      </button>
      {open && <NotePanel qid={qid} label={label} question={question} onClose={() => setOpen(false)} />}
    </>
  );
}

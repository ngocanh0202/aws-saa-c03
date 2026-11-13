import { useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { IconNote } from '../components/icons';
import type { Question } from '../data/types';
import { sortEntries, toEntries } from './entries';
import { addItem, fitsLimit, newHighlightId, type QuestionNotes } from './model';
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

/** Khung ghi chú của một câu: mọi ghi chú (mới nhất trước) để xem, sửa, xóa; form thêm mới ở dưới. */
export function NotePanel({ qid, label, question, onClose }: NotePanelProps) {
  const { notes, bank, now } = useApp();
  // Theo dõi bằng chuỗi JSON để useSyncExternalStore có giá trị ổn định.
  const json = useSyncExternalStore(notes.subscribe, () => JSON.stringify(notes.get(qid) ?? null));
  const current = JSON.parse(json) as QuestionNotes | null;
  const entries = sortEntries(toEntries(current ? [current] : []), 'newest', bank.sets);

  const add = (v: { title: string; content: string }) => {
    const next = addItem(notes.get(qid), qid, { kind: 'manual', ...v }, newHighlightId(), now());
    if (!fitsLimit(next)) return false;
    notes.save(next);
    return true;
  };

  return (
    <NoteSheet
      title={
        <>
          <IconNote /> Ghi chú <span className="note-form__label">· {label}</span>
        </>
      }
      ariaLabel={`Ghi chú · ${label}`}
      onClose={onClose}
    >
      {entries.length === 0 ? (
        <p className="note-panel__empty">Chưa có ghi chú nào cho câu này.</p>
      ) : (
        <div className="notes-list note-panel__list">
          {entries.map((e) => (
            <NoteEntryCard key={e.key} entry={e} question={question} level={3} />
          ))}
        </div>
      )}
      <section className="note-panel__add" aria-label="Thêm ghi chú">
        <NoteForm question={question} qid={qid} label={label} onSave={add} resetOnSave />
      </section>
    </NoteSheet>
  );
}

/** Nút "Ghi chú" mở khung ghi chú của một câu. `compact`: chỉ icon (nút nổi trên màn hình hẹp). */
export function NoteButton({ qid, label, question, className = '', compact = false }: { qid: number; label: string; question: Question; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`btn-note ${className}`.trim()}
        aria-label={compact ? 'Ghi chú' : undefined}
        title={compact ? 'Ghi chú' : undefined}
        onClick={() => setOpen(true)}
      >
        <IconNote /> {!compact && 'Ghi chú'}
      </button>
      {open && <NotePanel qid={qid} label={label} question={question} onClose={() => setOpen(false)} />}
    </>
  );
}

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { formatDate } from '../app/format';
import { IconAi, IconDelete, IconHighlight, IconNote } from '../components/icons';
import { Markdown } from '../components/Markdown';
import type { Question } from '../data/types';
import { SOURCE_LABEL, type NoteEntry, type NoteSource } from './entries';
import { ITEM_CONTENT_MAX, NOTE_MAX, fitsLimit, isFreeNote, removeHighlight, removeItem, setNote, updateItem } from './model';
import { NoteForm } from './NoteForm';

const SOURCE_ICON: Record<NoteSource, () => ReactNode> = {
  highlight: () => <IconHighlight />,
  ai: () => <IconAi />,
  manual: () => <IconNote />,
};

export interface NoteEntryCardProps {
  entry: NoteEntry;
  /** Nhãn câu ("Main 3 · Câu 12", "Ghi chú chung"); khung của một câu thì không cần. */
  label?: string;
  /** Đề cho AI hỗ trợ khi sửa (không có đáp án); ghi chú tự do thì không có. */
  question?: Question;
  /** Có thì hiện "Mở câu hỏi" (trừ ghi chú tự do). */
  onOpen?: (qid: number) => void;
  /** Cấp tiêu đề của mục (trang Ghi chú: 2; trong khung đã có tiêu đề riêng: 3). */
  level?: 2 | 3;
}

/** Một ghi chú: xem, sửa tại chỗ (đoạn tô chỉ sửa nội dung), xóa có xác nhận. */
export function NoteEntryCard({ entry: e, label, question, onOpen, level = 2 }: NoteEntryCardProps) {
  const { notes, now } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const highlight = e.source === 'highlight';
  const Heading = level === 2 ? 'h2' : 'h3';

  const remove = () => {
    const cur = notes.get(e.qid);
    if (!cur) return;
    notes.save(highlight ? removeHighlight(cur, e.id, now()) : removeItem(cur, e.id, now()));
  };
  const save = (v: { title: string; content: string }) => {
    const cur = notes.get(e.qid);
    if (!cur) {
      setEditing(false);
      return true;
    }
    const next = highlight ? setNote(cur, e.id, v.content, now()) : updateItem(cur, e.id, v, now());
    if (!fitsLimit(next)) return false;
    notes.save(next);
    setEditing(false);
    return true;
  };
  // Esc khi đang hỏi xóa: chỉ hủy xác nhận, không đóng khung bao ngoài.
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !confirmDelete) return;
    ev.preventDefault();
    setConfirmDelete(false);
  };

  return (
    <article className={`notes-entry notes-entry--${e.source}`} id={`note-${e.key}`} onKeyDown={onKeyDown}>
      <p className="notes-entry__meta">
        <span className="notes-entry__source" title={SOURCE_LABEL[e.source]}>
          {SOURCE_ICON[e.source]()} {SOURCE_LABEL[e.source]}
        </span>
        {label && <span>{label}</span>}
        <span>{formatDate(e.updatedAt)}</span>
      </p>
      {editing ? (
        <div className="notes-entry__edit">
          {highlight && (
            <Heading className="notes-entry__title">
              <mark className="hl">{e.title}</mark>
            </Heading>
          )}
          <NoteForm
            question={question}
            qid={e.qid}
            label={label ?? ''}
            initial={{ title: e.title, content: e.content }}
            contentOnly={highlight}
            contentMax={highlight ? NOTE_MAX : ITEM_CONTENT_MAX}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <Heading className="notes-entry__title">{highlight ? <mark className="hl">{e.title}</mark> : e.title}</Heading>
          {e.content.trim() !== '' && (e.source === 'ai' ? <Markdown text={e.content} /> : <p className="notes-entry__content">{e.content}</p>)}
          <div className="notes-entry__actions">
            {onOpen && !isFreeNote(e.qid) && (
              <button type="button" onClick={() => onOpen(e.qid)}>
                Mở câu hỏi
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)}>
              Sửa
            </button>
            {confirmDelete ? (
              <>
                <span>Xóa ghi chú này?</span>
                <button type="button" className="btn-danger" onClick={remove}>
                  Xóa
                </button>
                <button type="button" autoFocus onClick={() => setConfirmDelete(false)}>
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

import { useId, useState, type FormEvent } from 'react';
import { useApp } from '../app/context';
import { IconNote } from '../components/icons';
import { ITEM_CONTENT_MAX, TITLE_MAX, TOO_LONG_MESSAGE, addItem, fitsLimit, newHighlightId } from './model';

export interface NoteFormValue {
  title: string;
  content: string;
}

interface Props {
  /** Canonical id. */
  qid: number;
  /** Nhãn câu hiện trên form, vd "Câu 3". */
  label: string;
  onClose: () => void;
  /** Có thì sửa (giá trị ban đầu). */
  initial?: NoteFormValue;
  /** Bỏ ô tiêu đề (sửa ghi chú đoạn tô: tiêu đề là chữ trong đề). */
  contentOnly?: boolean;
  /** Tự lưu; trả về false (vượt dung lượng) thì giữ form và báo. Không có thì thêm ghi chú "tự ghi" vào câu. */
  onSave?: (v: NoteFormValue) => boolean;
}

/** Form ghi chú tiêu đề + nội dung (popup; điện thoại: bottom sheet). */
export function NoteFormDialog({ qid, label, onClose, initial, contentOnly = false, onSave }: Props) {
  const { notes, now } = useApp();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tooLong, setTooLong] = useState(false);
  const titleId = useId();

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!contentOnly && title.trim() === '') return;
    const value = { title, content };
    let ok: boolean;
    if (onSave) ok = onSave(value);
    else {
      const next = addItem(notes.get(qid), qid, { kind: 'manual', ...value }, newHighlightId(), now());
      ok = fitsLimit(next);
      if (ok) notes.save(next);
    }
    if (ok) onClose();
    else setTooLong(true);
  };

  return (
    <div className="dialog note-form" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog__box note-form__box" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save}>
        <h2 id={titleId} className="note-form__title">
          <IconNote /> {initial ? 'Sửa ghi chú' : 'Ghi chú'} <span className="note-form__label">· {label}</span>
        </h2>
        {!contentOnly && (
          <input
            className="note-form__input"
            aria-label="Tiêu đề"
            placeholder="Tiêu đề"
            maxLength={TITLE_MAX}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        <textarea
          className="note-form__input"
          aria-label="Nội dung"
          placeholder="Nội dung"
          rows={6}
          maxLength={ITEM_CONTENT_MAX}
          value={content}
          autoFocus={contentOnly}
          onChange={(e) => setContent(e.target.value)}
        />
        {tooLong && (
          <p className="note-form__error" role="alert">
            {TOO_LONG_MESSAGE}
          </p>
        )}
        <div className="row">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn-primary" disabled={!contentOnly && title.trim() === ''}>
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

/** Nút "Ghi chú" mở form tự ghi chú cho một câu. */
export function NoteButton({ qid, label, className = '' }: { qid: number; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn-note ${className}`.trim()} onClick={() => setOpen(true)}>
        <IconNote /> Ghi chú
      </button>
      {open && <NoteFormDialog qid={qid} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}

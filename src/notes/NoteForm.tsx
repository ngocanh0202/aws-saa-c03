import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Question } from '../data/types';
import { ITEM_CONTENT_MAX, TITLE_MAX, TOO_LONG_MESSAGE } from './model';
import { NoteAiAssist } from './NoteAiAssist';

export interface NoteFormValue {
  title: string;
  content: string;
}

export interface NoteFormProps {
  /** Có thì AI đọc đề (không có đáp án); ghi chú tự do thì không có. */
  question?: Question;
  qid: number;
  label: string;
  /** Có thì sửa (giá trị ban đầu). */
  initial?: NoteFormValue;
  /** Bỏ ô tiêu đề (ghi chú đoạn tô: tiêu đề là chữ trong đề, vẫn gửi cho AI). */
  contentOnly?: boolean;
  contentMax?: number;
  /** Trả về false (vượt dung lượng) thì giữ form và báo. */
  onSave: (v: NoteFormValue) => boolean;
  onCancel?: () => void;
  /** Xóa trống sau khi lưu được (form thêm mới nằm dưới danh sách). */
  resetOnSave?: boolean;
  /** Đưa con trỏ vào ô đầu khi mở (mặc định: khi đang sửa, tức có onCancel). */
  autoFocus?: boolean;
}

/** Form tiêu đề + nội dung, có nút AI hỗ trợ viết (kết quả nối vào nội dung, không tự lưu). */
export function NoteForm({ question, qid, label, initial, contentOnly = false, contentMax = ITEM_CONTENT_MAX, onSave, onCancel, resetOnSave = false, autoFocus }: NoteFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tooLong, setTooLong] = useState(false);
  const canSave = contentOnly || title.trim() !== '';
  // Mặc định đưa focus vào form khi có Hủy (đang sửa, popup thêm mới) để Esc hủy bước đó, không đóng khung bao ngoài.
  const focusFirst = autoFocus ?? onCancel !== undefined;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!onSave({ title, content })) return setTooLong(true);
    setTooLong(false);
    if (resetOnSave) {
      setTitle('');
      setContent('');
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !onCancel) return;
    e.preventDefault();
    onCancel();
  };
  // Nối vào nội dung hiện tại (người học có thể đã gõ thêm trong lúc AI soạn).
  const onDraft = (text: string) => setContent((c) => (c.trim() ? `${c.replace(/\s+$/, '')}\n\n${text}` : text).slice(0, contentMax));

  return (
    <form className="note-form__form" onSubmit={save} onKeyDown={onKeyDown}>
      {!contentOnly && (
        <input
          className="note-form__input"
          aria-label="Tiêu đề"
          placeholder="Tiêu đề"
          maxLength={TITLE_MAX}
          value={title}
          autoFocus={focusFirst}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      <textarea
        className="note-form__input"
        aria-label="Nội dung"
        placeholder="Nội dung"
        rows={5}
        maxLength={contentMax}
        value={content}
        autoFocus={focusFirst && contentOnly}
        onChange={(e) => setContent(e.target.value)}
      />
      {tooLong && (
        <p className="note-form__error" role="alert">
          {TOO_LONG_MESSAGE}
        </p>
      )}
      <div className="note-form__actions">
        <NoteAiAssist question={question} qid={qid} label={label} title={title} content={content} onDraft={onDraft} />
        <span className="note-form__spacer" />
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Hủy
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={!canSave}>
          Lưu
        </button>
      </div>
    </form>
  );
}

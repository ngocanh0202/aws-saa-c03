import { useApp } from '../app/context';
import { useAiGate, type AiJobTarget } from '../ai/gate';
import { useActiveAi } from '../components/GeminiChat';
import { IconAi, IconRetry } from '../components/icons';
import type { Question } from '../data/types';
import { draftNote, lastNoteError } from './note-ai';
import { useNoteAiRuntime, type ActiveAi } from './use-note-ai';

export interface NoteAiButtonProps {
  question: Question;
  /** Canonical id. */
  qid: number;
  highlightId: string;
  text: string;
  label: string;
  target: AiJobTarget;
}

/**
 * Nút "AI soạn ghi chú" trong popup ghi chú. Hiện theo đúng điều kiện của nút chat AI (đã đăng nhập
 * và có AI của chế độ đang chọn); khóa khi có yêu cầu AI khác đang chạy hoặc AI đang hết lượt.
 * Lần soạn trước của đoạn này lỗi thì hiện dòng lỗi và nút thử lại.
 */
export function NoteAiButton(props: NoteAiButtonProps) {
  const active = useActiveAi();
  if (!active) return null;
  return <Ready key={`${active.uid}:${active.brand}`} {...props} active={active} />;
}

function Ready({ active, question, qid, highlightId, text, label, target }: NoteAiButtonProps & { active: ActiveAi }) {
  const { aiGate, notes, now } = useApp();
  const job = useAiGate();
  const { client } = active;
  const { cooldown, until, settings } = useNoteAiRuntime(active);

  const disabled = job !== null || until !== null;
  const error = job === null ? lastNoteError(highlightId) : undefined;
  const start = () => {
    if (disabled) return;
    draftNote(
      { gate: aiGate, notes, client, settings, cooldown, now },
      { question, qid, highlightId, text, label, target },
    ).catch(() => {
      // Gate bận (chỉ xảy ra khi đua): bỏ qua, nút đã khóa.
    });
  };
  const title = until !== null ? 'AI đang hết lượt, thử lại sau ít phút' : 'AI soạn ghi chú';

  return (
    <>
      {error && (
        <p className="hl-pop__error" role="alert">
          {error}
        </p>
      )}
      {error ? (
        <button type="button" className="hl-btn" aria-label="Thử lại AI soạn" title="Thử lại AI soạn" disabled={disabled} onClick={start}>
          <IconRetry />
        </button>
      ) : (
        <button type="button" className="hl-btn" aria-label="AI soạn ghi chú" title={title} disabled={disabled} onClick={start}>
          <IconAi />
        </button>
      )}
    </>
  );
}

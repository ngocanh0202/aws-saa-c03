import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../app/context';
import { AiGateBusyError, useAiGate } from '../ai/gate';
import { AiUserError } from '../ai/types';
import { useActiveAi } from '../components/GeminiChat';
import { IconAi, IconRetry } from '../components/icons';
import type { Question } from '../data/types';
import { canDraftForm, draftFormNote } from './form-ai';
import { useNoteAiRuntime, type ActiveAi } from './use-note-ai';

export interface NoteAiAssistProps {
  /** Có thì AI đọc đề (không bao giờ có đáp án); ghi chú tự do thì không có. */
  question?: Question;
  qid: number;
  label: string;
  title: string;
  content: string;
  /** Nhận chữ AI viết (form tự nối vào nội dung, không tự lưu). */
  onDraft: (text: string) => void;
}

/**
 * Nút AI trong form ghi chú. Hiện theo điều kiện của nút chat AI; khóa khi hai ô đều trống, khi có
 * yêu cầu AI khác đang chạy hoặc AI đang hết lượt. Form đóng trước khi AI xong thì bỏ kết quả.
 */
export function NoteAiAssist(props: NoteAiAssistProps) {
  const active = useActiveAi();
  if (!active) return null;
  return <Ready key={`${active.uid}:${active.brand}`} {...props} active={active} />;
}

function Ready({ active, question, qid, label, title, content, onDraft }: NoteAiAssistProps & { active: ActiveAi }) {
  const { aiGate, now } = useApp();
  const job = useAiGate();
  const { cooldown, until, settings } = useNoteAiRuntime(active);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const draft = useRef(onDraft);
  useLayoutEffect(() => {
    draft.current = onDraft;
  });

  const disabled = !canDraftForm(title, content) || job !== null || until !== null;
  const start = () => {
    if (disabled) return;
    setError(null);
    setRunning(true);
    draftFormNote({ gate: aiGate, client: active.client, settings, cooldown, now }, { question, qid, label, title, content }).then(
      (text) => {
        if (!live.current) return;
        setRunning(false);
        draft.current(text);
      },
      (e: unknown) => {
        if (!live.current) return;
        setRunning(false);
        // Gate bận chỉ xảy ra khi đua: nút đã khóa, không báo.
        if (e instanceof AiGateBusyError) return;
        setError(e instanceof AiUserError ? e.userMessage : 'AI không soạn được ghi chú. Thử lại sau.');
      },
    );
  };
  const hint = until !== null ? 'AI đang hết lượt, thử lại sau ít phút' : 'AI hỗ trợ viết ghi chú';

  return (
    <div className="note-ai">
      <button type="button" className="hl-btn" aria-label="AI hỗ trợ viết ghi chú" title={hint} disabled={disabled} onClick={start}>
        <IconAi />
      </button>
      {running && <span className="note-ai__status">AI đang soạn…</span>}
      {error && !running && (
        <>
          <span className="note-ai__error" role="alert">
            {error}
          </span>
          <button type="button" className="note-ai__retry" disabled={disabled} onClick={start}>
            <IconRetry size={14} /> Thử lại
          </button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { targetKey, type AiJob } from '../ai/gate';

const HIDE_AFTER = 10_000;

function message(job: AiJob, ok: boolean): string {
  if (!ok) return `AI gặp lỗi ở ${job.label}`;
  return job.kind === 'note' ? `AI đã soạn ghi chú ở ${job.label}` : `AI đã trả lời ở ${job.label}`;
}

/** "Câu 12" → "Đến câu 12"; "Main 1 · Câu 5" → "Đến Main 1 · Câu 5". */
const goLabel = (label: string) => `Đến ${label.replace(/^Câu\b/, 'câu')}`;

/**
 * Thông báo góc trên bên phải khi một yêu cầu AI xong, trừ khi người học đang nhìn đúng chỗ đó.
 * Chỉ giữ một thông báo; tự ẩn sau 10 giây.
 */
export function AiDoneToast() {
  const { aiGate, store } = useApp();
  const navigate = useNavigate();
  const [shown, setShown] = useState<{ job: AiJob; ok: boolean; n: number } | null>(null);

  useEffect(() => {
    let n = 0;
    return aiGate.onFinished((job, ok) => {
      if (aiGate.viewing() === targetKey(job.target)) return;
      setShown({ job, ok, n: ++n });
    });
  }, [aiGate]);

  // Đếm lại 10 giây mỗi khi có thông báo mới.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), HIDE_AFTER);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  const { job, ok } = shown;
  const go = () => {
    const t = job.target;
    aiGate.requestOpen(t);
    setShown(null);
    if (t.page === 'notes') navigate('/notes');
    else navigate(store.get(t.attemptId)?.status === 'submitted' ? `/result/${t.attemptId}` : `/exam/${t.attemptId}`);
  };
  return (
    <div className={`ai-toast${ok ? '' : ' ai-toast--error'}`} role="status" lang="vi">
      <p className="ai-toast__text">{message(job, ok)}</p>
      <div className="ai-toast__actions">
        <button type="button" className="btn-primary" onClick={go}>
          {goLabel(job.label)}
        </button>
        <button type="button" className="icon-btn" aria-label="Đóng thông báo" onClick={() => setShown(null)}>
          ✕
        </button>
      </div>
    </div>
  );
}

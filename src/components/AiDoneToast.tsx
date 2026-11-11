import { useEffect, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { targetKey, type AiJob } from '../ai/gate';

const HIDE_AFTER = 10_000;
/** Sau khi điều hướng, nơi đích (layout effect + effect của trang mới) có chừng này để nhận yêu cầu mở. */
export const OPEN_GRACE_MS = 100;

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
  const [shown, setShown] = useState<{ job: AiJob; ok: boolean } | null>(null);

  // Mỗi lần xong là một object mới nên hẹn giờ ẩn được đặt lại.
  useEffect(
    () =>
      aiGate.onFinished((job, ok) => {
        if (aiGate.viewing() === targetKey(job.target)) return;
        setShown({ job, ok });
      }),
    [aiGate],
  );

  // Đang làm Thi thật thì giữ lại thông báo mới nhất, rời trang thi (hoặc nộp bài) mới hiện.
  const { pathname } = useLocation();
  useStoreVersion();
  const examId = matchPath('/exam/:id', pathname)?.params.id;
  const exam = examId ? store.get(examId) : undefined;
  const held = exam?.mode === 'real' && exam.status === 'in-progress';

  // Đếm lại 10 giây mỗi khi có thông báo mới (tính từ lúc hiện ra).
  useEffect(() => {
    if (!shown || held) return;
    const t = setTimeout(() => setShown(null), HIDE_AFTER);
    return () => clearTimeout(t);
  }, [shown, held]);

  if (!shown || held) return null;
  const { job, ok } = shown;
  const go = () => {
    const t = job.target;
    aiGate.requestOpen(t);
    setShown(null);
    if (t.page === 'notes') navigate('/notes');
    else navigate(store.get(t.attemptId)?.status === 'submitted' ? `/result/${t.attemptId}` : `/exam/${t.attemptId}`);
    // Chưa ai nhận (vd. lượt đã nộp: trang kết quả không có popup ghi chú) thì bỏ, để không bật lên ở trang ghé sau.
    setTimeout(() => aiGate.takeOpen((x) => x === t), OPEN_GRACE_MS);
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

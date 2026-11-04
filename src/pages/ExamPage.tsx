import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { EXAM_LABELS } from '../app/labels';
import { DraggableFab } from '../components/DraggableFab';
import { GeminiButton } from '../components/GeminiChat';
import { GuidePanel } from '../components/GuidePanel';
import { NavGrid } from '../components/NavGrid';
import { QuestionCard } from '../components/QuestionCard';
import { Timer } from '../components/Timer';
import { markGuideOpened, selectOption, submitAttempt, toggleFlag } from '../engine/actions';
import { isCompatible, type Attempt } from '../engine/attempt';

export function ExamPage() {
  const { id = '' } = useParams();
  const { bank, store, now } = useApp();
  const navigate = useNavigate();
  useStoreVersion();
  const attempt = store.get(id);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  // Điện thoại: khung bên trái là ngăn kéo, mở bằng nút nổi; máy tính luôn hiện.
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  const update = useCallback(
    (next: Attempt) => {
      store.save(next);
    },
    [store],
  );

  useEffect(() => {
    if (attempt?.status === 'submitted') navigate(`/result/${attempt.id}`, { replace: true });
  }, [attempt, navigate]);

  if (!attempt || !isCompatible(attempt, bank.questions)) {
    return (
      <main className="page">
        <p>Không tìm thấy lượt thi này, hoặc dữ liệu đã thay đổi nên không mở được.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }

  const t = EXAM_LABELS[attempt.mode];
  const aq = attempt.questions[index];
  const question = bank.questions.get(aq.qid)!;
  const selected = attempt.answers[aq.qid] ?? [];
  const revealed = attempt.mode === 'practice' && attempt.guideOpened.includes(aq.qid);
  const flagged = attempt.flagged.includes(aq.qid);
  const unanswered = attempt.questions.filter((q) => !(attempt.answers[q.qid]?.length ?? 0)).length;
  const submit = () => update(submitAttempt(attempt, now()));

  return (
    <main className={`page exam exam--${attempt.mode}`} lang={attempt.mode === 'real' ? 'en' : 'vi'}>
      <header className="exam__bar">
        <strong>{t.question(index + 1, attempt.questions.length)}</strong>
        {attempt.mode === 'real' && attempt.endsAt !== undefined && (
          <Timer endsAt={attempt.endsAt} now={now} label={t.timeRemaining} onExpire={submit} />
        )}
        <button type="button" onClick={() => setConfirming(true)}>
          {t.end}
        </button>
      </header>

      <div className="exam__layout">
        <aside id="exam-panel" className={`exam__side${panelOpen ? ' is-open' : ''}`} aria-label={t.panel}>
          <div className="exam__side-head">
            <span>{t.progress(attempt.questions.length - unanswered, attempt.questions.length, attempt.flagged.length)}</span>
            <button type="button" className="icon-btn exam__side-close" aria-label={t.closePanel} onClick={() => setPanelOpen(false)}>
              ✕
            </button>
          </div>
          <div className="exam__actions">
            <button type="button" className="exam__flag" aria-pressed={flagged} onClick={() => update(toggleFlag(attempt, aq.qid))}>
              {flagged ? t.unflag : t.flag}
            </button>
          </div>
          <NavGrid
            attempt={attempt}
            current={index}
            onJump={(i) => {
              setIndex(i);
              setPanelOpen(false);
            }}
            label={t.nav}
          />
        </aside>

        <div className="exam__content">
          <QuestionCard
            question={question}
            order={aq.optionOrder}
            selected={selected}
            reveal={revealed}
            showOrigLabels={revealed && !bank.vi.has(aq.qid) && !question.html}
            chooseLabel={question.choose > 1 ? t.choose(question.choose) : undefined}
            onSelect={(key) => update(selectOption(attempt, aq.qid, key, question.choose))}
          />

          <div className="exam__pager">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              {t.prev}
            </button>
            <button type="button" disabled={index === attempt.questions.length - 1} onClick={() => setIndex(index + 1)}>
              {t.next}
            </button>
          </div>

          {attempt.mode === 'practice' && (
            <>
              <div className="exam__assist">
                {!revealed && (
                  <button type="button" className="btn-guide" onClick={() => update(markGuideOpened(attempt, aq.qid))}>
                    {t.guide}
                  </button>
                )}
                <GeminiButton
                  key={aq.qid}
                  attemptId={attempt.id}
                  number={index + 1}
                  question={question}
                  order={aq.optionOrder}
                  revealed={revealed}
                  onOpenGuide={() => {
                    // Gemini gọi tool khi câu trả lời đang stream: lấy lượt thi mới nhất trong store.
                    const latest = store.get(attempt.id);
                    // Có thể tới sau khi đã nộp bài (câu trả lời chạy nền): lượt đã nộp thì không sửa.
                    if (latest?.status === 'in-progress' && !latest.guideOpened.includes(aq.qid)) update(markGuideOpened(latest, aq.qid));
                  }}
                />
              </div>
              {revealed && (
                <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
              )}
            </>
          )}
        </div>
      </div>

      {panelOpen && <div className="exam__backdrop" onClick={() => setPanelOpen(false)} />}
      <DraggableFab label={panelOpen ? t.closePanel : t.openPanel} expanded={panelOpen} controls="exam-panel" onClick={() => setPanelOpen((o) => !o)}>
        {panelOpen ? '✕' : `${index + 1}/${attempt.questions.length}`}
      </DraggableFab>

      {confirming && (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="dialog__box">
            <h2 id="confirm-title">{t.confirmTitle}</h2>
            <p>{t.confirmBody(unanswered, attempt.flagged.length)}</p>
            <div className="row">
              <button type="button" onClick={() => setConfirming(false)}>
                {t.cancel}
              </button>
              <button type="button" className="btn-primary" onClick={submit}>
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

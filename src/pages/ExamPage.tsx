import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { EXAM_LABELS } from '../app/labels';
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

      <QuestionCard
        question={question}
        order={aq.optionOrder}
        selected={selected}
        reveal={revealed}
        showOrigLabels={revealed && !bank.vi.has(aq.qid)}
        chooseLabel={question.choose > 1 ? t.choose(question.choose) : undefined}
        onSelect={(key) => update(selectOption(attempt, aq.qid, key, question.choose))}
      />

      {attempt.mode === 'practice' &&
        (revealed ? (
          <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
        ) : (
          <button type="button" className="btn-guide" onClick={() => update(markGuideOpened(attempt, aq.qid))}>
            {t.guide}
          </button>
        ))}

      <div className="exam__actions">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t.prev}
        </button>
        <button type="button" aria-pressed={flagged} onClick={() => update(toggleFlag(attempt, aq.qid))}>
          {flagged ? t.unflag : t.flag}
        </button>
        <button type="button" disabled={index === attempt.questions.length - 1} onClick={() => setIndex(index + 1)}>
          {t.next}
        </button>
      </div>

      <NavGrid attempt={attempt} current={index} onJump={setIndex} label={t.nav} />

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

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { useClockReady, useStoreVersion } from '../app/use-store';
import { formatDate, modeName, setLabel } from '../app/format';
import { DomainBars } from '../components/DomainBars';
import { createAttempt, isCompatible, type Mode } from '../engine/attempt';
import type { AttemptSummary } from '../engine/stats';
import { PASS_SCORE } from '../engine/scoring';
import { setStats, summarize } from '../engine/stats';
import { finalizeExpiredRealAttempts, viewFinalized } from '../storage/finalize';

export function HomePage() {
  const { bank, store, now, newSeed, newId } = useApp();
  const navigate = useNavigate();
  const [esl, setEsl] = useState(true);
  const [shuffleMain, setShuffleMain] = useState(readShuffleMain);

  const version = useStoreVersion();
  const clockReady = useClockReady();
  // Lưu trong effect (save gọi listener, không được gọi lúc render); lúc render chỉ tính bản đã chốt.
  // Chờ đồng hồ sẵn sàng: máy lệch giờ chưa biết offset server không được chốt sớm lượt Thi thật.
  useEffect(() => {
    if (clockReady) finalizeExpiredRealAttempts(store, now());
  }, [store, now, version, clockReady]);
  const all = viewFinalized(store.list(), now());
  const usable = all.filter((a) => isCompatible(a, bank.questions));
  const inProgress = usable.filter((a) => a.status === 'in-progress').sort((a, b) => b.startedAt - a.startedAt);
  const summaries = usable.filter((a) => a.status === 'submitted').map((a) => summarize(a, bank.questions));
  const recent = [...summaries].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 10);
  const hiddenCount = all.length - usable.length;

  const start = (setId: number, mode: Mode) => {
    const attempt = createAttempt({
      id: newId(),
      setId,
      mode,
      esl,
      seed: newSeed(),
      now: now(),
      sets: bank.sets,
      questions: bank.questions,
      metas: bank.meta,
      mainSets: bank.mainSets,
      shuffleQuestions: shuffleMain,
    });
    store.save(attempt);
    navigate(`/exam/${attempt.id}`);
  };

  return (
    <main className="page home">
      <h1>Luyện thi AWS SAA-C03</h1>
      <p>
        Mỗi đề 65 câu, 130 phút (160 phút với ESL). Đậu khi đạt ≥ {PASS_SCORE}/1000.
      </p>

      {inProgress.length > 0 && (
        <section>
          <h2>Đang làm dở</h2>
          <ul className="plain-list">
            {inProgress.map((a) => (
              <li key={a.id}>
                <Link to={`/exam/${a.id}`}>
                  Làm tiếp {setLabel(a.setId)} ({modeName(a.mode)}), bắt đầu {formatDate(a.startedAt)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="esl">
        <input type="checkbox" checked={esl} onChange={(e) => setEsl(e.target.checked)} /> ESL +30 phút cho Thi thật (160 phút)
      </label>
      <p className="hint">Nhớ đăng ký ESL +30 với AWS trước khi đặt lịch thi thật.</p>

      {bank.mainSets.length > 0 && (
        <section className="set-section" aria-labelledby="main-title">
          <div className="set-section__head">
            <h2 id="main-title">Main</h2>
            <label className="switch">
              <input
                type="checkbox"
                checked={shuffleMain}
                onChange={(e) => {
                  setShuffleMain(e.target.checked);
                  saveShuffleMain(e.target.checked);
                }}
              />
              <span className="switch__track" aria-hidden="true" />
              Xáo thứ tự câu hỏi
            </label>
          </div>
          <p className="hint">
            {bank.mainSets.length} đề cố định × 65 câu từ <code>question-doc-main</code>. Lựa chọn luôn được xáo; thứ tự câu hỏi giữ như file gốc trừ khi bật xáo.
          </p>
          <div className="set-grid">
            {bank.mainSets.map((set) => (
              <SetCard key={set.id} setId={set.id} subtitle={set.file} summaries={summaries} onStart={start} />
            ))}
          </div>
        </section>
      )}

      <section className="set-section" aria-labelledby="sub-title">
        <h2 id="sub-title">Sub</h2>
        <p className="hint">
          {bank.sets.sets.length} đề × 65 câu, chia theo domain như đề thật; mỗi lượt thay 10 câu dự phòng và xáo cả câu hỏi lẫn lựa chọn.
        </p>
        <div className="set-grid">
          {bank.sets.sets.map((set) => (
            <SetCard key={set.id} setId={set.id} summaries={summaries} onStart={start} />
          ))}
        </div>
      </section>

      <section>
        <h2>Lịch sử</h2>
        {recent.length === 0 ? (
          <p>Chưa có lượt thi nào.</p>
        ) : (
          <ul className="plain-list">
            {recent.map((s) => (
              <li key={s.attemptId}>
                <Link to={`/result/${s.attemptId}`}>
                  {setLabel(s.setId)} · {modeName(s.mode)} · {s.score} điểm · {s.passed ? 'Đậu' : 'Trượt'} · {formatDate(s.submittedAt)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 && <p className="hint">{hiddenCount} lượt thi cũ không còn khớp dữ liệu hiện tại nên không mở được.</p>}
      </section>
    </main>
  );
}

const SHUFFLE_MAIN_KEY = 'saa-c03:main-shuffle';

function readShuffleMain(): boolean {
  try {
    return localStorage.getItem(SHUFFLE_MAIN_KEY) === '1';
  } catch {
    return false;
  }
}

function saveShuffleMain(value: boolean): void {
  try {
    localStorage.setItem(SHUFFLE_MAIN_KEY, value ? '1' : '0');
  } catch {
    // localStorage bị chặn: chỉ nhớ trong phiên này
  }
}

function SetCard({
  setId,
  subtitle,
  summaries,
  onStart,
}: {
  setId: number;
  subtitle?: string;
  summaries: AttemptSummary[];
  onStart: (setId: number, mode: Mode) => void;
}) {
  const real = setStats(summaries, setId, 'real');
  const any = setStats(summaries, setId);
  return (
    <article className="card set-card">
      <h2>
        <Link to={`/set/${setId}`}>{setLabel(setId)}</Link>
        {subtitle && <small className="set-card__file">{' · '}{subtitle}</small>}
      </h2>
      <p>
        Thi thật: {real.attempts.length} lần · cao nhất {real.best ?? '—'}
      </p>
      <p>Tổng số lần làm: {any.attempts.length}</p>
      {any.latest && <DomainBars byDomain={any.latest.byDomain} caption={`Lượt gần nhất (${modeName(any.latest.mode)})`} />}
      <div className="set-card__actions">
        <button type="button" className="btn-primary" onClick={() => onStart(setId, 'real')}>
          Thi thật
        </button>
        <button type="button" onClick={() => onStart(setId, 'practice')}>
          Thi thử
        </button>
      </div>
    </article>
  );
}
